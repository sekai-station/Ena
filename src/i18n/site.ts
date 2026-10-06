/**
 * The language versions of the site, shared by the app and the build.
 * path: the URL prefix (/zh-hans/ …); og: the Open Graph locale.
 * Kept free of browser and Node APIs so both sides can import it.
 */
export const SITE_LOCALES = [
  { code: 'ja', path: 'ja', og: 'ja_JP' },
  { code: 'zh-Hans', path: 'zh-hans', og: 'zh_CN' },
  { code: 'zh-Hant', path: 'zh-hant', og: 'zh_TW' },
  { code: 'en', path: 'en', og: 'en_US' },
] as const

export type SiteLocale = (typeof SITE_LOCALES)[number]['code']

/** The root URL (hreflang x-default) carries this language's title and description. */
export const DEFAULT_SITE_LOCALE: SiteLocale = 'ja'
