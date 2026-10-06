<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/vue'
import { onClickOutside, useTimestamp } from '@vueuse/core'
import { useRoomStore } from '@/stores/rooms'
import IconChevronLeft from '@/components/icons/IconChevronLeft.vue'

const { t } = useI18n()
const roomStore = useRoomStore()
const open = ref(false)
const anchor = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const now = useTimestamp({ interval: 15_000 })

// Fixed positioning so the menu is not clipped by the settings panel's scroll area
const { floatingStyles, isPositioned } = useFloating(anchor, menu, {
  placement: 'left-start',
  strategy: 'fixed',
  middleware: [offset(10), flip({ fallbackPlacements: ['top-end', 'bottom-end'], padding: 8 }), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

onClickOutside(menu, () => { open.value = false }, { ignore: [anchor] })

// Escape closes only this menu, not the settings panel behind it
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    open.value = false
    anchor.value?.focus()
  }
}

function minutesLeft(until: number): number {
  return Math.max(1, Math.ceil((until - now.value) / 60_000))
}

function unblockAll() {
  for (const b of roomStore.blockedList) roomStore.unblockRoom(b.id)
}
</script>

<template>
  <div @keydown="onKeydown">
    <button
      ref="anchor"
      class="w-full flex items-center justify-between gap-3 min-h-[2rem] -mx-1.5 px-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      :class="{ 'bg-gray-100 dark:bg-gray-800': open }"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="text-[13px] text-gray-700 dark:text-gray-300">{{ t('settings.blockedRooms') }}</span>
      <span class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <span
          v-if="roomStore.blockedList.length > 0"
          class="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 font-medium tabular-nums flex items-center justify-center"
        >{{ roomStore.blockedList.length }}</span>
        <IconChevronLeft class="w-3.5 h-3.5 rotate-180" />
      </span>
    </button>

    <Transition name="submenu">
      <div
        v-if="open"
        ref="menu"
        role="menu"
        :aria-label="t('settings.blockedRooms')"
        class="z-10 w-56 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg py-1"
        :class="{ invisible: !isPositioned }"
        :style="floatingStyles"
      >
        <div class="px-3 pt-1.5 pb-2 border-b border-gray-100 dark:border-gray-800">
          <p class="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{{ t('settings.blockedRooms') }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('settings.blockedHint') }}</p>
        </div>

        <p v-if="roomStore.blockedList.length === 0" class="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.blockedEmpty') }}
        </p>

        <ul v-else class="max-h-60 overflow-y-auto py-1">
          <li v-for="b in roomStore.blockedList" :key="b.id" class="flex items-center gap-2 pl-3 pr-1.5 h-9">
            <span class="font-mono font-bold text-[15px] text-gray-900 dark:text-gray-100 tabular-nums">{{ b.id }}</span>
            <span class="flex-1 text-xs text-gray-400 dark:text-gray-500">{{ t('settings.minutesLeft', { n: minutesLeft(b.until) }) }}</span>
            <button
              role="menuitem"
              class="px-2 h-7 rounded text-xs text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors"
              :aria-label="t('settings.unblock', { id: b.id })"
              @click="roomStore.unblockRoom(b.id)"
            >
              {{ t('settings.unblockOne') }}
            </button>
          </li>
        </ul>

        <div v-if="roomStore.blockedList.length > 1" class="border-t border-gray-100 dark:border-gray-800 px-1.5 pt-1">
          <button
            role="menuitem"
            class="w-full h-8 px-1.5 rounded text-left text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            @click="unblockAll"
          >
            {{ t('settings.unblockAll') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.submenu-enter-active { transition: opacity 0.12s ease-out; }
.submenu-leave-active { transition: opacity 0.08s ease-in; }
.submenu-enter-from, .submenu-leave-to { opacity: 0; }
</style>
