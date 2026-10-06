import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { Room, Statistic, Announcement, StreamItem } from '@/utils/types'
import { isAnnouncement, roomKey } from '@/utils/types'
import { parseJson, parseRoom, parseHeartbeat, parseStatistic } from '@/utils/parse'
import { API_BASE, fetchAnnouncement, fetchPing } from '@/utils/api'
import { i18n } from '@/i18n'
import { useSettingsStore } from './settings'

export interface DisplayEntry {
  key: string
  item: StreamItem
}

interface PinnedRoom {
  room: Room
  pinnedAt: number // ms; the most recently pinned room is shown first
}

export const ANNOUNCEMENT_KEY = 'announcement'

// Backend alternates heartbeat/statistic every 15s, so heartbeat arrives
// every ~30s. Use 45s timeout to tolerate network jitter.
const HEARTBEAT_TIMEOUT = 45_000
// Briefly batch the initial replay for one sort without adding a visible pause
// on every first connection or reconnect. Later live rooms are shown immediately.
const BURST_WINDOW = 50
const SWEEP_INTERVAL = 30_000
// Mounted cards expire themselves with an animation; the sweep only collects
// what they left behind (filtered-out rooms are never mounted).
const SWEEP_GRACE = 5
// Reconnect after 1 s, 2 s, 4 s … up to 30 s, each with ±25% jitter so clients
// dropped together do not all come back at the same moment
const RETRY_BASE = 1000
const RETRY_MAX = 30_000
const RETRY_JITTER = 0.25
export const BLOCK_DURATION = 10 * 60_000

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function announcementSignature(a: Announcement): string {
  return `${a.time}|${a.msg}`
}

