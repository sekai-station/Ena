<script setup lang="ts">
import type { BadgeDef } from '@/utils/badges'

defineProps<{
  badge: BadgeDef
}>()
</script>

<template>
  <span
    class="inline-flex items-center justify-center px-1.5 rounded text-[9px] leading-none font-medium select-none h-4"
    :class="[badge.class, badge.darkClass]"
    :style="badge.style"
  >
    {{ badge.label }}
  </span>
</template>
