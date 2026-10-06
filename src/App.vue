<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useMediaQuery, onKeyStroke } from '@vueuse/core'
import { useDismiss } from '@/composables/useDismiss'
import { useRoomStore } from '@/stores/rooms'
import { useSettingsStore } from '@/stores/settings'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppBackground from '@/components/layout/AppBackground.vue'
import CustomScrollbar from '@/components/common/CustomScrollbar.vue'
import SettingsFab from '@/components/settings/SettingsFab.vue'
import AppToast from '@/components/common/AppToast.vue'
import OnboardingGuide from '@/components/tutorial/OnboardingGuide.vue'
import { useTutorial } from '@/composables/useTutorial'
import IconClose from '@/components/icons/IconClose.vue'
import IconMenu from '@/components/icons/IconMenu.vue'
import IconUser from '@/components/icons/IconUser.vue'
import IconCode from '@/components/icons/IconCode.vue'
import IconFocus from '@/components/icons/IconFocus.vue'

const roomStore = useRoomStore()
const settingsStore = useSettingsStore()
const tutorial = useTutorial()
const sidebarOpen = ref(false)
const devPopupOpen = ref(false)
const devPopup = ref<HTMLElement | null>(null)

// The mobile drawer has no place on desktop: close it when crossing the breakpoint
const isDesktop = useMediaQuery('(min-width: 768px)')
watch(isDesktop, desktop => {
  if (desktop) sidebarOpen.value = false
})

useDismiss(devPopup, devPopupOpen)
onKeyStroke('Escape', () => { sidebarOpen.value = false })

onMounted(() => {
  // Let the page settle before the first-visit welcome box appears
  setTimeout(() => {
    if (!roomStore.focusMode) tutorial.showOnFirstVisit()
  }, 700)
})

onUnmounted(() => {
  roomStore.disconnect()
})
</script>

<template>
  <!-- Focus mode -->
  <div v-if="roomStore.focusMode" class="h-screen bg-white dark:bg-gray-900">
    <CustomScrollbar>
      <main class="max-w-4xl mx-auto">
        <router-view />
      </main>
    </CustomScrollbar>
    <div class="fixed bottom-6 right-6 z-50">
      <button
        class="w-12 h-12 rounded-full bg-gray-900/80 dark:bg-white/20 text-white shadow-lg hover:bg-gray-900 dark:hover:bg-white/30 hover:scale-105 active:scale-95 transition-all backdrop-blur flex items-center justify-center"
        @click="roomStore.toggleFocusMode()"
        :title="$t('settings.exitFocus')"
        :aria-label="$t('settings.exitFocus')"
      >
        <IconClose class="w-5 h-5" />
      </button>
    </div>
  </div>

  <!-- Normal mode -->
  <div v-else class="flex flex-col md:flex-row h-screen bg-gradient-to-br from-gray-50 via-primary-50/40 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
    <!-- Mobile header -->
    <header class="md:hidden flex-shrink-0 relative flex items-center justify-between px-3 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 z-40 select-none">
      <button class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10" :aria-label="$t('a11y.openMenu')" :aria-expanded="sidebarOpen" @click="sidebarOpen = true">
        <IconMenu class="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
      <span class="absolute inset-x-0 text-center text-sm font-bold text-primary-700 dark:text-primary-400 pointer-events-none">{{ $t('app.title') }}</span>
      <div class="flex items-center gap-1.5 z-10">
        <IconUser class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
        <span class="text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ roomStore.connectionState === 'open' ? roomStore.statistic.online : '-' }}</span>
        <span class="w-2 h-2 rounded-full ml-0.5" :class="{ 'bg-green-400': roomStore.connectionState === 'open', 'bg-yellow-400 animate-pulse': roomStore.connectionState === 'connecting', 'bg-red-400': roomStore.connectionState === 'closed' }" />
      </div>
    </header>

    <!-- Sidebar backdrop (mobile) -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="fixed inset-0 bg-black/30 z-40 md:hidden" @click="sidebarOpen = false" />
    </Transition>
    <Transition name="slide">
      <AppSidebar v-show="sidebarOpen" class="fixed inset-y-0 left-0 z-50 md:hidden" @close="sidebarOpen = false" />
    </Transition>

    <!-- Desktop sidebar -->
    <div v-if="!roomStore.sidebarCollapsed" class="hidden md:block flex-shrink-0 w-60 sticky top-0 h-screen">
      <AppSidebar class="h-full" collapsible />
    </div>

    <!-- Reopen the collapsed sidebar -->
    <button
      v-else
      class="hidden md:flex fixed bottom-6 left-6 z-30 w-12 h-12 items-center justify-center rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
      :title="$t('a11y.toggleSidebar')"
      :aria-label="$t('a11y.toggleSidebar')"
      aria-expanded="false"
      @click="roomStore.toggleSidebar()"
    >
      <IconMenu class="w-5 h-5" />
    </button>

    <!-- Main content -->
    <main class="relative flex-1 min-w-0 min-h-0 overflow-hidden">
      <AppBackground v-if="settingsStore.animatedBackground" />
      <CustomScrollbar>
        <router-view v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </router-view>
      </CustomScrollbar>
    </main>

    <!-- Bottom-right column: dev tools (dev builds), focus mode, settings -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end select-none">
      <div v-if="roomStore.isDev" ref="devPopup" class="relative">
        <button
          class="w-10 h-10 rounded-full bg-orange-200 dark:bg-orange-900 text-orange-600 dark:text-orange-300 shadow hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
          @click="devPopupOpen = !devPopupOpen"
          title="Dev Tools"
          aria-label="Dev Tools"
          :aria-expanded="devPopupOpen"
        >
          <IconCode class="w-4 h-4" />
        </button>
        <Transition name="popup">
          <div v-if="devPopupOpen" class="absolute bottom-0 right-12 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 select-none">
            <p class="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Dev Tools</p>
            <p class="text-[10px] text-gray-400">{{ roomStore.connectionState }} · {{ roomStore.rooms.length }} rooms</p>
            <!-- Same path as a real network drop: banner, countdown, backoff reconnect -->
            <button
              class="w-full px-2 py-1 text-xs rounded border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/40 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              :disabled="roomStore.connectionState !== 'open'"
              @click="roomStore.dropStream()"
            >
              Drop SSE connection
            </button>
            <button
              class="w-full px-2 py-1 text-xs rounded border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/40 transition-colors"
              @click="devPopupOpen = false; tutorial.openWelcome()"
            >
              Show onboarding
            </button>
          </div>
        </Transition>
      </div>

      <button
          class="w-12 h-12 rounded-full bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
          :title="$t('settings.focusMode')"
          :aria-label="$t('settings.focusMode')"
          data-tour="focus"
          @click="roomStore.toggleFocusMode()"
        >
          <IconFocus class="w-5 h-5" />
        </button>
      <SettingsFab />
    </div>
  </div>

  <OnboardingGuide v-if="!roomStore.focusMode" />
  <AppToast />
</template>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: transform 0.3s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.page-enter-active, .page-leave-active { transition: opacity 0.15s ease; }
.page-enter-from, .page-leave-to { opacity: 0; }
.popup-enter-active { transition: all 0.2s ease-out; }
.popup-leave-active { transition: all 0.15s ease-in; }
.popup-enter-from, .popup-leave-to { opacity: 0; transform: translateY(8px) scale(0.95); }
</style>
