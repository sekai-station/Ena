<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import type { StreamItem } from '@/utils/types'
import { isAnnouncement } from '@/utils/types'
import { useSettingsStore } from '@/stores/settings'
import { useRoomStore } from '@/stores/rooms'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import RoomCard from './RoomCard.vue'
import AnnouncementCard from './AnnouncementCard.vue'

const props = defineProps<{
  itemKey: string
  item: StreamItem
}>()

const emit = defineEmits<{ gone: [itemKey: string] }>()
const settings = useSettingsStore()
const roomStore = useRoomStore()
const el = ref<HTMLElement | null>(null)

const pinned = computed(() => roomStore.isPinned(props.itemKey))

const LIVE_FLASH_MAX_AGE = 5

let leaveAnim: Animation | null = null
let expiryTimer: ReturnType<typeof setTimeout> | null = null

function scheduleExpiry() {
  if (leaveAnim || pinned.value) return
  clearTimer()
  const now = Math.floor(Date.now() / 1000)
  const remaining = (props.item.time + settings.expireTime - now) * 1000
  if (remaining <= 0) {
    startLeave()
  } else {
    expiryTimer = setTimeout(startLeave, remaining)
  }
}

function clearTimer() {
  if (expiryTimer) {
    clearTimeout(expiryTimer)
    expiryTimer = null
  }
}

// Expiry fades out slowly; a block should take effect the moment the hold
// completes, so it uses a short exit.
function startLeave(onDone?: () => void, quick = false) {
  if (!el.value || leaveAnim) return

  const height = el.value.getBoundingClientRect().height
  el.value.style.overflow = 'hidden'

  leaveAnim = el.value.animate([
    { opacity: 1, maxHeight: `${height}px`, borderBottomWidth: '1px' },
    { opacity: 0, maxHeight: `${height}px`, borderBottomWidth: '1px', offset: 0.5 },
    { opacity: 0, maxHeight: '0px', borderBottomWidth: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' },
  ], {
    duration: quick ? 180 : 600,
    easing: quick ? 'ease-out' : 'ease-in',
    fill: 'forwards',
  })

  leaveAnim.onfinish = () => {
    if (onDone) onDone()
    else emit('gone', props.itemKey)
  }
}

// ── Hide every room with this room number for a while ────────────────────────
const { t } = useI18n()
const toast = useToast()
let pendingBlock = false

function block() {
  if (isAnnouncement(props.item) || pendingBlock) return
  pendingBlock = true
  clearTimer()
  // Already leaving because it expired: no animation to wait for
  if (leaveAnim) finishBlock()
  else startLeave(finishBlock, true)
}

function finishBlock() {
  if (!pendingBlock || isAnnouncement(props.item)) return
  pendingBlock = false
  const id = props.item.id
  roomStore.blockRoom(id)
  toast.show(t('rooms.blocked', { id }), 'success', {
    label: t('rooms.undo'),
    run: () => roomStore.unblockRoom(id),
  })
}

function dismiss() {
  startLeave()
}

onMounted(() => {
  if (!el.value) return

  // Enter animation — runs once, managed by JS so DOM moves don't reset it
  const enterAnim = el.value.animate([
    { opacity: 0, transform: 'translateY(-6px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], {
    duration: 350,
    easing: 'ease-out',
    fill: 'forwards',
  })
  enterAnim.onfinish = () => enterAnim.cancel()

  // Rooms that arrive live (not replayed in the initial burst) flash briefly
  if (!isAnnouncement(props.item) && Date.now() / 1000 - props.item.time < LIVE_FLASH_MAX_AGE) {
    el.value.animate([
      { backgroundColor: 'var(--flash-bg)' },
      { backgroundColor: 'transparent' },
    ], { duration: 1600, easing: 'ease-out' })
  }

  scheduleExpiry()
})

watch(() => settings.expireTime, scheduleExpiry)

// When unpinned, re-schedule expiry (may fire immediately if already expired)
// When pinned, clear any running timer
watch(pinned, (isPinned) => {
  if (isPinned) {
    clearTimer()
  } else {
    scheduleExpiry()
  }
})

onBeforeUnmount(() => {
  // Unmounted mid-animation: still apply the block
  finishBlock()
  clearTimer()
  if (leaveAnim) {
    leaveAnim.cancel()
    leaveAnim = null
  }
})
</script>

<template>
  <div
    ref="el"
    class="border-b border-gray-100 dark:border-gray-800"
  >
    <AnnouncementCard v-if="isAnnouncement(item)" :msg="item.msg" @dismiss="dismiss" />
    <RoomCard v-else :room="item" :room-key="itemKey" @block="block" />
  </div>
</template>
