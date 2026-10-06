import { normalizePath, type Plugin } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { SITE_LOCALES, type SiteLocale } from '../src/i18n/site.ts'

// Web fonts, self-hosted from npm (Fontsource) so they also load where Google
// Fonts is blocked. Each language needs its UI font; content text in a
// multi-language build uses Noto Sans JP, which `ja` already brings in.
const LOCALE_FONTS: Record<SiteLocale, string> = {
  ja: '@fontsource-variable/noto-sans-jp',
  'zh-Hans': '@fontsource-variable/noto-sans-sc',
  'zh-Hant': '@fontsource-variable/noto-sans-tc',
  en: '@fontsource-variable/noto-sans-jp',
}
// Room numbers; only digits are shown, so browsers fetch just the Latin subset
const MONO_FONT = '@fontsource/jetbrains-mono/700.css'

export interface LocaleFile {
  code: SiteLocale
  path: string
}

/**
 * The language files a build ships: all four by default, or only the one
 * VITE_LOCALE_FILE points at (the CN build uses src/i18n/locales/cn/zh-Hans.json).
 * That file is named after its language code, which also sets <html lang>,
 * fonts, date formats and which announcement is fetched.
 */
export function localeFiles(root: string, env: Record<string, string>): LocaleFile[] {
  const single = env.VITE_LOCALE_FILE?.trim()
  if (!single) {
    return SITE_LOCALES.map(l => ({ code: l.code, path: resolve(root, `src/i18n/locales/${l.code}.json`) }))
  }
  const path = resolve(root, single)
  const code = SITE_LOCALES.find(l => `${l.code}.json` === basename(path))?.code
  if (!code) {
    throw new Error(`VITE_LOCALE_FILE must be named after its language (${SITE_LOCALES.map(l => `${l.code}.json`).join(', ')}): ${single}`)
  }
  if (!existsSync(path)) throw new Error(`VITE_LOCALE_FILE not found: ${path}`)
  return [{ code, path }]
}

/**
 * The About page for each language the build ships: src/assets/about_<code>.md,
 * or the one file VITE_ABOUT_FILE points at for all of them (the CN build's own
 * page, src/assets/about_cn.md).
 */
export function aboutFiles(root: string, env: Record<string, string>, locales: LocaleFile[]): LocaleFile[] {
  const single = env.VITE_ABOUT_FILE?.trim()
  const files = locales.map(({ code }) => ({ code, path: resolve(root, single || `src/assets/about_${code}.md`) }))
  for (const { path } of files) {
    if (!existsSync(path)) throw new Error(`About page not found: ${path}${single ? ' (VITE_ABOUT_FILE)' : ''}`)
  }
  return files
}

export function readMessages(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function missingKeys(reference: object, messages: object, prefix = ''): string[] {
  return Object.entries(reference).flatMap(([key, value]) => {
    const own = (messages as Record<string, unknown>)[key]
    if (own === undefined) return [prefix + key]
    return value && typeof value === 'object' && own && typeof own === 'object'
      ? missingKeys(value, own, `${prefix}${key}.`)
      : []
  })
}

/**
 * Provides `virtual:locales`:
 * - `MESSAGES`: language code → messages, for the languages this build ships
 * - `ABOUT`: language code → loader of that language's About page (Markdown)
 * - `loadFonts()`: loads the web fonts those languages use
 * About pages and font stylesheets are separate files fetched on demand, so
 * they never hold up the app.
 */
export function appLocales(): Plugin {
  const ID = 'virtual:locales'
  let files: LocaleFile[] = []
  let about: LocaleFile[] = []

  return {
    name: 'app-locales',

    configResolved(config) {
      files = localeFiles(config.root, config.env)
      about = aboutFiles(config.root, config.env, files)
      // A single-language file is kept by hand; point out keys it lacks compared with ja.json
      if (files.length === 1) {
        const missing = missingKeys(readMessages(resolve(config.root, 'src/i18n/locales/ja.json')), readMessages(files[0].path))
        if (missing.length > 0) config.logger.warn(`[app-locales] ${files[0].path} is missing ${missing.join(', ')}`)
      }
    },

    resolveId(id) {
      if (id === ID) return '\0' + ID
    },

    load(id) {
      if (id !== '\0' + ID) return
      const imports = files.map((f, i) => `import m${i} from ${JSON.stringify(normalizePath(f.path))}`)
      const entries = files.map((f, i) => `${JSON.stringify(f.code)}: m${i}`)
      const abouts = about.map(f => `${JSON.stringify(f.code)}: () => import(${JSON.stringify(normalizePath(f.path) + '?raw')})`)
      const fonts = [...new Set([MONO_FONT, ...files.map(f => LOCALE_FONTS[f.code])])]
      return [
        ...imports,
        `export const MESSAGES = { ${entries.join(', ')} }`,
        `export const ABOUT = { ${abouts.join(', ')} }`,
        `export const loadFonts = () => Promise.all([${fonts.map(f => `import(${JSON.stringify(f)})`).join(', ')}])`,
        '',
      ].join('\n')
    },
  }
}
