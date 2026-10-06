/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_PRESET_TAGS?: string
}

/** Sidebar footer from VITE_FOOTER with {version} filled in (vite.config.ts); lines split by "\n", empty: none */
declare const __FOOTER__: string

declare module 'virtual:locales' {
  type Messages = typeof import('./i18n/locales/ja.json')
  /** Language code → messages, for the languages this build ships (build/locales.ts) */
  export const MESSAGES: Partial<Record<'ja' | 'zh-Hans' | 'zh-Hant' | 'en', Messages>>
  /** Loads the About page (Markdown) of each of those languages */
  export const ABOUT: Partial<Record<'ja' | 'zh-Hans' | 'zh-Hant' | 'en', () => Promise<{ default: string }>>>
  /** Loads the web fonts those languages use */
  export function loadFonts(): Promise<unknown>
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
