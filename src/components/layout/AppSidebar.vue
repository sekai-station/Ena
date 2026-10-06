<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useRoomStore } from '@/stores/rooms'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import { MULTI_LOCALE } from '@/i18n'
import IconUser from '@/components/icons/IconUser.vue'
import IconRooms from '@/components/icons/IconRooms.vue'
import IconInfo from '@/components/icons/IconInfo.vue'
import IconStatus from '@/components/icons/IconStatus.vue'
import IconChevronLeft from '@/components/icons/IconChevronLeft.vue'

// Set per build (VITE_FOOTER); empty means no footer
const FOOTER_LINES = __FOOTER__.split('\n').map(line => line.trim()).filter(Boolean)
const { t } = useI18n()
const route = useRoute()
const roomStore = useRoomStore()

defineProps<{ collapsible?: boolean }>()
defineEmits<{ close: [] }>()

const navItems = [
  { name: 'rooms', icon: 'rooms', path: '/' },
  { name: 'about', icon: 'about', path: '/about' },
  { name: 'status', icon: 'status', path: '/status' },
]
</script>

<template>
  <aside class="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen select-none">
    <!-- Logo -->
    <div class="flex items-center justify-between pl-5 pr-3 py-5 bg-gradient-to-b from-primary-500/10 to-transparent">
      <router-link to="/" class="flex items-center gap-2 min-w-0" @click="$emit('close')">
        <img src="/logo.png" alt="" class="w-5 h-5 object-contain" />
        <span class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{{ t('app.title') }}</span>
      </router-link>
      <button
        v-if="collapsible"
        class="flex-shrink-0 p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        :title="t('a11y.toggleSidebar')"
        :aria-label="t('a11y.toggleSidebar')"
        aria-expanded="true"
        @click="roomStore.toggleSidebar()"
      >
        <IconChevronLeft class="w-4 h-4" />
      </button>
    </div>

    <!-- Connection + stats -->
    <div class="px-5 pb-3">
      <div class="flex items-center gap-2 text-xs">
        <span class="w-2 h-2 rounded-full" :class="{ 'bg-green-400': roomStore.connectionState === 'open', 'bg-yellow-400 animate-pulse': roomStore.connectionState === 'connecting', 'bg-red-400': roomStore.connectionState === 'closed' }" />
        <span class="text-gray-400 dark:text-gray-500">
          {{ t(`connection.${roomStore.connectionState === 'open' ? 'connected' : roomStore.connectionState === 'connecting' ? 'connecting' : 'disconnected'}`) }}
          <span v-if="roomStore.connectionState === 'open' && roomStore.latencyMs != null" class="tabular-nums">({{ roomStore.latencyMs }}ms)</span>
        </span>
        <span class="ml-auto flex items-center gap-1 text-gray-400 dark:text-gray-500">
          <IconUser class="w-3 h-3" />
          <span class="tabular-nums">{{ roomStore.connectionState === 'open' ? roomStore.statistic.online : '-' }}</span>
        </span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-2 border-t border-gray-100 dark:border-gray-700">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1"
        :class="route.path === item.path
          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'"
        @click="$emit('close')"
      >
        <IconRooms v-if="item.icon === 'rooms'" class="w-5 h-5" />
        <IconInfo v-if="item.icon === 'about'" class="w-5 h-5" />
        <IconStatus v-if="item.icon === 'status'" class="w-5 h-5" />
        {{ t(`sidebar.${item.name}`) }}
      </router-link>
    </nav>

    <!-- Language (single-language builds have nothing to switch) -->
    <div v-if="MULTI_LOCALE" class="px-3 py-2 border-t border-gray-100 dark:border-gray-700">
      <LocaleSwitcher />
    </div>

    <!-- Footer (VITE_FOOTER): the first line slightly stronger than the rest -->
    <div v-if="FOOTER_LINES.length" class="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
      <p
        v-for="(line, i) in FOOTER_LINES"
        :key="i"
        class="text-xs text-center"
        :class="i === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-300 dark:text-gray-600 mt-0.5'"
      >{{ line }}</p>
    </div>
  </aside>
</template>
