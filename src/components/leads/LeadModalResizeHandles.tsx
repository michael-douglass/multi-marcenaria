import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'
import type { LeadResizeEdge } from '@/lib/lead-modal-size'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT = `
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.35;
  float grain = hash(uv * 28.0 + t) * 0.12;
  float diagonal = smoothstep(0.15, 0.95, (uv.x + uv.y) * 0.5);
  float pulse = 0.55 + 0.45 * sin(t + diagonal * 4.0);

  vec3 paper = vec3(0.996, 0.980, 0.955);
  vec3 ink = vec3(0.35, 0.22, 0.10);
  vec3 color = mix(paper, ink, diagonal * 0.35 * pulse + grain * 0.2);

  float alpha = 0.18 + diagonal * 0.28 * pulse;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.45));
}
`

function ResizeGripAura({ className }: { className?: string }) {
  const hostRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: true,
        }),
    )
    if (!renderer) return

    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.pointerEvents = 'none'
    host.appendChild(renderer.domElement)

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    const timer = new THREE.Timer()
    let frame = 0
    let running = true

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
      renderer.setSize(w, h, false)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const draw = () => {
      if (!running) return
      if (!prefersReduced) frame = requestAnimationFrame(draw)
      timer.update()
      material.uniforms.uTime.value = prefersReduced ? 0 : timer.getElapsed()
      renderer.render(scene, camera)
    }
    draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return <span ref={hostRef} className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden />
}

interface LeadModalResizeHandlesProps {
  isMobile: boolean
  isResizing: boolean
  onBeginResize: (edge: LeadResizeEdge, e: React.PointerEvent) => void
}

export function LeadModalResizeHandles({
  isMobile,
  isResizing,
  onBeginResize,
}: LeadModalResizeHandlesProps) {
  const edgePad = isMobile ? 'w-3' : 'w-1.5'
  const edgePadH = isMobile ? 'h-3' : 'h-1.5'
  const corner = isMobile ? 'h-7 w-7' : 'h-4 w-4'
  const handleClass =
    'absolute z-30 touch-none bg-transparent hover:bg-[color:var(--lead-gold)]/10 active:bg-[color:var(--lead-gold)]/16'

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-30', isResizing && 'select-none')}
      data-lead-resize-layer=""
      aria-hidden
    >
      {/* No celular: começa abaixo do cabeçalho para não cobrir o X / minimizar */}
      <div
        className={cn(
          handleClass,
          'pointer-events-auto right-0 bottom-10 cursor-ew-resize',
          edgePad,
          isMobile ? 'top-14' : 'top-10',
        )}
        onPointerDown={(e) => onBeginResize('e', e)}
      />
      <div
        className={cn(
          handleClass,
          'pointer-events-auto left-0 bottom-10 cursor-ew-resize',
          edgePad,
          isMobile ? 'top-14' : 'top-10',
        )}
        onPointerDown={(e) => onBeginResize('w', e)}
      />
      <div
        className={cn(handleClass, 'pointer-events-auto bottom-0 left-8 right-8 cursor-ns-resize', edgePadH)}
        onPointerDown={(e) => onBeginResize('s', e)}
      />
      {/* Topo: no celular deixa a faixa direita livre para os controles de fechar */}
      <div
        className={cn(
          handleClass,
          'pointer-events-auto top-0 cursor-ns-resize',
          edgePadH,
          isMobile ? 'left-8 right-24' : 'left-8 right-8',
        )}
        onPointerDown={(e) => onBeginResize('n', e)}
      />

      <div
        className={cn(handleClass, 'pointer-events-auto bottom-0 right-0 cursor-nwse-resize', corner)}
        onPointerDown={(e) => onBeginResize('se', e)}
        title="Redimensionar card"
      >
        <ResizeGripAura className="rounded-tl-md opacity-80" />
        <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b-2 border-r-2 border-[color:var(--lead-gold)]/70" />
      </div>
      <div
        className={cn(handleClass, 'pointer-events-auto bottom-0 left-0 cursor-nesw-resize', corner)}
        onPointerDown={(e) => onBeginResize('sw', e)}
      />
      {/* Cantos superiores: só no desktop — no celular cobriam o botão fechar */}
      {!isMobile ? (
        <>
          <div
            className={cn(handleClass, 'pointer-events-auto top-0 right-0 cursor-nesw-resize', corner)}
            onPointerDown={(e) => onBeginResize('ne', e)}
          />
          <div
            className={cn(handleClass, 'pointer-events-auto top-0 left-0 cursor-nwse-resize', corner)}
            onPointerDown={(e) => onBeginResize('nw', e)}
          />
        </>
      ) : null}
    </div>
  )
}
