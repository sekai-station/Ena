import { createI18n } from 'vue-i18n'
import { MESSAGES } from 'virtual:locales'
import { applyUiFont } from '@/utils/locale-font'
import { SITE_LOCALES } from './site'

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

function isAppLocale(value: string | null): value is AppLocale {
  return LOCALES.some(l => l.code === value)
}

// Where the site is served from ('/' unless Vite's base is changed)
const BASE = import.meta.env.BASE_URL

/** The language a /ja/, /zh-hans/ … entry page stands for; null on the root page. */
function localeFromPath(): AppLocale | null {
  if (!location.pathname.startsWith(BASE)) return null
  const segment = location.pathname.slice(BASE.length).split('/')[0].toLowerCase()
  return SITE_LOCALES.find(l => l.path === segment)?.code ?? null
}

// A language entry page decides the language: it is the link that was followed.
// Otherwise only an explicit choice is persisted, so the browser language keeps
// being followed until the user picks one.
function detectLocale(): AppLocale {
  if (!MULTI_LOCALE) return LOCALES[0].code

  const fromPath = localeFromPath()
  if (fromPath) return fromPath

  const saved = localStorage.getItem(STORAGE_KEY)
  if (isAppLocale(saved)) return saved

  const lang = navigator.language
  if (lang.startsWith('ja')) return 'ja'
  if (['zh-CN', 'zh-Hans', 'zh-SG'].includes(lang) || lang === 'zh') return 'zh-Hans'
  if (['zh-TW', 'zh-Hant', 'zh-HK'].includes(lang)) return 'zh-Hant'
  if (lang.startsWith('en')) return 'en'
  return 'ja'
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
    // A rendered page identifies the matching language entry, even at the root URL.
    const canonical = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${locale}"]`)?.href
    if (canonical) {
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
      document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
    }
  }
}

// The language entry pages exist for search engines. Once a language is picked
// the app goes back to the root address, keeping the #/… page, so the saved
// choice decides the language from then on.
function leaveLocalePath() {
  if (!localeFromPath()) return
  history.replaceState(history.state, '', `${BASE}${location.search}${location.hash}`)
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

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  applyLocale(locale)
  leaveLocalePath()
}
