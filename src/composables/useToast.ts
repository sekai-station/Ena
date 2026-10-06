import { ref } from 'vue'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
  action?: ToastAction
}

const DURATION = 1800
// Long enough to reach the button
const DURATION_WITH_ACTION = 5000

const toast = ref<Toast | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let nextId = 0

function dismiss() {
  if (timer) clearTimeout(timer)
  timer = null
  toast.value = null
}

function show(message: string, type: Toast['type'] = 'success', action?: ToastAction) {
  if (timer) clearTimeout(timer)
  toast.value = { id: ++nextId, message, type, action }
  timer = setTimeout(dismiss, action ? DURATION_WITH_ACTION : DURATION)
}

export function useToast() {
  return { toast, show, dismiss }
}
