const BOOT_BURST_KEY = 'garbo-boot-burst'
const BOOT_WINDOW_MS = 12_000
const BOOT_BURST_LIMIT = 3

/**
 * Se o Safari recarregar a página várias vezes em poucos segundos
 * (crash → reload automático), entra em modo leve para não crashar de novo.
 */
export function markBootAndDetectLoop(): boolean {
  if (typeof sessionStorage === 'undefined') return false

  try {
    const now = Date.now()
    const raw = sessionStorage.getItem(BOOT_BURST_KEY)
    const prev = raw ? JSON.parse(raw) as { n?: number; at?: number } : {}
    const n = typeof prev.at === 'number' && now - prev.at < BOOT_WINDOW_MS
      ? (prev.n ?? 0) + 1
      : 1
    sessionStorage.setItem(BOOT_BURST_KEY, JSON.stringify({ n, at: now }))
    return n >= BOOT_BURST_LIMIT
  } catch {
    return false
  }
}
