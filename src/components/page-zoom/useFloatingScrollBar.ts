import { useCallback, useEffect, useRef, useState } from 'react'

export const SCROLLBAR_MIN_THUMB = 40
export const SCROLLBAR_HEIGHT = 14
export const SCROLLBAR_PADDING = 8

export interface HorizontalScrollMetrics {
  visible: boolean
  thumbWidthPercent: number
  thumbLeftPercent: number
}

export interface VerticalScrollMetrics {
  visible: boolean
  thumbHeightPercent: number
  thumbTopPercent: number
}

const HIDDEN_HORIZONTAL: HorizontalScrollMetrics = {
  visible: false,
  thumbWidthPercent: 0,
  thumbLeftPercent: 0,
}

const HIDDEN_VERTICAL: VerticalScrollMetrics = {
  visible: false,
  thumbHeightPercent: 0,
  thumbTopPercent: 0,
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0
  const value = numerator / denominator
  return Number.isFinite(value) ? value : 0
}

function getContentMetrics(el: HTMLElement) {
  return {
    scrollWidth: el.scrollWidth,
    scrollHeight: el.scrollHeight,
    clientWidth: el.clientWidth,
    clientHeight: el.clientHeight,
    scrollLeft: el.scrollLeft,
    scrollTop: el.scrollTop,
  }
}

export function computeHorizontalMetrics(el: HTMLElement): HorizontalScrollMetrics {
  const { scrollWidth, clientWidth, scrollLeft } = getContentMetrics(el)
  if (clientWidth <= 0 || scrollWidth <= 0) return HIDDEN_HORIZONTAL

  const maxScroll = scrollWidth - clientWidth
  if (maxScroll <= 1) return HIDDEN_HORIZONTAL

  const thumbWidthPercent = Math.min(100, Math.max(8, safeRatio(clientWidth, scrollWidth) * 100))
  const scrollRatio = safeRatio(scrollLeft, maxScroll)
  const thumbLeftPercent = scrollRatio * Math.max(0, 100 - thumbWidthPercent)

  if (!Number.isFinite(thumbWidthPercent) || !Number.isFinite(thumbLeftPercent)) {
    return HIDDEN_HORIZONTAL
  }

  return {
    visible: true,
    thumbWidthPercent,
    thumbLeftPercent,
  }
}

export function computeVerticalMetrics(el: HTMLElement): VerticalScrollMetrics {
  const { scrollHeight, clientHeight, scrollTop } = getContentMetrics(el)
  if (clientHeight <= 0 || scrollHeight <= 0) return HIDDEN_VERTICAL

  const maxScroll = scrollHeight - clientHeight
  if (maxScroll <= 1) return HIDDEN_VERTICAL

  const thumbHeightPercent = Math.min(100, Math.max(8, safeRatio(clientHeight, scrollHeight) * 100))
  const scrollRatio = safeRatio(scrollTop, maxScroll)
  const thumbTopPercent = scrollRatio * Math.max(0, 100 - thumbHeightPercent)

  if (!Number.isFinite(thumbHeightPercent) || !Number.isFinite(thumbTopPercent)) {
    return HIDDEN_VERTICAL
  }

  return {
    visible: true,
    thumbHeightPercent,
    thumbTopPercent,
  }
}

interface UseFloatingScrollMetricsOptions {
  enabled?: boolean
  horizontal?: boolean
  vertical?: boolean
  zoom?: number
  /** Quando muda (ex.: dados carregados), recalcula métricas. */
  contentSignal?: unknown
}

