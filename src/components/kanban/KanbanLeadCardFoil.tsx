import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/** Folha de ouro discreta — só no card ativo (hover/arraste). */
const FRAGMENT = `
uniform float uTime;
uniform vec3 uTint;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.35;
  float grain = noise(uv * vec2(18.0, 42.0) + t * 0.2);
  float sweep = pow(max(0.0, 1.0 - abs(uv.x - fract(t * 0.08) * 1.4 + 0.2)), 10.0);
  float wash = exp(-length((uv - vec2(0.15, 0.2)) * vec2(1.6, 1.9)) * 2.2);
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float rim = pow(1.0 - clamp(edge * 5.5, 0.0, 1.0), 2.2);

  vec3 gold = mix(vec3(0.95, 0.84, 0.55), uTint, 0.35);
  vec3 color = gold * (0.35 + sweep * 0.9 + wash * 0.45 + rim * 0.55 + grain * 0.12);
  float alpha = (0.08 + sweep * 0.16 + wash * 0.1 + rim * 0.12) * 0.85;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.28));
}
`

interface KanbanLeadCardFoilProps {
  active: boolean
  className?: string
  /** Cor da coluna (hex) para tingir o brilho. */
  tintHex?: string
}

/**
 * Brilho WebGL leve. Só monta o canvas enquanto o card está ativo —
 * evita dezenas de contextos no quadro do Pipeline.
 */
export function KanbanLeadCardFoil({
  active,
  className,
  tintHex = '#f2d892',
}: KanbanLeadCardFoilProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: 'low-power',
        }),
    )
    if (!renderer) return

    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.pointerEvents = 'none'
    host.appendChild(renderer.domElement)

    let tint = new THREE.Color('#f2d892')
    try {
      tint = new THREE.Color(tintHex)
    } catch {
      /* keep default */
    }

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uTint: { value: tint },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    const clock = new THREE.Clock()
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
      frame = requestAnimationFrame(draw)
      material.uniforms.uTime.value = clock.getElapsedTime()
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
  }, [active, tintHex])

  if (!active) return null

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 z-[1]', className)}
      aria-hidden
    />
  )
}
