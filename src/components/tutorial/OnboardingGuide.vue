<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFloating, autoUpdate, offset, flip, shift, type Placement } from '@floating-ui/vue'
import { onKeyStroke } from '@vueuse/core'
import type { Room } from '@/utils/types'
import { useTutorial, TUTORIAL_KEY, TUTORIAL_ROOM_ID } from '@/composables/useTutorial'
import { useToast } from '@/composables/useToast'
import RoomCard from '@/components/room/RoomCard.vue'

interface Step {
  id: 'copy' | 'pin' | 'block' | 'settings' | 'focus'
  // Example steps run on the room card inside the box; the rest point at a
  // button on the page (matched by its data-tour attribute)
  target?: string
  placement?: Placement
}

const STEPS: Step[] = [
  { id: 'copy' },
  { id: 'pin' },
  { id: 'block' },
  { id: 'focus', target: 'focus', placement: 'left' },
  { id: 'settings', target: 'settings', placement: 'left-end' },
]
const SPOT_PADDING = 6
const BLOCK_PAUSE_MS = 700
// Example steps, and any step whose button cannot be found, use a centred box
const CENTERED = { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } as const

const { t } = useI18n()
const tutorial = useTutorial()
const toast = useToast()

const index = ref(0)
const step = computed(() => STEPS[index.value])
const isExampleStep = computed(() => !step.value.target)
const target = ref<HTMLElement | null>(null)
const hole = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const bubble = ref<HTMLElement | null>(null)
const welcomeStart = ref<HTMLElement | null>(null)

// ── The example room ─────────────────────────────────────────────────────────
const exampleTime = ref(0)
const exampleGone = ref(false)
const exampleRoom = computed<Room>(() => ({
  time: exampleTime.value,
  id: TUTORIAL_ROOM_ID,
  msg: t('tutorial.example'),
  name: t('app.title'),
  // Empty source details: nothing repeats the name and there is no original post to link to
  source: 'x',
  info: { handle: '', url: '', avatar: null },
}))

const { floatingStyles, isPositioned } = useFloating(target, bubble, {
  placement: computed(() => step.value.placement ?? 'bottom'),
  strategy: 'fixed',
  middleware: [offset(14), flip({ padding: 12 }), shift({ padding: 12 })],
  whileElementsMounted: autoUpdate,
})

// ── Following the highlighted button ─────────────────────────────────────────
let frame = 0

function track() {
  const sel = step.value.target
  const el = sel ? document.querySelector<HTMLElement>(`[data-tour="${sel}"]`) : null
  if (el !== target.value) target.value = el
  if (el) {
    const r = el.getBoundingClientRect()
    const next = { x: r.left - SPOT_PADDING, y: r.top - SPOT_PADDING, w: r.width + SPOT_PADDING * 2, h: r.height + SPOT_PADDING * 2 }
    const cur = hole.value
    if (!cur || cur.x !== next.x || cur.y !== next.y || cur.w !== next.w || cur.h !== next.h) hole.value = next
  } else if (hole.value) {
    hole.value = null
  }
  frame = requestAnimationFrame(track)
}

function stopTracking() {
  cancelAnimationFrame(frame)
  frame = 0
  target.value = null
  hole.value = null
}

// The dimmed area is four panels around the hole (or one panel when nothing
// is highlighted), so the page underneath cannot be clicked.
const panels = computed(() => {
  const h = hole.value
  if (!h) return [{ left: '0', top: '0', right: '0', bottom: '0' }]
  return [
    { left: '0', top: '0', right: '0', height: `${Math.max(0, h.y)}px` },
    { left: '0', top: `${h.y + h.h}px`, right: '0', bottom: '0' },
    { left: '0', top: `${h.y}px`, width: `${Math.max(0, h.x)}px`, height: `${h.h}px` },
    { left: `${h.x + h.w}px`, top: `${h.y}px`, right: '0', height: `${h.h}px` },
  ]
})

// ── Flow ─────────────────────────────────────────────────────────────────────
function startSteps() {
  exampleTime.value = Math.floor(Date.now() / 1000)
  exampleGone.value = false
  tutorial.examplePinned.value = false
  index.value = 0
  tutorial.start()
}

function cleanUp() {
  stopTracking()
  tutorial.examplePinned.value = false
}

function next() {
  if (index.value < STEPS.length - 1) {
    index.value++
  } else {
    cleanUp()
    tutorial.close('done')
  }
}

function exit() {
  cleanUp()
  tutorial.close('skipped')
}

// Holding the example (or using its menu) never touches the real block list:
// the card fades out, the usual toast shows, and the guide moves past the
// example steps.
function onExampleBlock() {
  if (exampleGone.value) return
  exampleGone.value = true
  toast.show(t('rooms.blocked', { id: TUTORIAL_ROOM_ID }))
  setTimeout(() => {
    if (tutorial.phase.value === 'steps') index.value = STEPS.findIndex(s => s.target)
  }, BLOCK_PAUSE_MS)
}

watch(() => tutorial.phase.value, async phase => {
  if (phase === 'steps') {
    if (!frame) frame = requestAnimationFrame(track)
  } else {
    stopTracking()
  }
  await nextTick()
  if (phase === 'welcome') welcomeStart.value?.focus()
})

