/**
 * Sets the font variables on <html> as inline styles (highest cascade priority):
 * --font-ui follows the UI language, --font-content is for user posts.
 * Called on start and on every language change (see i18n/index.ts). The
 * families are the self-hosted web fonts loaded by loadFonts() (build/locales.ts).
 */
const JP = '"Noto Sans JP Variable"'
const SC = '"Noto Sans SC Variable"'
const TC = '"Noto Sans TC Variable"'
const SYSTEM = 'system-ui, -apple-system, sans-serif'

const FONT_STACKS: Record<string, string> = {
  ja:        `${JP}, ${SC}, ${TC}, ${SYSTEM}`,
  'zh-Hans': `${SC}, ${JP}, ${TC}, ${SYSTEM}`,
  'zh-Hant': `${TC}, ${SC}, ${JP}, ${SYSTEM}`,
  en:        `${JP}, system-ui, -apple-system, ${TC}, ${SC}, sans-serif`,
}

// Posts on the JP server are mostly Japanese, whatever the UI language
const CONTENT_STACK = `${JP}, ${TC}, ${SC}, ${SYSTEM}`

/**
 * `ownContent`: posts are in the UI language itself (a single-language build,
 * i.e. the CN one), so they use the UI stack, with Chinese glyph shapes.
 */
export function applyUiFont(locale: string, ownContent = false): void {
  const stack = FONT_STACKS[locale] ?? FONT_STACKS.ja
  const style = document.documentElement.style
  style.setProperty('--font-ui', stack)
  style.setProperty('--font-content', ownContent ? stack : CONTENT_STACK)
}
