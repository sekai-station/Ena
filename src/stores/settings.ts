import { defineStore } from 'pinia'
import { computed, watchEffect } from 'vue'
import { useLocalStorage, usePreferredDark } from '@vueuse/core'

// Preset filter chips, set per build: VITE_PRESET_TAGS, comma-separated (see .env)
export const PRESET_TAGS: readonly string[] = (import.meta.env.VITE_PRESET_TAGS ?? '')
  .split(',')
  .map((tag: string) => tag.trim())
  .filter(Boolean)

export type FilterMode = 'blacklist' | 'whitelist'
export type ThemeMode = 'system' | 'light' | 'dark'

export const EXPIRE_TIME_MIN = 10
export const EXPIRE_TIME_MAX = 600

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

export const useSettingsStore = defineStore('settings', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const expireTime = useLocalStorage('pjsk-expire-time', 300)
  const filterMode = useLocalStorage<FilterMode>('pjsk-filter-mode', 'blacklist')
  const filterKeywords = useLocalStorage<string[]>('pjsk-filter-keywords', [])
  const filterTags = useLocalStorage<string[]>('pjsk-filter-tags', [])
  const fontSize = useLocalStorage('pjsk-font-size', 14)      // 12-20px
  const lineHeight = useLocalStorage('pjsk-line-height', 1.5) // 1.2-2.0
  const animatedBackground = useLocalStorage('pjsk-animated-bg', true)

  // null = no explicit choice yet, follow the system preference.
  // index.html applies the same rule inline to avoid a flash before mount.
  const darkOverride = useLocalStorage<boolean | null>('pjsk-dark-mode', null, {
    serializer: { read: raw => raw === 'true', write: value => String(value) },
    writeDefaults: false,
  })
  const prefersDark = usePreferredDark()
  const darkMode = computed(() => darkOverride.value ?? prefersDark.value)
  const themeMode = computed<ThemeMode>(() =>
    darkOverride.value === null ? 'system' : darkOverride.value ? 'dark' : 'light',
  )

  watchEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode.value)
    // Mobile browser bar matches the header (white / gray-800); index.html sets the first value
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', darkMode.value ? '#1f2937' : '#ffffff')
  })

  // Stored values may predate the current limits
  expireTime.value = clamp(expireTime.value, EXPIRE_TIME_MIN, EXPIRE_TIME_MAX, 300)
  fontSize.value = clamp(fontSize.value, 12, 20, 14)
  lineHeight.value = clamp(lineHeight.value, 1.2, 2.0, 1.5)
  if (filterMode.value !== 'whitelist') filterMode.value = 'blacklist'

  // ── Computed ───────────────────────────────────────────────────────────────
  // A saved tag the build no longer offers has no chip to turn it off, so it is ignored
  const activeTags = computed(() => filterTags.value.filter(tag => PRESET_TAGS.includes(tag)))
  const allFilterTerms = computed(() => [...activeTags.value, ...filterKeywords.value])
  const hasActiveFilters = computed(() => allFilterTerms.value.length > 0)

  // ── Actions ────────────────────────────────────────────────────────────────
  function setExpireTime(seconds: number) {
    expireTime.value = clamp(seconds, EXPIRE_TIME_MIN, EXPIRE_TIME_MAX, 300)
  }

  function setFilterMode(mode: FilterMode) {
    filterMode.value = mode
  }

  function addKeyword(keyword: string) {
    const trimmed = keyword.trim()
    if (trimmed && !filterKeywords.value.includes(trimmed)) {
      filterKeywords.value = [...filterKeywords.value, trimmed]
    }
  }

  function removeKeyword(keyword: string) {
    filterKeywords.value = filterKeywords.value.filter(k => k !== keyword)
  }

  function toggleTag(tag: string) {
    filterTags.value = filterTags.value.includes(tag)
      ? filterTags.value.filter(t => t !== tag)
      : [...filterTags.value, tag]
  }

  function setThemeMode(mode: ThemeMode) {
    darkOverride.value = mode === 'system' ? null : mode === 'dark'
  }

  function setFontSize(size: number) {
    fontSize.value = clamp(size, 12, 20, 14)
  }

  function setAnimatedBackground(on: boolean) {
    animatedBackground.value = on
  }

  function setLineHeight(lh: number) {
    lineHeight.value = clamp(Math.round(lh * 10) / 10, 1.2, 2.0, 1.5)
  }

  function clearAllFilters() {
    filterTags.value = []
    filterKeywords.value = []
  }

  return {
    expireTime,
    filterMode,
    filterKeywords,
    filterTags,
    darkMode,
    themeMode,
    fontSize,
    lineHeight,
    animatedBackground,
    setAnimatedBackground,
    allFilterTerms,
    hasActiveFilters,
    setExpireTime,
    setFilterMode,
    addKeyword,
    removeKeyword,
    toggleTag,
    setThemeMode,
    setFontSize,
    setLineHeight,
    clearAllFilters,
  }
})
