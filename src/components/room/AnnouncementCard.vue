<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import IconClose from '@/components/icons/IconClose.vue'
import IconInfo from '@/components/icons/IconInfo.vue'

defineProps<{ msg: string }>()
const emit = defineEmits<{ dismiss: [] }>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

const msgStyle = computed(() => ({
  fontSize: `${settingsStore.fontSize}px`,
  lineHeight: `${settingsStore.lineHeight}`,
}))
</script>

<template>
  <div class="relative px-3 sm:px-5 py-2 bg-primary-50/50 dark:bg-primary-900/20 border-l-4 border-primary-400">
    <button
      class="absolute top-1.5 right-1.5 p-1 rounded-md text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800/40 transition-colors"
      :title="t('a11y.close')"
      :aria-label="t('a11y.close')"
      @click="emit('dismiss')"
    >
      <IconClose class="w-3.5 h-3.5" />
    </button>
    <div class="flex items-center gap-2 mb-0.5 select-none">
      <IconInfo class="w-4 h-4 text-primary-600 dark:text-primary-400" />
      <span class="text-xs font-medium text-primary-700 dark:text-primary-400">{{ t('announcement.title') }}</span>
    </div>
    <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words leading-relaxed pr-6" :style="msgStyle">{{ msg }}</p>
  </div>
</template>
