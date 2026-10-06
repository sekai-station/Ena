<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaQuery } from '@vueuse/core'
import type { Room } from '@/utils/types'
import { useRelativeTime } from '@/composables/useRelativeTime'
import { copyText } from '@/composables/useCopy'
import { useRoomStore } from '@/stores/rooms'
import { useTutorial, TUTORIAL_KEY } from '@/composables/useTutorial'
import { useSettingsStore } from '@/stores/settings'
import RoomBadge from '@/components/common/RoomBadge.vue'
import RoomActions from './RoomActions.vue'
import IconCheck from '@/components/icons/IconCheck.vue'
import { resolveBadge } from '@/utils/badges'

const props = defineProps<{
  room: Room
  roomKey: string
}>()

const emit = defineEmits<{ block: [] }>()

const { t } = useI18n()
const roomStore = useRoomStore()
const settingsStore = useSettingsStore()
const relativeTime = useRelativeTime(() => props.room.time)

// Focus mode: same card, tighter and without the avatar
const dense = computed(() => roomStore.focusMode)

// The avatar is loaded first and only inserted once it has arrived, so a
// missing or broken image never shows up as an empty circle. Narrow screens and
// focus mode do not show avatars, so nothing is downloaded there.
const wideScreen = useMediaQuery('(min-width: 640px)')
const avatarReady = ref(false)
watch(() => [props.room.info.avatar, wideScreen.value && !dense.value] as const, ([url, shown]) => {
  avatarReady.value = false
  if (!url || !shown) return
  const img = new Image()
  img.onload = () => { avatarReady.value = props.room.info.avatar === url }
  img.src = url
}, { immediate: true })
const badge = computed(() => resolveBadge(props.room))

// Sizes follow the font-size setting: name at the base size, message 2px
// larger, room ID 2px larger again.
const nameStyle = computed(() => ({
  fontSize: `${settingsStore.fontSize}px`,
}))

const roomIdStyle = computed(() => ({
  fontSize: `${settingsStore.fontSize + 4}px`,
}))

const msgStyle = computed(() => ({
  fontSize: `${settingsStore.fontSize + 2}px`,
  lineHeight: `${settingsStore.lineHeight}`,
}))


// ── Copy the room ID by clicking it ──────────────────────────────────────────
const COPIED_FEEDBACK_MS = 1500
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const isTutorial = computed(() => props.roomKey === TUTORIAL_KEY)
const tutorial = useTutorial()
const pinned = computed(() => isTutorial.value ? tutorial.examplePinned.value : roomStore.isPinned(props.roomKey))

async function copyId() {
  if (!(await copyText(props.room.id))) return
  if (isTutorial.value) tutorial.notifyCopy()
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, COPIED_FEEDBACK_MS)
}

// ── Hold the room ID to hide this room number for a while ────────────────────
// A short press is a click (copy). Holding for HOLD_MS blocks; releasing
// earlier, sliding away, or the page losing focus cancels without copying.
const HOLD_MS = 1000
const CLICK_MAX_MS = 400
const holding = ref(false)
let holdTimer: ReturnType<typeof setTimeout> | null = null
let holdStart = 0
let suppressClick = false

function stopHold() {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
  holding.value = false
  window.removeEventListener('blur', cancelHold)
  document.removeEventListener('visibilitychange', cancelHold)
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  // Touch pointers are captured by default; release so sliding off counts as leaving
  ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  suppressClick = false
  holdStart = Date.now()
  holding.value = true
  holdTimer = setTimeout(completeHold, HOLD_MS)
  window.addEventListener('blur', cancelHold)
  document.addEventListener('visibilitychange', cancelHold)
}

function onPointerUp() {
  if (!holding.value) return
  if (Date.now() - holdStart >= CLICK_MAX_MS) suppressClick = true
  stopHold()
}

function cancelHold() {
  if (!holding.value) return
  suppressClick = true
  stopHold()
}

function completeHold() {
  stopHold()
  suppressClick = true
  navigator.vibrate?.(30)
  emit('block')
}

