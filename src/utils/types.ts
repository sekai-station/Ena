// ─── Backend Model Types ─────────────────────────────────────────────────────

// The same fields whatever the platform (built by the backend's v2 encoder)
export interface RoomInfo {
  handle: string          // "@user" on X, nickname or "QQ:<number>" on QQ; may be empty
  url: string             // the original post; empty when there is none
  avatar: string | null   // null when there is none or the server does not send avatars
}

export interface Room {
  time: number      // unix seconds
  id: string        // 5-digit room ID
  msg: string       // room message
  name: string      // display name
  source?: string | null // optional channel: "x", "qq", etc.; empty means none
  info: RoomInfo
}

export interface Statistic {
  online: number
  past15m: number
}

export interface Announcement {
  time: number
  msg: string
}

export interface PastCount {
  past15m: number
  past1h: number
  past24h: number
}

export interface ChannelHealth {
  name: string
  tick: number[]    // 60 ints, one per minute
}

export interface StatusData {
  pastCount: PastCount
  channelHealth: ChannelHealth[]
}

// ─── API Envelope ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  code: number
  data: T
  error?: string
}

// ─── Stream Item (room or injected announcement) ─────────────────────────────

export interface StreamAnnouncement {
  kind: 'announcement'
  time: number      // position in the stream (unix seconds), not the publish time
  msg: string
}

export type StreamItem = Room | StreamAnnouncement

export function isAnnouncement(item: StreamItem): item is StreamAnnouncement {
  return 'kind' in item
}

export function roomKey(room: Room): string {
  return `${room.id}-${room.time}`
}
