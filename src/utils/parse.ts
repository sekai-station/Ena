import type { Room, RoomInfo, Statistic } from './types'

// Payloads come from the network, so every field is checked before use. The
// same room shape arrives from /recent and from SSE "room" events.

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

// Links end up in href and window.open, so only web addresses are kept
function webUrl(value: unknown): string {
  const url = str(value)
  return /^https?:\/\//i.test(url) ? url : ''
}

function parseInfo(raw: unknown): RoomInfo {
  if (!isObject(raw)) return { handle: '', url: '', avatar: null }
  return {
    handle: str(raw.handle),
    url: webUrl(raw.url),
    avatar: webUrl(raw.avatar) || null,
  }
}

export function parseRoom(raw: unknown): Room | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.time !== 'number') return null
  return {
    time: raw.time,
    id: raw.id,
    msg: str(raw.msg),
    name: str(raw.name),
    source: str(raw.source).trim(),
    info: parseInfo(raw.info),
  }
}

export function parseStatistic(raw: unknown): Statistic | null {
  if (!isObject(raw) || typeof raw.online !== 'number' || typeof raw.past15m !== 'number') return null
  return { online: raw.online, past15m: raw.past15m }
}

/** Server time of a heartbeat, in unix milliseconds. */
export function parseHeartbeat(raw: unknown): number | null {
  return isObject(raw) && typeof raw.time === 'number' ? raw.time : null
}

/** JSON.parse that returns undefined instead of throwing on malformed input. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
