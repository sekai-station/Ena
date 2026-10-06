import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimestamp } from '@vueuse/core'

const now = useTimestamp({ interval: 1000 })

const formatters = new Map<string, Intl.RelativeTimeFormat>()

function formatter(locale: string): Intl.RelativeTimeFormat {
  let f = formatters.get(locale)
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'narrow' })
    formatters.set(locale, f)
  }
  return f
}

/** Format a Unix timestamp (seconds) as a locale-aware "N ago" string. */
export function formatRelativeTime(unixSeconds: number, locale: string, nowMs = Date.now()): string {
  const diff = Math.max(0, Math.floor(nowMs / 1000) - unixSeconds)
  const f = formatter(locale)
  // Negating keeps zero as -0, which Intl renders as "0 ago" rather than "in 0".
  if (diff < 60) return f.format(-diff, 'second')
  if (diff < 3600) return f.format(-Math.floor(diff / 60), 'minute')
  if (diff < 86400) return f.format(-Math.floor(diff / 3600), 'hour')
  return f.format(-Math.floor(diff / 86400), 'day')
}

export function useRelativeTime(timestamp: () => number) {
  const { locale } = useI18n()
  return computed(() => formatRelativeTime(timestamp(), locale.value, now.value))
}
