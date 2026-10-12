import type { Room } from './types'

export interface BadgeDef {
  id: string
  label: string
  class: string      // Tailwind classes (bg + text) for light mode
  darkClass: string  // Tailwind classes prefixed with dark: for dark mode
  style?: string     // optional inline style override (e.g. custom hex colors)
}

export class Badge {
  readonly definition: BadgeDef
  private readonly matchSource?: (source: string) => boolean

  constructor(
    definition: BadgeDef,
    matchSource?: (source: string) => boolean,
  ) {
    this.definition = definition
    this.matchSource = matchSource
  }

  matches(source: string): boolean {
    const normalized = source.trim().toLowerCase()
    return normalized === this.definition.id.toLowerCase()
      || (this.matchSource?.(normalized) ?? false)
  }
}

// ── Badge Registry ──────────────────────────────────────────────────────────
// One badge per room source (room.source); unknown sources get a gray badge
// with their own name.
export const BADGES: Badge[] = [
  new Badge({ id: 'x',       label: 'X',       class: 'bg-blue-500 text-white',    darkClass: 'dark:bg-blue-500 dark:text-white' }),
  new Badge({ id: 'qq',      label: 'QQ',      class: 'bg-emerald-500 text-white', darkClass: 'dark:bg-emerald-500 dark:text-white' }),
  new Badge({ id: 'discord', label: 'Discord', class: 'bg-indigo-500 text-white',  darkClass: 'dark:bg-indigo-500 dark:text-white' }),
  new Badge({ id: 'robo',    label: 'Robo',    class: 'text-white',                darkClass: 'dark:text-white', style: 'background:#33DD99' }),
  new Badge(
    { id: 'haruki', label: 'Haruki', class: 'bg-blue-500 text-white', darkClass: 'dark:bg-blue-500 dark:text-white' },
    source => /^haruki_\d+$/.test(source),
  ),
]

const FALLBACK_STYLE = {
  class: 'bg-gray-200 text-gray-700',
  darkClass: 'dark:bg-gray-600 dark:text-gray-300',
}

/**
 * The badge for a room's source. Missing/empty source: no badge; a source not
 * matched by BADGES: a gray badge with its name. Matching ignores case.
 */
export function resolveBadge(room: Room): BadgeDef | null {
  const source = room.source?.trim()
  if (!source) return null

  const badge = BADGES.find(candidate => candidate.matches(source))
  if (badge) return badge.definition

  return {
    id: '_unknown',
    label: source,
    ...FALLBACK_STYLE,
  }
}
