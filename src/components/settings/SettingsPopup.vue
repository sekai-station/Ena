<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import FilterSetting from './FilterSetting.vue'
import DisplaySetting from './DisplaySetting.vue'
import IconClose from '@/components/icons/IconClose.vue'

const { t } = useI18n()
defineEmits<{ close: [] }>()
</script>

<template>
  <div
    role="dialog"
    :aria-label="t('settings.title')"
    class="absolute bottom-14 right-0 md:bottom-0 md:right-14 w-[19rem] max-w-[calc(100vw-2rem)] max-h-[72vh] flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg select-none"
  >
    <div class="flex items-center justify-between h-10 pl-3.5 pr-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <h3 class="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{{ t('settings.title') }}</h3>
      <button
        class="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
        :title="t('a11y.close')"
        :aria-label="t('a11y.close')"
        @click="$emit('close')"
      >
        <IconClose class="w-4 h-4" />
      </button>
    </div>
    <div class="overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
      <FilterSetting />
      <DisplaySetting />
    </div>
  </div>
</template>