export const useRoomStore = defineStore('rooms', () => {
  const settings = useSettingsStore()

  // ── State ──────────────────────────────────────────────────────────────────
  const itemMap = ref<Map<string, StreamItem>>(new Map())
  const statistic = ref<Statistic>({ online: 0, past15m: 0 })
  const lastHeartbeat = ref(0)
  const latencyMs = ref<number | null>(null)
  const connectionState = ref<'connecting' | 'open' | 'closed'>('closed')
  // The last connection attempt errored; cleared once a stream opens
  const connectFailed = ref(false)
  // When the next reconnect attempt starts (ms), or null when none is waiting
  const retryAt = ref<number | null>(null)
  const announcement = ref<Announcement | null>(null)
  const focusMode = ref(false)
  const sidebarCollapsed = ref(false)
  // Pinned rooms are stored whole (text included) so they survive a reload and
  // show up even when the server no longer replays them. Shared across tabs.
  const pinnedRooms = useLocalStorage<Record<string, PinnedRoom>>('pjsk-pinned-rooms', {})
  for (const [key, entry] of Object.entries(pinnedRooms.value)) {
    // Saved by another version or edited by hand: keep only well-formed rooms
    const room = parseRoom(entry?.room)
    if (!room || typeof entry.pinnedAt !== 'number') {
      const next = { ...pinnedRooms.value }
      delete next[key]
      pinnedRooms.value = next
    }
  }
  const pinnedKeys = computed(() => new Set(Object.keys(pinnedRooms.value)))
  // Room ID -> time (ms) the block ends. Kept in localStorage so it survives a
  // reload and applies to every open tab.
  const blockedIds = useLocalStorage<Record<string, number>>('pjsk-blocked-ids', {})

  // Stable display order — only append/prepend, never re-sort
  const displayOrder = ref<string[]>([])
  // False until the first burst has been merged
  const ready = ref(false)

  let eventSource: EventSource | null = null
  let wanted = false
  let retryAttempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let burstTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatWatchdog: ReturnType<typeof setTimeout> | null = null
  let sweepTimer: ReturnType<typeof setInterval> | null = null
  let bursting = false
  let burstBuffer: Room[] = []
  // Signature of the announcement already injected this session, so that a
  // dismissed or expired one does not come back on every reconnect.
  let shownAnnouncement: string | null = null

  // Clock offset: serverTime - clientTime (ms). Positive = server ahead.
  // Calibrated via NTP-style ping on each connect.
  let clockOffset = 0

  // ── Computed ───────────────────────────────────────────────────────────────

  const rooms = computed(() =>
    Array.from(itemMap.value.values()).filter((item): item is Room => !isAnnouncement(item)),
  )

  /**
   * Stable display list. Order is locked once established:
   * - Burst rooms: sorted by time desc once at finalize, then frozen
   * - Live rooms: prepended as they arrive (newest on top)
   * Pinned rooms float to the top and, like announcements, ignore the filters.
   */
  const displayItems = computed<DisplayEntry[]>(() => {
    const pinned: DisplayEntry[] = Object.entries(pinnedRooms.value)
      .filter(([, entry]) => !(entry.room.id in blockedIds.value))
      .sort((x, y) => y[1].pinnedAt - x[1].pinnedAt)
      .map(([key, entry]) => ({ key, item: entry.room }))
    if (!ready.value) return pinned

    const terms = settings.allFilterTerms.map(term => term.toLowerCase())
    const blacklist = settings.filterMode === 'blacklist'
    const unpinned: DisplayEntry[] = []

    for (const key of displayOrder.value) {
      const item = itemMap.value.get(key)
      if (!item || pinnedKeys.value.has(key)) continue
      if (!isAnnouncement(item) && item.id in blockedIds.value) continue
      if (terms.length > 0 && !isAnnouncement(item)) {
        const text = `${item.msg} ${item.name}`.toLowerCase()
        const matches = terms.some(term => text.includes(term))
        if (matches === blacklist) continue
      }
      unpinned.push({ key, item })
    }

    return [...pinned, ...unpinned]
  })

  const isDev = import.meta.env.DEV

  // ── Stream items ───────────────────────────────────────────────────────────
  function isExpired(item: StreamItem, now = nowSeconds(), grace = 0): boolean {
    return now - item.time > settings.expireTime + grace
  }

  function addRoom(room: Room) {
    const key = roomKey(room)
    // The server replays recent rooms on every (re)connect
    if (itemMap.value.has(key)) return

    if (bursting) {
      burstBuffer.push(room)
    } else {
      // Live room — prepend to display order (newest on top)
      itemMap.value.set(key, room)
      displayOrder.value = [key, ...displayOrder.value]
    }
  }

  function updateStatistic(stat: Statistic) {
    statistic.value = stat
  }

  function dropPins(keep: (key: string, entry: PinnedRoom) => boolean) {
    const entries = Object.entries(pinnedRooms.value)
    const kept = entries.filter(([key, entry]) => keep(key, entry))
    if (kept.length !== entries.length) pinnedRooms.value = Object.fromEntries(kept)
  }

  function removeItem(key: string) {
    itemMap.value.delete(key)
    displayOrder.value = displayOrder.value.filter(k => k !== key)
    dropPins(k => k !== key)
  }

  /** Sort the buffered burst by time desc and put it on top of what is already shown. */
  function finalizeBurst() {
    burstTimer = null
    bursting = false

    const now = nowSeconds()
    const fresh = new Map<string, StreamItem>()
    for (const room of burstBuffer) {
      const key = roomKey(room)
      if (!itemMap.value.has(key) && !isExpired(room, now)) fresh.set(key, room)
    }
    burstBuffer = []

    const current = announcement.value
    if (current?.msg && announcementSignature(current) !== shownAnnouncement) {
      shownAnnouncement = announcementSignature(current)
      let newest = now
      for (const item of fresh.values()) newest = Math.max(newest, item.time + 1)
      itemMap.value.delete(ANNOUNCEMENT_KEY)
      displayOrder.value = displayOrder.value.filter(k => k !== ANNOUNCEMENT_KEY)
      fresh.set(ANNOUNCEMENT_KEY, { kind: 'announcement', time: newest, msg: current.msg })
    }

    const sorted = [...fresh.entries()].sort((a, b) => b[1].time - a[1].time)
    for (const [key, item] of sorted) itemMap.value.set(key, item)
    displayOrder.value = [...sorted.map(([key]) => key), ...displayOrder.value]
    ready.value = true
  }

  /** Shows an announcement that arrived after the first burst was merged. */
  function injectLateAnnouncement() {
    const current = announcement.value
    if (!ready.value || bursting || !current?.msg) return
    if (announcementSignature(current) === shownAnnouncement) return
    shownAnnouncement = announcementSignature(current)
    itemMap.value.set(ANNOUNCEMENT_KEY, { kind: 'announcement', time: nowSeconds(), msg: current.msg })
    displayOrder.value = [ANNOUNCEMENT_KEY, ...displayOrder.value.filter(k => k !== ANNOUNCEMENT_KEY)]
  }

  /** Drop expired items nobody is displaying. */
  function sweep() {
    const now = nowSeconds()
    let removed = false
    for (const [key, item] of itemMap.value) {
      if (!pinnedKeys.value.has(key) && isExpired(item, now, SWEEP_GRACE)) {
        itemMap.value.delete(key)
        removed = true
      }
    }
    if (removed) {
      displayOrder.value = displayOrder.value.filter(key => itemMap.value.has(key))
    }
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  /** Reset the heartbeat watchdog timer. If it fires, the stream is treated as dropped. */
  function resetHeartbeatWatchdog() {
    if (heartbeatWatchdog) clearTimeout(heartbeatWatchdog)
    heartbeatWatchdog = setTimeout(() => {
      console.warn('[SSE] heartbeat timeout — reconnecting')
      dropStream()
    }, HEARTBEAT_TIMEOUT)
  }

  /**
   * The stream broke (an error, no heartbeat, or Dev Tools' "Drop SSE
   * connection"): close it, show the lost-connection banner and retry with backoff.
   */
  function dropStream() {
    connectFailed.value = true
    closeStream()
    scheduleRetry()
  }

  function closeStream() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (burstTimer) {
      clearTimeout(burstTimer)
      burstTimer = null
    }
    if (heartbeatWatchdog) {
      clearTimeout(heartbeatWatchdog)
      heartbeatWatchdog = null
    }
    bursting = false
    burstBuffer = []
    connectionState.value = 'closed'
  }

  function cancelRetry() {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    retryAt.value = null
  }

  function scheduleRetry() {
    cancelRetry()
    if (!wanted) return
    const base = Math.min(RETRY_MAX, RETRY_BASE * 2 ** retryAttempt)
    const delay = Math.round(base * (1 - RETRY_JITTER + Math.random() * RETRY_JITTER * 2))
    retryAttempt++
    retryAt.value = Date.now() + delay
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryAt.value = null
      openStream()
    }, delay)
  }

  // The announcement and the clock check load beside the stream, never before it
  async function loadAnnouncement() {
    try {
      announcement.value = await fetchAnnouncement(i18n.global.locale.value)
      injectLateAnnouncement()
    } catch {
      // No announcement this time; the next connect tries again
    }
  }

  async function calibrateClock() {
    try {
      clockOffset = (await fetchPing()).offset
    } catch {
      clockOffset = 0
    }
  }

  // Items already on screen survive a reconnect: the replayed burst is merged
  // into them, so the list does not blank out.
  function openStream() {
    if (eventSource) return
    cancelRetry()
    connectionState.value = 'connecting'

    const es = new EventSource(`${API_BASE}/realtime`)
    eventSource = es
    // Also covers a stream that never opens
    resetHeartbeatWatchdog()

    es.onopen = () => {
      connectionState.value = 'open'
      connectFailed.value = false
      retryAttempt = 0
      resetHeartbeatWatchdog()
      bursting = true
      if (burstTimer) clearTimeout(burstTimer)
      burstTimer = setTimeout(finalizeBurst, BURST_WINDOW)
      calibrateClock()
    }

    // The browser's own retry runs at a fixed interval; take over with backoff
    es.onerror = () => {
      if (es === eventSource) dropStream()
    }

    es.addEventListener('room', (e: MessageEvent) => {
      const room = parseRoom(parseJson(e.data))
      if (room) addRoom(room)
    })
    es.addEventListener('heartbeat', (e: MessageEvent) => {
      const serverTime = parseHeartbeat(parseJson(e.data))
      if (serverTime !== null) {
        lastHeartbeat.value = serverTime
        // Correct for clock skew: convert local time to server time, then diff
        const correctedNow = Date.now() + clockOffset
        latencyMs.value = Math.max(0, Math.round(correctedNow - serverTime))
        resetHeartbeatWatchdog()
      }
    })
    es.addEventListener('statistic', (e: MessageEvent) => {
      const stat = parseStatistic(parseJson(e.data))
      if (stat) updateStatistic(stat)
    })
  }

  function connect() {
    wanted = true
    retryAttempt = 0
    if (!sweepTimer) sweepTimer = setInterval(sweep, SWEEP_INTERVAL)
    openStream()
    loadAnnouncement()
  }

  function disconnect() {
    wanted = false
    cancelRetry()
    if (sweepTimer) {
      clearInterval(sweepTimer)
      sweepTimer = null
    }
    closeStream()
  }

  // Coming back online or to the tab: try at once instead of waiting out the backoff
  function retryNow() {
    if (wanted && retryAt.value !== null && document.visibilityState === 'visible') openStream()
  }

  // The store lives as long as the page, so these are never removed
  document.addEventListener('visibilitychange', retryNow)
  window.addEventListener('online', retryNow)

  // Re-fetch the announcement in the new language and update it in place
  watch(() => i18n.global.locale.value, async locale => {
    let next: Announcement
    try {
      next = await fetchAnnouncement(locale)
    } catch {
      return
    }
    if (locale !== i18n.global.locale.value) return
    announcement.value = next
    if (shownAnnouncement === null) return
    shownAnnouncement = announcementSignature(next)
    const shown = itemMap.value.get(ANNOUNCEMENT_KEY)
    if (!shown) return
    if (next.msg) {
      itemMap.value.set(ANNOUNCEMENT_KEY, { ...shown, msg: next.msg })
    } else {
      removeItem(ANNOUNCEMENT_KEY)
    }
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  function pinRoom(key: string, room: Room) {
    // A plain copy: the stored value is JSON, never a reactive proxy
    const { time, id, msg, name, source, info } = room
    pinnedRooms.value = { ...pinnedRooms.value, [key]: { room: { time, id, msg, name, source, info: { ...info } }, pinnedAt: Date.now() } }
  }

  function unpinRoom(key: string) {
    const saved = pinnedRooms.value[key]?.room
    dropPins(k => k !== key)
    const item = itemMap.value.get(key) ?? saved
    if (!item) return
    if (isExpired(item)) {
      removeItem(key)
    } else if (!itemMap.value.has(key)) {
      // Pinned before a reload and still fresh: carry on as a normal room
      itemMap.value.set(key, item)
      displayOrder.value = [key, ...displayOrder.value]
    }
  }

  const blockedList = computed(() =>
    Object.entries(blockedIds.value)
      .map(([id, until]) => ({ id, until }))
      .sort((a, b) => a.until - b.until),
  )

  function blockRoom(id: string) {
    blockedIds.value = { ...blockedIds.value, [id]: Date.now() + BLOCK_DURATION }
    // A blocked room should not stay pinned
    dropPins((_, entry) => entry.room.id !== id)
  }

  function unblockRoom(id: string) {
    const next = { ...blockedIds.value }
    delete next[id]
    blockedIds.value = next
  }

  // Drops ended blocks and sleeps until the next one ends. Runs on every change,
  // including ones made in another tab.
  let unblockTimer: ReturnType<typeof setTimeout> | null = null
  watch(blockedIds, blocks => {
    if (unblockTimer) clearTimeout(unblockTimer)
    unblockTimer = null
    const now = Date.now()
    const ended = Object.keys(blocks).filter(id => blocks[id] <= now)
    if (ended.length > 0) {
      const next = { ...blocks }
      for (const id of ended) delete next[id]
      blockedIds.value = next
      return
    }
    const nextEnd = Math.min(...Object.values(blocks))
    if (Number.isFinite(nextEnd)) {
      unblockTimer = setTimeout(() => { blockedIds.value = { ...blockedIds.value } }, nextEnd - now + 50)
    }
  }, { immediate: true, deep: true })

  function isPinned(key: string): boolean {
    return key in pinnedRooms.value
  }

  function toggleFocusMode() {
    focusMode.value = !focusMode.value
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    rooms,
    statistic,
    lastHeartbeat,
    latencyMs,
    connectionState,
    connectFailed,
    retryAt,
    announcement,
    focusMode,
    sidebarCollapsed,
    pinnedKeys,
    isDev,
    ready,
    displayItems,
    removeItem,
    blockedList,
    blockRoom,
    unblockRoom,
    pinRoom,
    unpinRoom,
    isPinned,
    connect,
    disconnect,
    dropStream,
    toggleFocusMode,
    toggleSidebar,
  }
})
