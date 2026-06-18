const STORAGE_SCROLL_RATIO_KEY = 'movelaria:viz:scroll-ratio'
const STORAGE_ENABLED_KEY = 'movelaria:viz:auto-scroll'

export function readVizAutoScrollEnabled(): boolean {
  try {
    const value = sessionStorage.getItem(STORAGE_ENABLED_KEY)
    if (value === 'false') return false
    if (value === 'true') return true
  } catch {
    /* ignore */
  }
  return true
}

export function writeVizAutoScrollEnabled(enabled: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_ENABLED_KEY, String(enabled))
  } catch {
    /* ignore */
  }
}

export function readVizScrollRatio(): number {
  try {
    const value = sessionStorage.getItem(STORAGE_SCROLL_RATIO_KEY)
    const ratio = Number(value)
    if (!Number.isFinite(ratio)) return 0
    return Math.min(1, Math.max(0, ratio))
  } catch {
    return 0
  }
}

export function writeVizScrollRatio(el: HTMLElement): void {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return
  try {
    sessionStorage.setItem(STORAGE_SCROLL_RATIO_KEY, String(el.scrollTop / max))
  } catch {
    /* ignore */
  }
}

export function applyVizScrollRatio(el: HTMLElement, ratio: number): void {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) {
    el.scrollTop = 0
    return
  }
  el.scrollTop = ratio * max
}
