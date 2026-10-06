<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import SegmentedControl from './SegmentedControl.vue'
import NumberStepper from './NumberStepper.vue'

const { t } = useI18n()
const settings = useSettingsStore()

const EXPIRE_CHOICES = [30, 60, 120, 180, 300, 600]

// A value saved by the old slider may not be one of the choices; keep it listed
const expireChoices = computed(() =>
  [...new Set([...EXPIRE_CHOICES, settings.expireTime])].sort((a, b) => a - b),
)

function durationLabel(seconds: number): string {
  return seconds < 60
    ? t('settings.durationSeconds', { n: seconds })
    : t('settings.durationMinutes', { n: Math.round((seconds / 60) * 10) / 10 })
}

const onOffOptions = computed(() => [
  { value: 'on', label: t('settings.on') },
  { value: 'off', label: t('settings.off') },
])

const themeOptions = computed(() => [
  { value: 'system' as ThemeMode, label: t('settings.themeSystem') },
  { value: 'light' as ThemeMode, label: t('settings.themeLight') },
  { value: 'dark' as ThemeMode, label: t('settings.themeDark') },
])

const row = 'flex items-center justify-between gap-3 min-h-[2rem]'
const label = 'text-[13px] text-gray-700 dark:text-gray-300'
</script>

<template>
  <section class="px-3.5 py-3 space-y-1.5">
    <h4 class="text-[11px] font-semibold tracking-wider text-gray-400 dark:text-gray-500 pb-1">{{ t('settings.display') }}</h4>

    <div :class="row">
      <label for="expire-select" :class="label">{{ t('settings.expireTime') }}</label>
      <select
        id="expire-select"
        class="h-7 pl-2 pr-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
        :value="settings.expireTime"
        @change="settings.setExpireTime(Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="s in expireChoices" :key="s" :value="s">{{ durationLabel(s) }}</option>
      </select>
    </div>

    <div :class="row">
      <span :class="label">{{ t('settings.fontSize') }}</span>
      <NumberStepper
        :model-value="settings.fontSize"
        :min="12"
        :max="20"
        :step="1"
        :label="t('settings.fontSize')"
        @update:model-value="settings.setFontSize"
      />
    </div>

    <div :class="row">
      <span :class="label">{{ t('settings.lineHeight') }}</span>
      <NumberStepper
        :model-value="settings.lineHeight"
        :min="1.2"
        :max="2"
        :step="0.1"
        :digits="1"
        :label="t('settings.lineHeight')"
        @update:model-value="settings.setLineHeight"
      />
    </div>

    <div :class="row">
      <span :class="label">{{ t('settings.animatedBackground') }}</span>
      <SegmentedControl
        :model-value="settings.animatedBackground ? 'on' : 'off'"
        :options="onOffOptions"
        :label="t('settings.animatedBackground')"
        @update:model-value="v => settings.setAnimatedBackground(v === 'on')"
      />
    </div>

    <div :class="row">
      <span :class="label">{{ t('settings.theme') }}</span>
      <SegmentedControl
        :model-value="settings.themeMode"
        :options="themeOptions"
        :label="t('settings.theme')"
        @update:model-value="settings.setThemeMode"
      />
    </div>
  </section>
</template>
