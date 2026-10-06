<script setup lang="ts" generic="T extends string">
defineProps<{
  options: { value: T; label: string; title?: string }[]
  modelValue: T
  label: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div
    class="inline-flex h-7 rounded border border-gray-300 dark:border-gray-600 overflow-hidden text-xs"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      class="px-2.5 transition-colors"
      :class="[
        i > 0 ? 'border-l border-gray-300 dark:border-gray-600' : '',
        opt.value === modelValue
          ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/40 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
      ]"
      role="radio"
      :aria-checked="opt.value === modelValue"
      :title="opt.title"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
