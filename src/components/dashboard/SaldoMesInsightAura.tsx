import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'
import type { SaldoMesInsightTone } from '@/lib/saldo-mes-insight'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Aura do card de saldo: lavagem de papel + brilho suave no tom do insight.
 * Alpha baixo para não competir com o texto.
 */
const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uAccent;
uniform float uReveal;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float aspect = max(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (uv - vec2(0.72, 0.18)) * vec2(aspect, 1.0);
  float dist = length(p);
  float wash = exp(-dist * 2.4);
  float sweep = 0.5 + 0.5 * sin(uTime * 1.1 + uv.x * 4.0);
  float grain = hash(uv * 140.0 + uTime * 0.2) * 0.04;
  float revealBand = smoothstep(0.38, 0.92, uv.y) * uReveal;

  vec3 paper = vec3(1.0, 0.988, 0.972);
  vec3 oak = vec3(0.93, 0.86, 0.76);
  vec3 color = mix(paper, oak, wash * 0.35);
  color = mix(color, uAccent, wash * (0.18 + sweep * 0.12) + revealBand * 0.14);
  color += grain;

  float alpha = 0.12 + wash * 0.22 + revealBand * 0.08;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.38));
}
`

const ACCENT_RGB: Record<SaldoMesInsightTone, [number, number, number]> = {
  sucesso: [0.05, 0.59, 0.41],
  quase: [0.78, 0.58, 0.25],
  falta: [0.78, 0.45, 0.22],
  alerta: [0.86, 0.15, 0.15],
}

export function SaldoMesInsightAura({
  tone,
  reveal = 0,
  className,
}: {
  tone: SaldoMesInsightTone
  /** 0–1: painel dos próximos meses aberto (shader acompanha). */
  reveal?: number
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const toneRef = useRef(tone)
  const revealRef = useRef(reveal)
  toneRef.current = tone
  revealRef.current = reveal

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

    const [r, g, b] = ACCENT_RGB[toneRef.current]
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uAccent: { value: new THREE.Vector3(r, g, b) },
      uReveal: { value: revealRef.current },
    }
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    let frame = 0
    let running = true
    const startedAt = performance.now()

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(1)
      renderer.setSize(w, h, false)
      uniforms.uResolution.value.set(w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const draw = () => {
      if (!running) return
      if (!prefersReduced) frame = requestAnimationFrame(draw)
      const [ar, ag, ab] = ACCENT_RGB[toneRef.current]
      uniforms.uAccent.value.set(ar, ag, ab)
      uniforms.uReveal.value = revealRef.current
      uniforms.uTime.value = prefersReduced ? 0 : (performance.now() - startedAt) / 1000
      renderer.render(scene, camera)
    }

    if (prefersReduced) renderer.render(scene, camera)
    else draw()

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

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 opacity-95', className)}
      aria-hidden
    />
  )
}