watch(() => tutorial.copyCount.value, () => {
  if (tutorial.phase.value === 'steps' && step.value.id === 'copy') next()
})
watch(() => tutorial.examplePinned.value, pinned => {
  if (pinned && tutorial.phase.value === 'steps' && step.value.id === 'pin') next()
})

onKeyStroke('Escape', () => {
  // Escape inside the example card's menu closes that menu, not the guide
  if (tutorial.phase.value === 'off' || document.querySelector('[role="menu"]')) return
  if (tutorial.phase.value === 'welcome') tutorial.close('skipped')
  else exit()
})

onBeforeUnmount(() => {
  if (tutorial.phase.value === 'steps') cleanUp()
  else stopTracking()
})

const primary = 'px-3.5 h-8 rounded-md text-[13px] font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors'
const quiet = 'px-2 h-8 rounded-md text-[13px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors'
</script>

<template>
  <!-- Welcome box -->
  <Transition name="guide-fade">
    <div v-if="tutorial.phase.value === 'welcome'" class="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/45 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        class="w-[22rem] max-w-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl p-5 select-none"
      >
        <img src="/logo.png" alt="" class="w-8 h-8 mb-3" />
        <h2 id="guide-title" class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('tutorial.welcomeTitle') }}</h2>
        <p class="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{{ t('tutorial.welcomeBody') }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button :class="quiet" @click="tutorial.close('skipped')">{{ t('tutorial.skip') }}</button>
          <button ref="welcomeStart" :class="primary" @click="startSteps">{{ t('tutorial.start') }}</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Steps -->
  <template v-if="tutorial.phase.value === 'steps'">
    <div
      v-for="(style, i) in panels"
      :key="i"
      class="fixed z-[55] bg-gray-900/55"
      :style="style"
      aria-hidden="true"
    />
    <template v-if="hole">
      <!-- The highlighted button is shown but not pressable -->
      <div
        class="fixed z-[55]"
        :style="{ left: `${hole.x}px`, top: `${hole.y}px`, width: `${hole.w}px`, height: `${hole.h}px` }"
        aria-hidden="true"
      />
      <div
        class="guide-ring fixed z-[56] rounded-lg pointer-events-none"
        :style="{ left: `${hole.x}px`, top: `${hole.y}px`, width: `${hole.w}px`, height: `${hole.h}px` }"
        aria-hidden="true"
      />
    </template>

    <div
      ref="bubble"
      role="dialog"
      aria-live="polite"
      :aria-label="t(`tutorial.${step.id}Title`)"
      class="z-[65] max-w-[calc(100vw-24px)] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl p-4 select-none"
      :class="[isExampleStep ? 'w-[26rem]' : 'w-72', { invisible: target && !isPositioned }]"
      :style="target ? floatingStyles : CENTERED"
    >
      <p class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{{ t('tutorial.stepOf', { n: index + 1, total: STEPS.length }) }}</p>
      <h3 class="mt-0.5 text-[15px] font-semibold text-gray-900 dark:text-gray-100">{{ t(`tutorial.${step.id}Title`) }}</h3>
      <p class="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{{ t(`tutorial.${step.id}Body`) }}</p>

      <!-- The example room: the same card as in the feed, kept inside this box -->
      <div v-if="isExampleStep" class="guide-example mt-3 min-h-[3.5rem] rounded-md border border-gray-200 dark:border-gray-700" :data-step="step.id">
        <Transition name="guide-example">
          <RoomCard v-if="!exampleGone" :room="exampleRoom" :room-key="TUTORIAL_KEY" @block="onExampleBlock" />
        </Transition>
      </div>

      <p v-if="isExampleStep" class="mt-2 text-xs text-primary-700 dark:text-primary-400">{{ t('tutorial.autoNext') }}</p>
      <div class="mt-3 flex items-center justify-between gap-2">
        <button :class="quiet" class="-ml-2" @click="exit">{{ t('tutorial.exit') }}</button>
        <button v-if="isExampleStep" :class="quiet" @click="next">{{ t('tutorial.skipStep') }}</button>
        <button v-else :class="primary" @click="next">{{ index === STEPS.length - 1 ? t('tutorial.finish') : t('tutorial.next') }}</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.guide-ring {
  box-shadow: 0 0 0 2px theme('colors.primary.400');
  animation: guide-pulse 1.6s ease-in-out infinite;
}

/* Inside the example card, ring the part this step is about */
.guide-example[data-step='copy'] :deep([data-tour='demo-id']),
.guide-example[data-step='block'] :deep([data-tour='demo-id']),
.guide-example[data-step='pin'] :deep([data-tour='demo-pin']) {
  box-shadow: 0 0 0 2px theme('colors.primary.400');
  animation: guide-pulse 1.6s ease-in-out infinite;
}

@keyframes guide-pulse {
  50% { box-shadow: 0 0 0 5px rgba(53, 203, 189, 0.35); }
}

.guide-fade-enter-active, .guide-fade-leave-active { transition: opacity 0.18s ease; }
.guide-fade-enter-from, .guide-fade-leave-to { opacity: 0; }
.guide-example-leave-active { transition: opacity 0.18s ease-out, transform 0.18s ease-out; }
.guide-example-leave-to { opacity: 0; transform: scale(0.97); }

@media (prefers-reduced-motion: reduce) {
  .guide-ring,
  .guide-example :deep([data-tour]) { animation: none; }
}
</style>
