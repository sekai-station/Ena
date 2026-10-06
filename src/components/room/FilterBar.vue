<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import IconClose from '@/components/icons/IconClose.vue'

const { t } = useI18n()
const settings = useSettingsStore()
const scrollEl = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(true)

let isDragging = false
let startX = 0
let startScroll = 0

function updateEdges() {
  const el = scrollEl.value
  if (!el) return
  atStart.value = el.scrollLeft <= 2
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
}

function onMouseDown(e: MouseEvent) {
  const el = scrollEl.value
  if (!el) return
  isDragging = false
  startX = e.clientX
  startScroll = el.scrollLeft
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!scrollEl.value) return
  const dx = e.clientX - startX
  if (!isDragging && Math.abs(dx) > 3) isDragging = true
  if (isDragging) {
    scrollEl.value.scrollLeft = startScroll - dx
  }
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  setTimeout(() => { isDragging = false }, 0)
  startX = 0
}

function onTagClick(term: string) {
  if (isDragging) return
  if (settings.filterTags.includes(term)) {
    settings.toggleTag(term)
  } else {
    settings.removeKeyword(term)
  }
}

let observer: ResizeObserver | null = null

onMounted(() => {
  updateEdges()
  if (scrollEl.value) {
    observer = new ResizeObserver(updateEdges)
    observer.observe(scrollEl.value)
  }
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div v-if="settings.allFilterTerms.length > 0" class="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
    <div class="relative">
      <div
        v-show="!atStart"
        class="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none"
        style="background: linear-gradient(to right, var(--mask-bg), transparent);"
      />
      <div
        v-show="!atEnd"
        class="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none"
        style="background: linear-gradient(to left, var(--mask-bg), transparent);"
      />

      <div
        ref="scrollEl"
        class="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-none select-none"
        style="cursor: grab;"
        @scroll="updateEdges"
        @mousedown.prevent="onMouseDown"
      >
        <button
          v-for="term in settings.allFilterTerms"
          :key="term"
          class="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors"
          :class="settings.filterMode === 'blacklist'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'"
          :aria-label="t('a11y.removeFilter', { name: term })"
          @click="onTagClick(term)"
        >
          {{ term }}
          <IconClose class="w-3 h-3 opacity-50" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
