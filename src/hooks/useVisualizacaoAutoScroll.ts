import { useEffect, useRef } from 'react'

const SCROLL_SELECTOR = '.obra-page-shell--visualizacao .kanban-scroll-host, .obra-layout-scroll'
const PIXELS_PER_SECOND = 32
const PAUSE_AT_BOTTOM_MS = 1200

function getScrollElement(): HTMLElement | null {
  const vizHost = document.querySelector<HTMLElement>(
    '.obra-page-shell--visualizacao .kanban-scroll-host',
  )
  if (vizHost && vizHost.scrollHeight > vizHost.clientHeight + 8) {
    return vizHost
  }
  return document.querySelector<HTMLElement>('.obra-layout-scroll')
}

export function useVisualizacaoAutoScroll(enabled: boolean) {
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) return

    let raf = 0
    let lastTime = 0
    let pauseUntil = 0

    const tick = (time: number) => {
      if (!enabledRef.current) return

      if (!lastTime) lastTime = time
      const dt = Math.min(time - lastTime, 48)
      lastTime = time

      const el = getScrollElement()
      if (el && time >= pauseUntil) {
        const max = el.scrollHeight - el.clientHeight
        if (max > 8) {
          const delta = (PIXELS_PER_SECOND * dt) / 1000
          if (el.scrollTop >= max - 2) {
            el.scrollTop = 0
            pauseUntil = time + PAUSE_AT_BOTTOM_MS
          } else {
            el.scrollTop += delta
          }
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
}