export function useFloatingScrollMetrics(
  scrollRef: React.RefObject<HTMLElement | null>,
  {
    enabled = true,
    horizontal = true,
    vertical = true,
    zoom,
    contentSignal,
  }: UseFloatingScrollMetricsOptions = {},
) {
  const [horizontalMetrics, setHorizontalMetrics] = useState(HIDDEN_HORIZONTAL)
  const [verticalMetrics, setVerticalMetrics] = useState(HIDDEN_VERTICAL)

  const computeMetrics = useCallback(() => {
    const el = scrollRef.current
    if (!el || !enabled) {
      setHorizontalMetrics(HIDDEN_HORIZONTAL)
      setVerticalMetrics(HIDDEN_VERTICAL)
      return
    }

    if (horizontal) setHorizontalMetrics(computeHorizontalMetrics(el))
    else setHorizontalMetrics(HIDDEN_HORIZONTAL)

    if (vertical) setVerticalMetrics(computeVerticalMetrics(el))
    else setVerticalMetrics(HIDDEN_VERTICAL)
  }, [scrollRef, enabled, horizontal, vertical])

  useEffect(() => {
    computeMetrics()

    const el = scrollRef.current
    if (!el) return

    const observer = new ResizeObserver(() => computeMetrics())
    observer.observe(el)

    const contentRoot = el.querySelector('[data-zoom-content]')
    if (contentRoot) observer.observe(contentRoot)

    const mutationObserver = new MutationObserver(() => computeMetrics())
    mutationObserver.observe(el, { childList: true, subtree: true, attributes: true })

    const onWindowChange = () => computeMetrics()
    window.addEventListener('resize', onWindowChange)

    const raf = requestAnimationFrame(computeMetrics)
    const t1 = window.setTimeout(computeMetrics, 50)
    const t2 = window.setTimeout(computeMetrics, 250)

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', onWindowChange)
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [computeMetrics, scrollRef, zoom, contentSignal])

  return { horizontalMetrics, verticalMetrics, computeMetrics }
}

export function useScrollbarDrag(
  scrollRef: React.RefObject<HTMLElement | null>,
  axis: 'x' | 'y',
  onScroll: () => void,
) {
  const dragState = useRef<{ startPointer: number; startScroll: number; maxScroll: number; travel: number } | null>(null)

  const onThumbPointerDown = useCallback((e: React.PointerEvent, travel: number) => {
    const el = scrollRef.current
    if (!el || travel <= 0) return

    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    dragState.current = {
      startPointer: axis === 'x' ? e.clientX : e.clientY,
      startScroll: axis === 'x' ? el.scrollLeft : el.scrollTop,
      maxScroll: axis === 'x'
        ? el.scrollWidth - el.clientWidth
        : el.scrollHeight - el.clientHeight,
      travel,
    }
  }, [scrollRef, axis])

  const onThumbPointerMove = useCallback((e: React.PointerEvent, travel: number) => {
    if (!dragState.current) return
    const el = scrollRef.current
    if (!el) return

    const pointer = axis === 'x' ? e.clientX : e.clientY
    const delta = pointer - dragState.current.startPointer
    const scrollDelta = (delta / travel) * dragState.current.maxScroll

    if (axis === 'x') el.scrollLeft = dragState.current.startScroll + scrollDelta
    else el.scrollTop = dragState.current.startScroll + scrollDelta

    onScroll()
  }, [scrollRef, axis, onScroll])

  const onThumbPointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onTrackPointerDown = useCallback((
    e: React.PointerEvent,
    trackSize: number,
    thumbSize: number,
    trackOffset: number,
  ) => {
    const el = scrollRef.current
    if (!el || (e.target as HTMLElement).dataset.scrollbarThumb === 'true') return

    e.preventDefault()

    const maxScroll = axis === 'x'
      ? el.scrollWidth - el.clientWidth
      : el.scrollHeight - el.clientHeight
    const travel = Math.max(0, trackSize - thumbSize)
    const pointer = axis === 'x' ? e.clientX : e.clientY
    const clickOffset = pointer - trackOffset - thumbSize / 2
    const ratio = travel > 0 ? clickOffset / travel : 0
    const next = Math.max(0, Math.min(maxScroll, ratio * maxScroll))

    if (axis === 'x') el.scrollLeft = next
    else el.scrollTop = next

    onScroll()
  }, [scrollRef, axis, onScroll])

  return { onThumbPointerDown, onThumbPointerMove, onThumbPointerUp, onTrackPointerDown }
}
