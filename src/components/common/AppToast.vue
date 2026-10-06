<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import IconCheck from '@/components/icons/IconCheck.vue'
import IconClose from '@/components/icons/IconClose.vue'

const { toast, dismiss } = useToast()

function runAction() {
  toast.value?.action?.run()
  dismiss()
}
</script>

<template>
  <!-- Above the floating buttons on narrow screens, where they would overlap -->
  <div class="fixed inset-x-0 bottom-24 md:bottom-8 z-[60] flex justify-center pointer-events-none px-4" role="status" aria-live="polite">
    <Transition name="toast" mode="out-in">
      <div
        v-if="toast"
        :key="toast.id"
        class="flex items-center gap-1.5 pl-3 py-2 rounded-full text-xs font-medium shadow-lg select-none"
        :class="[
          toast.type === 'success'
            ? 'bg-gray-900/90 dark:bg-gray-100/95 text-white dark:text-gray-900'
            : 'bg-red-600 text-white',
          toast.action ? 'pr-1.5 pointer-events-auto' : 'pr-3',
        ]"
      >
        <IconCheck v-if="toast.type === 'success'" class="w-3.5 h-3.5" />
        <IconClose v-else class="w-3.5 h-3.5" />
        {{ toast.message }}
        <button
          v-if="toast.action"
          class="ml-1.5 px-2.5 py-1 rounded-full font-semibold text-primary-300 dark:text-primary-700 hover:bg-white/10 dark:hover:bg-black/5 transition-colors"
          @click="runAction"
        >
          {{ toast.action.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active { transition: all 0.15s ease-out; }
.toast-leave-active { transition: all 0.1s ease-in; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }
</style>
