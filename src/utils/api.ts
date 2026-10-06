import type { Room, Announcement, StatusData, Statistic, ApiResponse } from './types'
import { parseRoom } from './parse'

// Set per build in the env files (see .env); vite.config.ts refuses to
// build or serve without it
export const API_BASE: string = import.meta.env.VITE_API_BASE

const REQUEST_TIMEOUT = 10_000

async function fetchApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  let url = `${API_BASE}${endpoint}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) })
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  const json: ApiResponse<T> = await res.json()
  if (json.code !== 200) {
    throw new Error(json.error || `API error code: ${json.code}`)
  }
  return json.data
}

export async function fetchRecent(): Promise<Room[]> {
  const data = await fetchApi<unknown[]>('/recent')
  return data.map(parseRoom).filter((room): room is Room => room !== null)
}

export async function fetchStatistic(): Promise<Statistic> {
  return fetchApi<Statistic>('/statistic')
}

export async function fetchAnnouncement(lang?: string): Promise<Announcement> {
  return fetchApi<Announcement>('/announcement', lang ? { lang } : undefined)
}

export async function fetchStatus(): Promise<StatusData> {
  return fetchApi<StatusData>('/status')
}

/**
 * Ping the server to measure clock offset via NTP-style calculation.
 * offset = serverTime - (t0 + t3) / 2 (ms). Positive = server ahead.
 */
export async function fetchPing(): Promise<{ serverTime: number; rtt: number; offset: number }> {
  const t0 = Date.now()
  const data = await fetchApi<{ time: number }>('/ping')
  const t3 = Date.now()
  return { serverTime: data.time, rtt: t3 - t0, offset: data.time - (t0 + t3) / 2 }
}
