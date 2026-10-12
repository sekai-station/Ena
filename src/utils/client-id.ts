const STORAGE_KEY = 'station.client-id'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let clientId: Promise<string> | null = null

function loadOrCreate(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && UUID_V4.test(stored)) return stored.toLowerCase()
  } catch {
    // Storage may be unavailable; the module still keeps a session ID.
  }

  const id = createUuid()
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // A storage failure must not prevent the realtime connection.
  }
  return id
}

function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Shared across tabs and reconnects, with a lock for simultaneous first visits. */
export function getClientId(): Promise<string> {
  if (!clientId) {
    clientId = navigator.locks
      ? navigator.locks.request(STORAGE_KEY, loadOrCreate).catch(() => loadOrCreate())
      : Promise.resolve(loadOrCreate())
  }
  return clientId
}
