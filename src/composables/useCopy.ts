import { useClipboard, type UseClipboardReturn } from '@vueuse/core'
import { i18n } from '@/i18n'
import { useToast } from './useToast'

// One shared instance: every room card can copy, and useClipboard sets up
// permission queries per instance.
let clipboard: UseClipboardReturn<false> | null = null

/** Copy text and report the result in a toast. Resolves to whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  const { copy } = (clipboard ??= useClipboard({ legacy: true }))
  const { show } = useToast()
  const { t } = i18n.global
  try {
    await copy(text)
    show(t('rooms.copied'))
    return true
  } catch {
    show(t('rooms.copyFailed'), 'error')
    return false
  }
}
