<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore, PRESET_TAGS, type FilterMode } from '@/stores/settings'
import SegmentedControl from './SegmentedControl.vue'
import BlockedRoomsMenu from './BlockedRoomsMenu.vue'
import IconClose from '@/components/icons/IconClose.vue'

const { t } = useI18n()
const settings = useSettingsStore()
const newKeyword = ref('')

const modeOptions = computed(() => [
  { value: 'blacklist' as FilterMode, label: t('settings.blacklist'), title: t('settings.blacklistDesc') },
  { value: 'whitelist' as FilterMode, label: t('settings.whitelist'), title: t('settings.whitelistDesc') },
])

// Enter also confirms an IME composition (Chinese/Japanese input)
function onEnter(e: KeyboardEvent) {
  if (!e.isComposing) addKeyword()
}

function addKeyword() {
  if (newKeyword.value.trim()) {
    settings.addKeyword(newKeyword.value)
    newKeyword.value = ''
  }
}

const chip = 'inline-flex items-center gap-1 h-6 px-2 rounded border text-xs transition-colors'
const chipOn = 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/40 dark:border-primary-700 dark:text-primary-300'
const chipOff = 'border-gray-200 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500'
</script>

<template>
  <section class="px-3.5 py-3 space-y-2.5">
    <div class="flex items-center justify-between">
      <h4 class="text-[11px] font-semibold tracking-wider text-gray-400 dark:text-gray-500">{{ t('settings.filter') }}</h4>
      <button
        v-if="settings.hasActiveFilters"
        class="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        @click="settings.clearAllFilters()"
      >
        {{ t('settings.clearFilters') }}
      </button>
    </div>

    <div class="flex items-center justify-between gap-3">
      <span class="text-[13px] text-gray-700 dark:text-gray-300">{{ t('settings.filterMode') }}</span>
      <SegmentedControl
        :model-value="settings.filterMode"
        :options="modeOptions"
        :label="t('settings.filterMode')"
        @update:model-value="settings.setFilterMode"
      />
    </div>
    <p class="text-xs text-gray-400 dark:text-gray-500 -mt-1">
      {{ settings.filterMode === 'blacklist' ? t('settings.blacklistDesc') : t('settings.whitelistDesc') }}
    </p>

    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="tag in PRESET_TAGS"
        :key="tag"
        :class="[chip, settings.filterTags.includes(tag) ? chipOn : chipOff]"
        :aria-pressed="settings.filterTags.includes(tag)"
        @click="settings.toggleTag(tag)"
      >
        {{ tag }}
      </button>
      <span v-for="kw in settings.filterKeywords" :key="kw" :class="[chip, chipOn, 'pr-1']">
        {{ kw }}
        <button
          class="p-0.5 rounded-sm opacity-60 hover:opacity-100"
          :aria-label="t('a11y.removeFilter', { name: kw })"
          @click="settings.removeKeyword(kw)"
        >
          <IconClose class="w-3 h-3" />
        </button>
      </span>
    </div>

    <div class="flex">
      <input
        v-model="newKeyword"
        type="text"
        :placeholder="t('settings.addKeyword')"
        :aria-label="t('settings.addKeyword')"
        class="flex-1 min-w-0 h-7 px-2 text-xs rounded-l border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
        @keydown.enter="onEnter"
      />
      <button
        class="h-7 px-3 text-xs rounded-r border border-l-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        :disabled="!newKeyword.trim()"
        @click="addKeyword"
      >
        {{ t('settings.add') }}
      </button>
    </div>

    <BlockedRoomsMenu />
  </section>
</template>
