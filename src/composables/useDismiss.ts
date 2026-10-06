import type { Ref } from 'vue'
import { onClickOutside, onKeyStroke, type MaybeElementRef } from '@vueuse/core'

/** Close a popup when clicking outside `target` or pressing Escape. */
export function useDismiss(target: MaybeElementRef, isOpen: Ref<boolean>) {
  onClickOutside(target, () => { isOpen.value = false })
  onKeyStroke('Escape', () => { isOpen.value = false })
}
