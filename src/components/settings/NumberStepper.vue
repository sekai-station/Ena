<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: number
  min: number
  max: number
  step: number
  label: string
  digits?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const { t } = useI18n()

const shown = computed(() => props.modelValue.toFixed(props.digits ?? 0))

function nudge(direction: 1 | -1) {
  // Round to the step's precision so 1.2 + 0.1 does not drift to 1.3000000000000003
  const next = Math.round((props.modelValue + direction * props.step) * 100) / 100
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, next)))
}

const buttonClass = 'w-7 h-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors'
</script>

<template>
  <div class="inline-flex items-stretch h-7 rounded border border-gray-300 dark:border-gray-600 text-xs" role="group" :aria-label="label">
    <button :class="buttonClass" :disabled="modelValue <= min" :aria-label="`${label} ${t('settings.decrease')}`" @click="nudge(-1)">−</button>
    <span class="w-9 flex items-center justify-center border-x border-gray-300 dark:border-gray-600 tabular-nums text-gray-900 dark:text-gray-100" aria-live="polite">{{ shown }}</span>
    <button :class="buttonClass" :disabled="modelValue >= max" :aria-label="`${label} ${t('settings.increase')}`" @click="nudge(1)">+</button>
  </div>
</template>
