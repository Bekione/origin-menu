/**
 * Generates a stable per-device ID stored in localStorage.
 * Used to rate-limit waiter calls per device so a new customer sitting at
 * the same table isn't blocked by the previous customer's call.
 */
const STORAGE_KEY = 'origin_did'
const RATE_KEY_PREFIX = 'origin_wc_' // origin_wc_{tableNumber} = ISO timestamp

export async function getDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'server'

  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing

  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? 0,
    (navigator as any).platform ?? '',
  ]
    .join('|')
    .toLowerCase()

  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const id = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  localStorage.setItem(STORAGE_KEY, id)
  return id
}

const RATE_LIMIT_MS = 10 * 60 * 1000 // 10 minutes

/** Returns true if this device has already called for this table recently. */
export function isRateLimitedLocally(tableNumber: number): boolean {
  const key = `${RATE_KEY_PREFIX}${tableNumber}`
  const ts = localStorage.getItem(key)
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < RATE_LIMIT_MS
}

/** Record a successful waiter call for this device + table. */
export function recordWaiterCall(tableNumber: number): void {
  const key = `${RATE_KEY_PREFIX}${tableNumber}`
  localStorage.setItem(key, new Date().toISOString())
}
