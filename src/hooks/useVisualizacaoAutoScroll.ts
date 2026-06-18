import { useEffect, useRef } from 'react'
import {
  applyVizScrollRatio,
  readVizScrollRatio,
  writeVizScrollRatio,
} from '@/lib/visualizacao-autoscroll-storage'

const PIXELS_PER_SECOND = 32
const PAUSE_AT_BOTTOM_MS = 1200
const PERSIST_INTERVAL_MS = 400

function resolveScrollElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.obra-page-shell--visualizacao .kanban-scroll-host',
  )
}

function blockWheelWhileAutoScroll(event: WheelEvent) {
  event.preventDefault()
}

export function useVisualizacaoAutoScroll(enabled: boolean, ready: boolean) {
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const layout = document.querySelector('.obra-layout-scroll')
    if (enabled) {
      layout?.classList.add('obra-layout-scroll--viz-autoscroll')
    } else {
      layout?.classList.remove('obra-layout-scroll--viz-autoscroll')
    }
    return () => layout?.classList.remove('obra-layout-scroll--viz-autoscroll')
  }, [enabled])

  useEffect(() => {
    if (!ready) return

    let restored = false
    let detachWheel: (() => void) | null = null
    let detachScroll: (() => void) | null = null

    const restoreOnce = (el: HTMLElement) => {
      if (restored) return
      applyVizScrollRatio(el, readVizScrollRatio())
      restored = true
    }

    const attachScrollPersistence = (el: HTMLElement) => {
      let lastPersist = 0
      const onScroll = () => {
        const now = performance.now()
        if (now - lastPersist < PERSIST_INTERVAL_MS) return
        lastPersist = now
        writeVizScrollRatio(el)
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }

    const waitForElement = window.setInterval(() => {
      const el = resolveScrollElement()
      if (!el) return

      window.clearInterval(waitForElement)
      restoreOnce(el)
      detachScroll = attachScrollPersistence(el)
    }, 50)

    return () => {
      window.clearInterval(waitForElement)
      detachWheel?.()
      detachScroll?.()
      const el = resolveScrollElement()
      if (el) writeVizScrollRatio(el)
    }
  }, [ready])

  useEffect(() => {
    if (!enabled || !ready) return

    let raf = 0
    let lastTime = 0
    let pauseUntil = 0
    let lastPersist = 0
    let scrollEl: HTMLElement | null = null
    let detachWheel: (() => void) | null = null

    const attachWheelBlock = (el: HTMLElement) => {
      el.classList.add('kanban-scroll-host--viz-autoscroll')
      el.addEventListener('wheel', blockWheelWhileAutoScroll, { passive: false, capture: true })
      return () => {
        el.classList.remove('kanban-scroll-host--viz-autoscroll')
        el.removeEventListener('wheel', blockWheelWhileAutoScroll, { capture: true })
      }
    }

    const tick = (time: number) => {
      if (!enabledRef.current) return

      if (!scrollEl || !scrollEl.isConnected) {
        scrollEl = resolveScrollElement()
        if (scrollEl && !detachWheel) {
          applyVizScrollRatio(scrollEl, readVizScrollRatio())
          detachWheel = attachWheelBlock(scrollEl)
        }
      }

      if (!scrollEl) {
        raf = requestAnimationFrame(tick)
        return
      }

      if (!lastTime) lastTime = time
      const dt = Math.min(time - lastTime, 48)
      lastTime = time

      if (time >= pauseUntil) {
        const max = scrollEl.scrollHeight - scrollEl.clientHeight
        if (max > 8) {
          const delta = (PIXELS_PER_SECOND * dt) / 1000
          if (scrollEl.scrollTop >= max - 2) {
            scrollEl.scrollTop = 0
            writeVizScrollRatio(scrollEl)
            pauseUntil = time + PAUSE_AT_BOTTOM_MS
          } else {
            scrollEl.scrollTop += delta
            if (time - lastPersist >= PERSIST_INTERVAL_MS) {
              lastPersist = time
              writeVizScrollRatio(scrollEl)
            }
          }
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      detachWheel?.()
      if (scrollEl) writeVizScrollRatio(scrollEl)
    }
  }, [enabled, ready])
}
