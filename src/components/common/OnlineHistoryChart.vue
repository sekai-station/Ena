<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OnlineHour } from '@/utils/types'
import { onlineHourSlots } from '@/utils/online-history'

const props = defineProps<{ history: OnlineHour[] }>()
const { t, locale } = useI18n()
const hours = computed(() => onlineHourSlots(props.history))
const ceiling = computed(() => Math.max(4, Math.ceil(Math.max(...hours.value.map(h => h.peak ?? 0), 0) / 4) * 4))
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => ceiling.value * i / 4))
const x = (index: number) => 36 + index / 47 * 592
const y = (value: number) => 148 - value / ceiling.value * 136

function line(field: 'peak' | 'average'): string {
  let connected = false
  return hours.value.map((hour, index) => {
    const value = hour[field]
    if (value === null) { connected = false; return '' }
    const command = connected ? 'L' : 'M'
    connected = true
    return `${command}${x(index)},${y(value)}`
  }).join(' ')
}

function timeLabel(hour: number): string {
  return new Date(hour * 1000).toLocaleString(locale.value, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

function tooltip(hour: typeof hours.value[number]): string {
  const date = new Date(hour.hour * 1000).toLocaleString(locale.value, { hour12: false })
  const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
  return `${date}\n${t('status.hourlyPeak')}: ${number(hour.peak)}\n${t('status.hourlyAverage')}: ${number(hour.average)}`
}
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('status.onlineHistory') }}</h2>
      <div class="flex gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span class="flex items-center gap-1.5"><span class="w-3 border-t-2 border-blue-500" />{{ t('status.hourlyPeak') }}</span>
        <span class="flex items-center gap-1.5"><span class="w-2 h-2 bg-emerald-500 rounded-sm" />{{ t('status.hourlyAverage') }}</span>
      </div>
    </div>
    <p v-if="hours.length === 0" class="text-sm text-gray-400 dark:text-gray-500 text-center py-12">{{ t('status.noOnlineData') }}</p>
    <svg v-else viewBox="0 0 640 180" class="w-full overflow-visible" role="img" :aria-label="t('status.onlineHistory')">
      <g v-for="tick in ticks" :key="tick">
        <line x1="36" x2="628" :y1="y(tick)" :y2="y(tick)" class="stroke-gray-100 dark:stroke-gray-800" vector-effect="non-scaling-stroke" />
        <text x="26" :y="y(tick) + 3" text-anchor="end" class="fill-gray-400 dark:fill-gray-500 text-[10px]">{{ tick }}</text>
      </g>
      <template v-for="(hour, index) in hours" :key="`average-${hour.hour}`">
        <rect v-if="hour.average !== null" :x="x(index) - 4" :y="y(hour.average)" width="8" :height="148 - y(hour.average)" rx="2" class="fill-emerald-500/70" />
      </template>
      <path :d="line('peak')" fill="none" class="stroke-blue-500" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <g v-for="(hour, index) in hours" :key="hour.hour">
        <circle v-if="hour.peak !== null" :cx="x(index)" :cy="y(hour.peak)" r="2.5" class="fill-blue-500" />
        <rect :x="x(index) - 6" y="8" width="12" height="144" fill="transparent"><title>{{ tooltip(hour) }}</title></rect>
        <text v-if="[0, 12, 24, 36, 47].includes(index)" :x="x(index)" y="172" :text-anchor="index === 0 ? 'start' : index === 47 ? 'end' : 'middle'" class="fill-gray-400 dark:fill-gray-500 text-[10px]">{{ timeLabel(hour.hour) }}</text>
      </g>
    </svg>
  </section>
</template>
