<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDocumentVisibility } from '@vueuse/core'
import type { StatusData } from '@/utils/types'
import { fetchStatus } from '@/utils/api'
import IconSpinner from '@/components/icons/IconSpinner.vue'

const REFRESH_SECONDS = 10

const { t, locale } = useI18n()
const visibility = useDocumentVisibility()

const status = ref<StatusData | null>(null)
const loading = ref(true)
const error = ref('')
const updatedAt = ref<Date | null>(null)
let inFlight = false
let timer: ReturnType<typeof setInterval> | null = null

// Refreshes quietly: the figures on screen stay until new ones arrive, and a
// failed refresh keeps showing the last good data
async function load() {
  if (inFlight) return
  inFlight = true
  try {
    status.value = await fetchStatus()
    updatedAt.value = new Date()
    error.value = ''
  } catch (e) {
    if (!status.value) error.value = (e as Error).message
  } finally {
    inFlight = false
    loading.value = false
  }
}

function startRefreshing() {
  stopRefreshing()
  timer = setInterval(load, REFRESH_SECONDS * 1000)
}

function stopRefreshing() {
  if (timer) clearInterval(timer)
  timer = null
}

onMounted(() => {
  load()
  startRefreshing()
})

// No refreshing while the tab is hidden; catch up as soon as it is back
watch(visibility, v => {
  if (v === 'visible') {
    load()
    startRefreshing()
  } else {
    stopRefreshing()
  }
})

onBeforeUnmount(stopRefreshing)

const updatedText = computed(() =>
  updatedAt.value ? updatedAt.value.toLocaleTimeString(locale.value, { hour12: false }) : '',
)

function getMaxTick(ticks: number[]): number {
  return Math.max(1, ...ticks)
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <!-- Page header -->
    <div class="px-4 sm:px-6 py-4 sm:py-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div class="flex items-baseline justify-between gap-3 flex-wrap select-none">
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ t('status.title') }}</h1>
        <p class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          {{ t('status.autoRefresh', { n: REFRESH_SECONDS }) }}<template v-if="updatedText"> · {{ t('status.updatedAt', { time: updatedText }) }}</template>
        </p>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-900 px-4 sm:px-6 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <IconSpinner class="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-20">
        <p class="text-red-500 dark:text-red-400 text-sm">{{ error }}</p>
      </div>

      <template v-else-if="status">
        <!-- Past count cards -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 select-none">{{ t('status.pastCount') }}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center select-none">
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ status.pastCount.past15m }}</div>
              <div class="text-xs text-blue-500 dark:text-blue-400/80 mt-1">{{ t('stats.past15m') }}</div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center select-none">
              <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ status.pastCount.past1h }}</div>
              <div class="text-xs text-green-500 dark:text-green-400/80 mt-1">{{ t('stats.past1h') }}</div>
            </div>
            <div class="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center select-none">
              <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ status.pastCount.past24h }}</div>
              <div class="text-xs text-purple-500 dark:text-purple-400/80 mt-1">{{ t('stats.past24h') }}</div>
            </div>
          </div>
        </div>

        <!-- Channel health -->
        <div>
          <h2 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 select-none">{{ t('status.channelHealth') }}</h2>
          <div v-if="status.channelHealth.length === 0" class="text-sm text-gray-400 dark:text-gray-500 text-center py-8 select-none">
            {{ t('status.noChannelData') }}
          </div>
          <div
            v-for="channel in status.channelHealth"
            :key="channel.name"
            class="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
          >
            <div class="flex items-center justify-between mb-2 select-none">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ channel.name }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">
                {{ channel.tick.reduce((a, b) => a + b, 0) }} {{ t('stats.rooms') }}
              </span>
            </div>
            <!-- Sparkline bar chart -->
            <div class="flex items-end gap-px h-12">
              <div
                v-for="(val, idx) in channel.tick"
                :key="idx"
                class="flex-1 bg-primary-400 dark:bg-primary-500 rounded-t-sm transition-all hover:bg-primary-600 dark:hover:bg-primary-300"
                :style="{ height: `${(val / getMaxTick(channel.tick)) * 100}%`, minHeight: val > 0 ? '2px' : '0' }"
                :title="`${val} ${t('status.perMinute')}`"
              />
            </div>
            <div class="flex justify-between text-xs text-gray-300 dark:text-gray-600 mt-1 select-none">
              <span>-60m</span>
              <span>{{ t('status.now') }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
