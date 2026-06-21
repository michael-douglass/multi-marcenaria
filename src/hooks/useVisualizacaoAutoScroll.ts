import { useEffect, useRef, type RefObject } from 'react'
import {
  applyVizScrollRatio,
  readVizScrollRatio,
  writeVizScrollRatio,
} from '@/lib/visualizacao-autoscroll-storage'

/** Velocidade da rolagem automática (px/s). */
const PIXELS_PER_SECOND = 30
const PAUSE_AT_BOTTOM_MS = 1500
const PERSIST_INTERVAL_MS = 400
const MIN_SCROLL_RANGE = 4

function blockWheelWhileAutoScroll(event: WheelEvent) {
  event.preventDefault()
}

function getScrollRange(el: HTMLElement): number {
  return el.scrollHeight - el.clientHeight
}

export function useVisualizacaoAutoScroll(
  enabled: boolean,
  ready: boolean,
  scrollHostRef: RefObject<HTMLDivElement | null>,
  onReachBottom?: () => void,
) {
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const onReachBottomRef = useRef(onReachBottom)
  onReachBottomRef.current = onReachBottom

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
    let detachScroll: (() => void) | null = null
    let resizeObserver: ResizeObserver | null = null

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

    const bindElement = (el: HTMLElement) => {
      restoreOnce(el)
      detachScroll?.()
      detachScroll = attachScrollPersistence(el)
    }

    const tryBind = () => {
      const el = scrollHostRef.current
      if (!el) return false
      bindElement(el)
      return true
    }

    if (!tryBind()) {
      const waitId = window.setInterval(() => {
        if (tryBind()) window.clearInterval(waitId)
      }, 50)

      resizeObserver = new ResizeObserver(() => {
        tryBind()
      })

      const pollTarget = scrollHostRef.current?.parentElement
      if (pollTarget) resizeObserver.observe(pollTarget)

      return () => {
        window.clearInterval(waitId)
        resizeObserver?.disconnect()
        detachScroll?.()
        const el = scrollHostRef.current
        if (el) writeVizScrollRatio(el)
      }
    }

    resizeObserver = new ResizeObserver(() => {
      const el = scrollHostRef.current
      if (el) restoreOnce(el)
    })
    resizeObserver.observe(scrollHostRef.current)
    const content = scrollHostRef.current.querySelector('[data-zoom-content]')
    if (content) resizeObserver.observe(content)

    return () => {
      resizeObserver?.disconnect()
      detachScroll?.()
      const el = scrollHostRef.current
      if (el) writeVizScrollRatio(el)
    }
  }, [ready, scrollHostRef])

  useEffect(() => {
    if (!enabled || !ready) return

    let raf = 0
    let lastTime = 0
    let pauseUntil = 0
    let lastPersist = 0
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

      const scrollEl = scrollHostRef.current
      if (!scrollEl) {
        raf = requestAnimationFrame(tick)
        return
      }

      if (!detachWheel) {
        applyVizScrollRatio(scrollEl, readVizScrollRatio())
        detachWheel = attachWheelBlock(scrollEl)
      }

      if (!lastTime) lastTime = time
      const dt = Math.min(time - lastTime, 48)
      lastTime = time

      if (time >= pauseUntil) {
        const max = getScrollRange(scrollEl)
        if (max > MIN_SCROLL_RANGE) {
          const delta = (PIXELS_PER_SECOND * dt) / 1000
          const nextTop = scrollEl.scrollTop + delta

          if (nextTop >= max - 1) {
            onReachBottomRef.current?.()
            scrollEl.scrollTo({ top: 0, behavior: 'instant' })
            writeVizScrollRatio(scrollEl)
            pauseUntil = time + PAUSE_AT_BOTTOM_MS
          } else {
            scrollEl.scrollTo({ top: nextTop, behavior: 'instant' })
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
      const el = scrollHostRef.current
      if (el) writeVizScrollRatio(el)
    }
  }, [enabled, ready, scrollHostRef])
}
