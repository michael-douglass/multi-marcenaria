import { useEffect, useRef } from 'react'

interface GarboPontuaPointsSceneProps {
  className?: string
  active?: boolean
}

/** Campo de pontos dourados orbitando — metáfora do Pontua. Canvas 2D (sem pacote three). */
export function GarboPontuaPointsScene({ className, active = true }: GarboPontuaPointsSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    host.appendChild(canvas)

    const count = 48
    const dots = Array.from({ length: count }, (_, i) => ({
      radius: 40 + (i % 12) * 14,
      speed: 0.18 + (i % 7) * 0.04,
      phase: (i / count) * Math.PI * 2,
      yAmp: 18 + (i % 5) * 8,
      size: 2 + (i % 4),
    }))

    let frame = 0
    let running = true
    const started = performance.now()

    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const draw = (now: number) => {
      if (!running) return
      frame = requestAnimationFrame(draw)
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      ctx.clearRect(0, 0, w, h)
      const t = (now - started) / 1000
      const cx = w / 2
      const cy = h / 2
      ctx.strokeStyle = 'rgba(242,216,146,0.28)'
      ctx.beginPath()
      ctx.arc(cx, cy, 36, 0, Math.PI * 2)
      ctx.stroke()
      if (!active) return
      dots.forEach((d, i) => {
        const a = prefersReduced ? d.phase : t * d.speed + d.phase
        const x = cx + Math.cos(a) * d.radius
        const y = cy + Math.sin(a * 1.35) * d.yAmp + Math.sin(a) * (d.radius * 0.18)
        ctx.fillStyle = i > 30 ? 'rgba(196,168,130,0.9)' : 'rgba(242,216,146,0.95)'
        ctx.beginPath()
        ctx.arc(x, y, d.size, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    draw(performance.now())

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      if (canvas.parentElement === host) host.removeChild(canvas)
    }
  }, [active])

  return <div ref={hostRef} className={className} aria-hidden style={{ touchAction: 'none' }} />
}
