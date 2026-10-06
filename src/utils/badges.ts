import type { Room } from './types'

export interface BadgeDef {
  id: string
  label: string
  class: string      // Tailwind classes (bg + text) for light mode
  darkClass: string  // Tailwind classes prefixed with dark: for dark mode
  style?: string     // optional inline style override (e.g. custom hex colors)
}

// ── Badge Registry ──────────────────────────────────────────────────────────
// One badge per room source (room.source); unknown sources get a gray badge
// with their own name.
export const BADGES: BadgeDef[] = [
  { id: 'x',       label: 'X',       class: 'bg-blue-500 text-white',    darkClass: 'dark:bg-blue-500 dark:text-white' },
  { id: 'qq',      label: 'QQ',      class: 'bg-emerald-500 text-white', darkClass: 'dark:bg-emerald-500 dark:text-white' },
  { id: 'discord', label: 'Discord', class: 'bg-indigo-500 text-white',  darkClass: 'dark:bg-indigo-500 dark:text-white' },
  { id: 'robo',    label: 'Robo',    class: 'text-white',                darkClass: 'dark:text-white', style: 'background:#33DD99' },
  { id: 'haruki',  label: 'Haruki',  class: 'text-white',                darkClass: 'dark:text-white', style: 'background:#99CCFF;color:#1a1a1a' },
]

const sourceMap = new Map<string, BadgeDef>(BADGES.map(b => [b.id, b]))

const FALLBACK_STYLE = {
  class: 'bg-gray-200 text-gray-700',
  darkClass: 'dark:bg-gray-600 dark:text-gray-300',
}

/**
 * The badge for a room's source. Missing/empty source: no badge; a source not
 * in BADGES: a gray badge with its name. Matching ignores case.
 */
export function resolveBadge(room: Room): BadgeDef | null {
  const source = room.source?.trim()
  if (!source) return null

  const bySource = sourceMap.get(source.toLowerCase())
  if (bySource) return bySource

  return {
    id: '_unknown',
    label: source,
    ...FALLBACK_STYLE,
  }
}
