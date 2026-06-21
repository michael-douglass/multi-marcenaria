import { useEffect, type RefObject } from 'react'

const PIXELS_PER_SECOND = 26
const PAUSE_AT_EDGE_MS = 1200
const MIN_SCROLL_RANGE = 4

export function useElementAutoScroll(
  enabled: boolean,
  scrollRef: RefObject<HTMLElement | null>,
  resetKey = 0,
) {
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0

    if (!enabled) return

    let raf = 0
    let lastTime = 0
    let pauseUntil = 0

    const tick = (time: number) => {
      const el = scrollRef.current
      if (!el) {
        raf = requestAnimationFrame(tick)
        return
      }

      const max = el.scrollHeight - el.clientHeight
      if (max <= MIN_SCROLL_RANGE) {
        raf = requestAnimationFrame(tick)
        return
      }

      if (!lastTime) lastTime = time
      const dt = Math.min(time - lastTime, 48)
      lastTime = time

      if (time >= pauseUntil) {
        const delta = (PIXELS_PER_SECOND * dt) / 1000
        const nextTop = el.scrollTop + delta

        if (nextTop >= max - 1) {
          el.scrollTop = 0
          pauseUntil = time + PAUSE_AT_EDGE_MS
        } else {
          el.scrollTop = nextTop
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled, scrollRef, resetKey])
}

export function listNeedsAutoScroll(el: HTMLElement | null): boolean {
  if (!el) return false
  return el.scrollHeight - el.clientHeight > MIN_SCROLL_RANGE
}
