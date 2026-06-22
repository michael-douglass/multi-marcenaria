import { useEffect, useRef, type RefObject } from 'react'
import { MOBILE_LAYOUT_MEDIA } from '@/hooks/useMobileLayout'
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

function blockTouchWhileAutoScroll(event: TouchEvent) {
  event.preventDefault()
}

function getScrollRange(el: HTMLElement): number {
  return el.scrollHeight - el.clientHeight
}

function isMobileLayout(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_LAYOUT_MEDIA).matches
}

/** No mobile a página rola em .obra-layout-scroll; no desktop, no kanban-scroll-host. */
function resolveVizScrollElement(
  scrollHostRef: RefObject<HTMLDivElement | null>,
): HTMLElement | null {
  if (isMobileLayout()) {
    return document.querySelector<HTMLElement>('.obra-layout-scroll')
  }
  return scrollHostRef.current
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
      const el = resolveVizScrollElement(scrollHostRef)
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
        ?? document.querySelector('.obra-layout-scroll')
      if (pollTarget) resizeObserver.observe(pollTarget)

      return () => {
        window.clearInterval(waitId)
        resizeObserver?.disconnect()
        detachScroll?.()
        const el = resolveVizScrollElement(scrollHostRef)
        if (el) writeVizScrollRatio(el)
      }
    }

    resizeObserver = new ResizeObserver(() => {
      const el = resolveVizScrollElement(scrollHostRef)
      if (el) restoreOnce(el)
    })

    const layoutScroll = document.querySelector('.obra-layout-scroll')
    if (layoutScroll) resizeObserver.observe(layoutScroll)

    const host = scrollHostRef.current
    if (host) {
      resizeObserver.observe(host)
      const content = host.querySelector('[data-zoom-content]')
      if (content) resizeObserver.observe(content)
    }

    return () => {
      resizeObserver?.disconnect()
      detachScroll?.()
      const el = resolveVizScrollElement(scrollHostRef)
      if (el) writeVizScrollRatio(el)
    }
  }, [ready, scrollHostRef])

  useEffect(() => {
    if (!enabled || !ready) return

    let raf = 0
    let lastTime = 0
    let pauseUntil = 0
    let lastPersist = 0
    let detachInputBlock: (() => void) | null = null

    const attachInputBlock = (el: HTMLElement) => {
      if (isMobileLayout()) {
        el.addEventListener('touchmove', blockTouchWhileAutoScroll, { passive: false, capture: true })
        return () => {
          el.removeEventListener('touchmove', blockTouchWhileAutoScroll, { capture: true })
        }
      }

      el.classList.add('kanban-scroll-host--viz-autoscroll')
      el.addEventListener('wheel', blockWheelWhileAutoScroll, { passive: false, capture: true })
      return () => {
        el.classList.remove('kanban-scroll-host--viz-autoscroll')
        el.removeEventListener('wheel', blockWheelWhileAutoScroll, { capture: true })
      }
    }

    const tick = (time: number) => {
      if (!enabledRef.current) return

      const scrollEl = resolveVizScrollElement(scrollHostRef)
      if (!scrollEl) {
        raf = requestAnimationFrame(tick)
        return
      }

      if (!detachInputBlock) {
        applyVizScrollRatio(scrollEl, readVizScrollRatio())
        detachInputBlock = attachInputBlock(scrollEl)
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
      detachInputBlock?.()
      const el = resolveVizScrollElement(scrollHostRef)
      if (el) writeVizScrollRatio(el)
    }
  }, [enabled, ready, scrollHostRef])
}
