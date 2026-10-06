<script setup lang="ts">
import { ref, toRef, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import type { Room } from '@/utils/types'
import { copyText } from '@/composables/useCopy'
import IconExternalLink from '@/components/icons/IconExternalLink.vue'
import IconCopyId from '@/components/icons/IconCopyId.vue'
import IconCopyText from '@/components/icons/IconCopyText.vue'
import IconPin from '@/components/icons/IconPin.vue'
import IconBan from '@/components/icons/IconBan.vue'

const props = defineProps<{
  anchor: HTMLElement | null
  room: Room
  pinned: boolean
  originalUrl: string | null
}>()

const emit = defineEmits<{ close: []; togglePin: []; block: [] }>()

const { t } = useI18n()
const menuEl = ref<HTMLElement | null>(null)

// transform: false keeps the enter/leave transition free to use transform
const { floatingStyles, isPositioned } = useFloating(toRef(props, 'anchor'), menuEl, {
  placement: 'top-end',
  transform: false,
  middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

onClickOutside(menuEl, () => emit('close'), { ignore: [toRef(props, 'anchor')] })

function menuItems(): HTMLElement[] {
  return Array.from(menuEl.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}

// The menu is hidden until positioned, and hidden elements cannot take focus
watch(isPositioned, async positioned => {
  if (!positioned) return
  await nextTick()
  menuItems()[0]?.focus({ preventScroll: true })
})

onKeyStroke('Escape', e => {
  e.preventDefault()
  emit('close')
  props.anchor?.focus({ preventScroll: true })
})

function onKeydown(e: KeyboardEvent) {
  const items = menuItems()
  const index = items.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[(index + 1) % items.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[(index - 1 + items.length) % items.length]?.focus()
  } else if (e.key === 'Tab') {
    emit('close')
  }
}

async function copyAndClose(text: string) {
  await copyText(text)
  emit('close')
}

function openOriginal() {
  if (props.originalUrl) window.open(props.originalUrl, '_blank', 'noopener')
  emit('close')
}

const itemClass = 'w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700 transition-colors'
</script>

<template>
  <div
    ref="menuEl"
    role="menu"
    class="w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20"
    :class="{ invisible: !isPositioned }"
    :style="floatingStyles"
    @keydown="onKeydown"
  >
    <button role="menuitem" :class="itemClass" @click="copyAndClose(room.id)">
      <IconCopyId class="w-4 h-4 text-gray-500 dark:text-gray-400" />
      {{ t('rooms.copyId') }}
    </button>
    <button role="menuitem" :class="itemClass" @click="copyAndClose(`${room.id}\n${room.msg}`)">
      <IconCopyText class="w-4 h-4 text-gray-500 dark:text-gray-400" />
      {{ t('rooms.copyText') }}
    </button>
    <button v-if="originalUrl" role="menuitem" :class="itemClass" @click="openOriginal">
      <IconExternalLink class="w-4 h-4 text-gray-500 dark:text-gray-400" />
      {{ t('rooms.openOriginal') }}
    </button>
    <button role="menuitem" :class="itemClass" @click="emit('togglePin')">
      <IconPin class="w-4 h-4 text-gray-500 dark:text-gray-400" />
      {{ pinned ? t('rooms.unpin') : t('rooms.pin') }}
    </button>
    <button role="menuitem" :class="itemClass" @click="emit('block')">
      <IconBan class="w-4 h-4 text-gray-500 dark:text-gray-400" />
      {{ t('rooms.block') }}
    </button>
  </div>
</template>
