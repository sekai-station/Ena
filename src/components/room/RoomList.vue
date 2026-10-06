<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimestamp } from '@vueuse/core'
import { useRoomStore } from '@/stores/rooms'
import RoomItemWrapper from './RoomItemWrapper.vue'
import IconSpinner from '@/components/icons/IconSpinner.vue'
import IconEmptyInbox from '@/components/icons/IconEmptyInbox.vue'

const { t } = useI18n()
const roomStore = useRoomStore()

// Pinned rooms come from the browser, so they can show before the first load
const waiting = computed(() => !roomStore.ready && roomStore.displayItems.length === 0)

// Nothing has ever loaded and the connection is not coming up
const failed = computed(() => waiting.value && roomStore.connectFailed)

// Lost the stream after rooms were shown: say so until it is back
const lost = computed(() => !waiting.value && roomStore.connectFailed && roomStore.connectionState !== 'open')

// Ticks faster than the countdown's 1 s steps so the number is never a second stale;
// the text (and the banner) only re-renders when the number changes
const now = useTimestamp({ interval: 200 })
// "Retrying in N s" while waiting out the backoff, "Reconnecting…" during an attempt
const retryText = computed(() => {
  const at = roomStore.retryAt
  if (at === null) return t('connection.reconnecting')
  return t('connection.retryIn', { n: Math.max(1, Math.ceil((at - now.value) / 1000)) })
})
</script>

<template>
  <div>
    <!-- Could not connect -->
    <div v-if="failed" class="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 select-none" role="alert">
      <p class="text-sm">{{ t('connection.failed') }}</p>
      <p class="mt-1 text-xs tabular-nums" aria-live="polite">{{ retryText }}</p>
    </div>

    <!-- Loading -->
    <div v-else-if="waiting" class="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 select-none">
      <IconSpinner class="w-8 h-8 animate-spin mb-3" />
      <p class="text-sm">{{ t('rooms.loading') }}</p>
    </div>

    <template v-else>
      <!-- Connection lost after rooms were loaded -->
      <div
        v-if="lost"
        class="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-b border-red-100 dark:border-red-900/40 select-none"
        role="alert"
      >
        <span>{{ t('connection.disconnected') }}</span>
        <span class="tabular-nums" aria-live="polite">{{ retryText }}</span>
      </div>

      <!-- Empty -->
      <div v-if="roomStore.displayItems.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 select-none">
        <IconEmptyInbox class="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
        <p class="text-sm">{{ t('rooms.empty') }}</p>
      </div>

      <!-- Room stream -->
      <div v-else>
        <RoomItemWrapper
          v-for="{ key, item } in roomStore.displayItems"
          :key="key"
          :item-key="key"
          :item="item"
          @gone="roomStore.removeItem"
        />
      </div>
      <p v-if="!roomStore.ready" class="py-4 text-center text-xs text-gray-400 dark:text-gray-500 select-none">{{ t('rooms.loading') }}</p>
    </template>
  </div>
</template>
