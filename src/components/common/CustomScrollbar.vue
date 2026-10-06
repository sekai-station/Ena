<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const viewport = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)

const thumbHeight = ref(0)
const thumbTop = ref(0)
const visible = ref(false)
const isDragging = ref(false)

let hideTimer: ReturnType<typeof setTimeout> | null = null
let dragStartY = 0
let dragStartScrollTop = 0

function updateThumb() {
  const el = viewport.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  if (scrollHeight <= clientHeight) {
    thumbHeight.value = 0
    return
  }
  thumbHeight.value = (clientHeight / scrollHeight) * 100
  thumbTop.value = (scrollTop / scrollHeight) * 100
}

function onScroll() {
  updateThumb()
  showThumb()
}

function showThumb() {
  visible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  if (!isDragging.value) {
    hideTimer = setTimeout(() => { visible.value = false }, 1200)
  }
}

function scheduleHide() {
  if (isDragging.value) return
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { visible.value = false }, 600)
}

function onThumbPointerDown(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
  dragStartY = e.clientY
  dragStartScrollTop = viewport.value?.scrollTop ?? 0
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', onDragEnd)
  document.addEventListener('pointercancel', onDragEnd)
  document.body.style.userSelect = 'none'
}

function onDragMove(e: PointerEvent) {
  const el = viewport.value
  const trackEl = track.value
  if (!el || !trackEl) return
  const deltaY = e.clientY - dragStartY
  const trackHeight = trackEl.clientHeight
  const scrollRatio = deltaY / trackHeight
  el.scrollTop = dragStartScrollTop + scrollRatio * el.scrollHeight
}

function onDragEnd() {
  isDragging.value = false
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onDragEnd)
  document.removeEventListener('pointercancel', onDragEnd)
  document.body.style.userSelect = ''
  scheduleHide()
}

function onTrackClick(e: PointerEvent) {
  const el = viewport.value
  const trackEl = track.value
  if (!el || !trackEl) return
  e.preventDefault()
  const rect = trackEl.getBoundingClientRect()
  const clickRatio = (e.clientY - rect.top) / rect.height
  el.scrollTop = clickRatio * el.scrollHeight - el.clientHeight / 2
}

let viewportObserver: ResizeObserver | null = null
let contentObserver: ResizeObserver | null = null

onMounted(() => {
  updateThumb()
  if (viewport.value) {
    viewportObserver = new ResizeObserver(() => nextTick(updateThumb))
    viewportObserver.observe(viewport.value)
  }
  if (content.value) {
    contentObserver = new ResizeObserver(() => nextTick(updateThumb))
    contentObserver.observe(content.value)
  }
})

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer)
  if (viewportObserver) viewportObserver.disconnect()
  if (contentObserver) contentObserver.disconnect()
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onDragEnd)
  document.removeEventListener('pointercancel', onDragEnd)
})
</script>

<template>
  <div
    class="relative overflow-hidden h-full"
    @mouseenter="showThumb()"
    @mouseleave="scheduleHide()"
  >
    <div ref="viewport" class="scroll-viewport h-full overflow-y-scroll" @scroll="onScroll">
      <div ref="content">
        <slot />
      </div>
    </div>
    <div
      v-show="thumbHeight > 0"
      ref="track"
      class="absolute top-0 right-0 bottom-0 w-2 z-20"
      aria-hidden="true"
      @pointerdown="onTrackClick"
    >
      <div
        class="scroll-thumb absolute right-px rounded-full transition-opacity duration-300"
        :class="[
          visible || isDragging ? 'opacity-100' : 'opacity-0',
          isDragging ? 'is-dragging' : ''
        ]"
        :style="{ height: thumbHeight + '%', top: thumbTop + '%', minHeight: '30px', width: '6px' }"
        @pointerdown="onThumbPointerDown"
      />
    </div>
  </div>
</template>

<style scoped>
.scroll-viewport {
  scrollbar-width: none;
}
.scroll-viewport::-webkit-scrollbar {
  display: none;
}

.scroll-thumb {
  background: var(--scroll-thumb);
  cursor: default;
  touch-action: none;
  transition: opacity 0.3s ease, background 0.15s ease;
}
.scroll-thumb:hover,
.scroll-thumb.is-dragging {
  background: var(--scroll-thumb-active);
}
</style>
