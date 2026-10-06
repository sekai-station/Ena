<script setup lang="ts">
import { ref } from 'vue'
import { useDismiss } from '@/composables/useDismiss'
import { useSettingsStore } from '@/stores/settings'
import SettingsPopup from './SettingsPopup.vue'
import IconSliders from '@/components/icons/IconSliders.vue'

const settingsStore = useSettingsStore()
const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)

useDismiss(root, isOpen)

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <Transition name="popup">
      <SettingsPopup v-if="isOpen" @close="close" />
    </Transition>

    <button
      class="w-12 h-12 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      :class="settingsStore.hasActiveFilters
        ? 'bg-primary-600 text-white hover:bg-primary-700'
        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'"
      @click="toggle"
      :title="$t('settings.title')"
      :aria-label="$t('settings.title')"
      aria-haspopup="dialog"
      data-tour="settings"
      :aria-expanded="isOpen"
    >
      <IconSliders class="w-5 h-5 transition-transform duration-300" :class="{ 'rotate-90': isOpen }" />
    </button>
  </div>
</template>

<style scoped>
.popup-enter-active { transition: all 0.2s ease-out; }
.popup-leave-active { transition: all 0.15s ease-in; }
.popup-enter-from { opacity: 0; transform: translateY(10px) scale(0.95); }
.popup-leave-to { opacity: 0; transform: translateY(10px) scale(0.95); }
</style>