function onIdClick() {
  if (suppressClick) {
    suppressClick = false
    return
  }
  copyId()
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
  stopHold()
})

// ── In whitelist mode, show why the room matched ─────────────────────────────
const msgSegments = computed(() => {
  const msg = props.room.msg
  const terms = settingsStore.allFilterTerms
  if (settingsStore.filterMode !== 'whitelist' || terms.length === 0) {
    return [{ text: msg, hit: false }]
  }
  const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const lowered = new Set(terms.map(term => term.toLowerCase()))
  return msg
    .split(new RegExp(`(${escaped.join('|')})`, 'gi'))
    .filter(Boolean)
    .map(text => ({ text, hit: lowered.has(text.toLowerCase()) }))
})
</script>

<template>
  <div
    class="flex items-start hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
    :class="[
      dense ? 'gap-2.5 px-3 py-1' : 'gap-2.5 sm:gap-3 px-3 sm:px-5 py-1.5',
      pinned ? 'bg-amber-50/50 dark:bg-amber-900/10 border-l-2 border-amber-400' : '',
    ]"
  >
    <!-- Room ID: click to copy, hold to hide this room number -->
    <button
      class="room-id relative flex-shrink-0 -mx-1.5 px-1.5 rounded-lg font-mono font-bold tabular-nums select-none transition-colors active:scale-95"
      :class="[dense ? 'leading-5' : 'leading-6', holding
        ? 'is-holding text-red-600 dark:text-red-400'
        : copied
          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
          : 'text-gray-900 dark:text-gray-100 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300']"
      :style="roomIdStyle"
      :title="t('rooms.idHint')"
      :data-tour="isTutorial ? 'demo-id' : undefined"
      :aria-label="`${t('rooms.copyId')} ${room.id}`"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointerleave="cancelHold"
      @pointercancel="cancelHold"
      @blur="cancelHold"
      @contextmenu.prevent
      @click="onIdClick"
    >
      <span class="hold-fill" aria-hidden="true" />
      <span class="relative">{{ room.id }}</span>
      <span
        v-if="copied"
        class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-600 text-white flex items-center justify-center"
      >
        <IconCheck class="w-2.5 h-2.5" />
      </span>
    </button>

    <div class="flex-1 min-w-0">
      <!-- Who and when, with the actions on the same line -->
      <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400" :class="dense ? 'h-5' : 'h-6'">
        <!-- Only once the avatar has loaded; none sent or broken: no element at all -->
        <img
          v-if="avatarReady && !dense"
          :src="room.info.avatar!"
          alt=""
          class="hidden sm:block flex-shrink-0 w-5 h-5 rounded-full object-cover"
        />
        <span class="font-medium font-content text-gray-800 dark:text-gray-200 truncate" :style="nameStyle">{{ room.name }}</span>
        <RoomBadge v-if="badge" :badge="badge" class="flex-shrink-0" />
        <span v-if="room.info.handle" class="truncate hidden sm:inline text-gray-400 dark:text-gray-500 select-none">{{ room.info.handle }}</span>
        <span class="ml-auto pl-1 flex-shrink-0 tabular-nums select-none">{{ relativeTime }}</span>
        <RoomActions :room="room" :room-key="roomKey" @block="emit('block')" />
      </div>

      <p
        v-if="room.msg"
        class="font-content text-gray-700 dark:text-gray-300 whitespace-pre-line break-words"
        :style="msgStyle"
      ><template v-for="(seg, i) in msgSegments" :key="i"><mark v-if="seg.hit" class="rounded-sm bg-primary-100 dark:bg-primary-900/60 text-inherit">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template></p>

    </div>
  </div>
</template>

<style scoped>
.room-id {
  -webkit-touch-callout: none;
}

/* Fills left to right while the room ID is held; snaps back when released */
.hold-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: theme('colors.red.500');
  opacity: 0.18;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.15s ease-out;
  pointer-events: none;
}
.is-holding .hold-fill {
  transform: scaleX(1);
  /* the delay keeps quick clicks from flashing; delay + duration = HOLD_MS */
  transition: transform 0.85s linear 0.15s;
}
</style>
