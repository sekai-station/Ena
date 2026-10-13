import { createI18n } from 'vue-i18n'
import { MESSAGES } from 'virtual:locales'
import { applyUiFont } from '@/utils/locale-font'
import { SITE_LOCALES, DEFAULT_SITE_LOCALE, siteLocalePath } from './site'

const ALL_LOCALES = [
  { code: 'ja', label: '日本語' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'en', label: 'English' },
] as const

export type AppLocale = (typeof ALL_LOCALES)[number]['code']

// The languages this build ships: all four, or only the file VITE_LOCALE_FILE
// names (see build/locales.ts)
export const LOCALES = ALL_LOCALES.filter(l => l.code in MESSAGES)
// A single-language build (the CN one) has no language switcher and no
// /ja/ … entry pages
export const MULTI_LOCALE = LOCALES.length > 1

const STORAGE_KEY = 'pjsk-locale'

/** Match browser preferences only for the welcome suggestion, never implicitly. */
export function browserLocale(): AppLocale | null {
  for (const preference of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const tag = preference.toLowerCase()
    const code = tag.startsWith('zh')
      ? (/^zh-(hant|tw|hk|mo)(-|$)/.test(tag) ? 'zh-Hant' : 'zh-Hans')
      : tag.startsWith('ja') ? 'ja' : tag.startsWith('en') ? 'en' : null
    if (code && LOCALES.some(l => l.code === code)) return code
  }
  return null
}

// Where the site is served from ('/' unless Vite's base is changed)
const BASE = import.meta.env.BASE_URL

/** The language a /ja/, /zh-hans/ … entry page stands for; null on the root page. */
function localeFromPath(): AppLocale | null {
  if (!location.pathname.startsWith(BASE)) return null
  const segment = location.pathname.slice(BASE.length).split('/')[0].toLowerCase()
  return SITE_LOCALES.find(l => l.path === segment)?.code ?? null
}

// The URL always decides the language, including on the root page. This keeps
// the static HTML and Google's rendered page identical regardless of browser
// language or preferences left over from an earlier visit.
function detectLocale(): AppLocale {
  if (!MULTI_LOCALE) return LOCALES[0].code
  return localeFromPath() ?? DEFAULT_SITE_LOCALE
}

function applyLocale(locale: AppLocale) {
  applyUiFont(locale, !MULTI_LOCALE)
  document.documentElement.lang = locale
  // Same title and description as that language's entry page (see build/seo-pages.ts)
  const seo = MESSAGES[locale]!.seo
  document.title = seo.title
  document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description)
  if (MULTI_LOCALE) {
    const current = SITE_LOCALES.find(l => l.code === locale)!
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', `${BASE}${current.path}/site.webmanifest`)
    const properties = {
      'og:title': seo.title,
      'og:description': seo.description,
      'og:site_name': MESSAGES[locale]!.app.title,
      'og:locale': current.og,
    }
    for (const [property, content] of Object.entries(properties)) {
      document.querySelector(`meta[property="${property}"]`)?.setAttribute('content', content)
    }
    const alternates = SITE_LOCALES.filter(l => l.code !== locale)
    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((meta, i) => {
      meta.setAttribute('content', alternates[i]!.og)
    })
    // These alternates use the same canonical URLs as the generated HTML.
    const canonical = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${locale}"]`)?.href
    if (canonical) {
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
      document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
    }
  }
}

export function localeHref(locale: AppLocale, hash = location.hash): string {
  return `${BASE}${siteLocalePath(locale)}${location.search}${hash}`
}

// Restore an explicitly chosen language on a root visit. Language-specific
// links still take precedence; fresh visitors and crawlers keep Japanese.
if (MULTI_LOCALE && location.pathname === BASE) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const preference = LOCALES.find(l => l.code === saved)
    if (preference) history.replaceState(history.state, '', localeHref(preference.code))
  } catch {
    // Storage unavailable: use the language selected by the URL.
  }
}
const initialLocale = detectLocale()
// Apply font before Vue mounts — synchronous, inline style, beats all CSS rules
applyLocale(initialLocale)

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: LOCALES[0].code,
  messages: MESSAGES,
})

// Back/forward may restore a URL created before a language switch.
window.addEventListener('popstate', () => {
  const locale = detectLocale()
  if (locale === i18n.global.locale.value) return
  i18n.global.locale.value = locale
  applyLocale(locale)
})

export function setLocale(locale: AppLocale) {
  if (MULTI_LOCALE) history.replaceState(history.state, '', localeHref(locale))
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Language switching still works without persistent storage.
  }
  applyLocale(locale)
}
