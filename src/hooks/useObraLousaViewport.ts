import { useCallback, useEffect, useRef, useState } from 'react'

export interface ViewportState {
  scale: number
  offsetX: number
  offsetY: number
}

interface UseObraLousaViewportOptions {
  worldWidth: number
  worldHeight: number
  containerWidth: number
  containerHeight: number
}

export function useObraLousaViewport({
  worldWidth,
  worldHeight,
  containerWidth,
  containerHeight,
}: UseObraLousaViewportOptions) {
  const [viewport, setViewport] = useState<ViewportState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const panningRef = useRef(false)
  const lastPanRef = useRef<{ x: number; y: number } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)

  const fit = useCallback(() => {
    if (!worldWidth || !worldHeight || !containerWidth || !containerHeight) return
    const pad = 24
    const sx = (containerWidth - pad * 2) / worldWidth
    const sy = (containerHeight - pad * 2) / worldHeight
    const scale = Math.min(sx, sy, 1.5)
    const offsetX = (containerWidth - worldWidth * scale) / 2
    const offsetY = (containerHeight - worldHeight * scale) / 2
    setViewport({ scale: Math.max(0.1, scale), offsetX, offsetY })
  }, [worldWidth, worldHeight, containerWidth, containerHeight])

  useEffect(() => {
    fit()
  }, [fit])

  const screenToWorld = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - viewport.offsetX) / viewport.scale,
      y: (sy - viewport.offsetY) / viewport.scale,
    }
  }, [viewport])

  const zoomBy = useCallback((factor: number, centerX?: number, centerY?: number) => {
    setViewport(prev => {
      const nextScale = Math.min(5, Math.max(0.15, prev.scale * factor))
      const cx = centerX ?? containerWidth / 2
      const cy = centerY ?? containerHeight / 2
      const wx = (cx - prev.offsetX) / prev.scale
      const wy = (cy - prev.offsetY) / prev.scale
      return {
        scale: nextScale,
        offsetX: cx - wx * nextScale,
        offsetY: cy - wy * nextScale,
      }
    })
  }, [containerWidth, containerHeight])

  const startPan = useCallback((x: number, y: number) => {
    panningRef.current = true
    lastPanRef.current = { x, y }
  }, [])

  const movePan = useCallback((x: number, y: number) => {
    if (!panningRef.current || !lastPanRef.current) return
    const dx = x - lastPanRef.current.x
    const dy = y - lastPanRef.current.y
    lastPanRef.current = { x, y }
    setViewport(prev => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }))
  }, [])

  const endPan = useCallback(() => {
    panningRef.current = false
    lastPanRef.current = null
  }, [])

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    zoomBy(factor, e.offsetX, e.offsetY)
  }, [zoomBy])

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      pinchRef.current = { dist: d, scale: viewport.scale }
    }
  }, [viewport.scale])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      const factor = d / pinchRef.current.dist
      const nextScale = Math.min(5, Math.max(0.15, pinchRef.current.scale * factor))
      setViewport(prev => ({ ...prev, scale: nextScale }))
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null
  }, [])

  return {
    viewport,
    fit,
    zoomBy,
    screenToWorld,
    startPan,
    movePan,
    endPan,
    onWheel,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
