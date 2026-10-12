import type { OnlineHour } from './types'

export interface OnlineHourSlot {
  hour: number
  peak: number | null
  average: number | null
  samples: number
}

export function onlineHourSlots(history: OnlineHour[]): OnlineHourSlot[] {
  if (history.length === 0) return []
  const current = Math.max(...history.map(entry => entry.hour))
  const byHour = new Map(history.map(entry => [entry.hour, entry]))
  return Array.from({ length: 48 }, (_, index) => {
    const hour = current - (47 - index) * 3600
    return byHour.get(hour) ?? { hour, peak: null, average: null, samples: 0 }
  })
}
