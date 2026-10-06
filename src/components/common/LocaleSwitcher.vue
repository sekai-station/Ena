<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALES, setLocale, type AppLocale } from '@/i18n'
import { useDismiss } from '@/composables/useDismiss'
import IconGlobe from '@/components/icons/IconGlobe.vue'
import IconChevronDown from '@/components/icons/IconChevronDown.vue'
import IconCheck from '@/components/icons/IconCheck.vue'

const { locale } = useI18n()
const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)

useDismiss(root, isOpen)

const currentLabel = () => LOCALES.find(l => l.code === locale.value)?.label ?? locale.value

function choose(code: AppLocale) {
  setLocale(code)
  isOpen.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <!-- Trigger with globe icon -->
    <button
      class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <IconGlobe class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <span class="flex-1 text-left">{{ currentLabel() }}</span>
      <IconChevronDown class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div v-if="isOpen" role="listbox" class="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
        <button
          v-for="loc in LOCALES"
          :key="loc.code"
          class="w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors"
          :class="locale === loc.code ? 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
          role="option"
          :aria-selected="locale === loc.code"
          :lang="loc.code"
          @click="choose(loc.code)"
        >
          <span>{{ loc.label }}</span>
          <IconCheck v-if="locale === loc.code" class="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active { transition: all 0.15s ease-out; }
.dropdown-leave-active { transition: all 0.1s ease-in; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(4px); }
</style>
