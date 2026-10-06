<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Room } from '@/utils/types'
import { useRoomStore } from '@/stores/rooms'
import { useTutorial, TUTORIAL_KEY } from '@/composables/useTutorial'
import RoomMenu from './RoomMenu.vue'
import IconExternalLink from '@/components/icons/IconExternalLink.vue'
import IconDotsH from '@/components/icons/IconDotsH.vue'
import IconPin from '@/components/icons/IconPin.vue'

const props = defineProps<{
  room: Room
  roomKey: string
}>()

const emit = defineEmits<{ block: [] }>()

const { t } = useI18n()
const roomStore = useRoomStore()
const menuOpen = ref(false)
const menuBtn = ref<HTMLElement | null>(null)

const tutorial = useTutorial()
const isExample = computed(() => props.roomKey === TUTORIAL_KEY)
const pinned = computed(() => isExample.value ? tutorial.examplePinned.value : roomStore.isPinned(props.roomKey))

// Built by the backend; empty for platforms without a public post (QQ)
const originalUrl = computed(() => props.room.info.url || null)

function togglePin() {
  if (isExample.value) {
    tutorial.examplePinned.value = !tutorial.examplePinned.value
  } else if (pinned.value) {
    roomStore.unpinRoom(props.roomKey)
  } else {
    roomStore.pinRoom(props.roomKey, props.room)
  }
  menuOpen.value = false
}

// Larger hit area on touch screens, tighter with a mouse
const buttonClass = 'p-2 sm:p-1.5 rounded-md transition-colors'
const idleClass = 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
</script>

<template>
  <!-- Negative vertical margin: the buttons keep their hit area but do not make the header row taller -->
  <div class="relative flex items-center flex-shrink-0 -my-1.5 -mr-2 sm:-mr-1.5">
    <!-- Also in the menu; the shortcut is dropped on narrow screens to leave room for the name -->
    <a
      v-if="originalUrl"
      :href="originalUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="hidden sm:block"
      :class="[buttonClass, idleClass]"
      :title="t('rooms.openOriginal')"
      :aria-label="t('rooms.openOriginal')"
    >
      <IconExternalLink class="w-4 h-4" />
    </a>
    <button
      :class="[buttonClass, pinned ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : idleClass]"
      :title="pinned ? t('rooms.unpin') : t('rooms.pin')"
      :aria-label="pinned ? t('rooms.unpin') : t('rooms.pin')"
      :aria-pressed="pinned"
      :data-tour="roomKey === TUTORIAL_KEY ? 'demo-pin' : undefined"
      @click="togglePin"
    >
      <IconPin class="w-4 h-4" />
    </button>
    <button
      ref="menuBtn"
      :class="[buttonClass, idleClass]"
      :title="t('rooms.more')"
      :aria-label="t('rooms.more')"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click="menuOpen = !menuOpen"
    >
      <IconDotsH class="w-4 h-4" />
    </button>
    <Transition name="menu">
      <RoomMenu
        v-if="menuOpen"
        :anchor="menuBtn"
        :room="room"
        :pinned="pinned"
        :original-url="originalUrl"
        @close="menuOpen = false"
        @toggle-pin="togglePin"
        @block="menuOpen = false; emit('block')"
      />
    </Transition>
  </div>
</template>

<style scoped>
.menu-enter-active { transition: opacity 0.15s ease-out, transform 0.15s ease-out; }
.menu-leave-active { transition: opacity 0.1s ease-in, transform 0.1s ease-in; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: scale(0.95) translateY(4px); }
</style>
