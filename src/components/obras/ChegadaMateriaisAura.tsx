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

/**
 * Aura da chegada de materiais: 7 colunas de semana + brilho âmbar
 * (como luz de madeira no ateliê). Opacidade baixa para não atrapalhar a leitura.
 */
const FRAGMENT = `
uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.022;
  float aspect = max(uResolution.x / max(uResolution.y, 1.0), 1.0);

  vec3 ink = vec3(0.06, 0.03, 0.015);
  vec3 oak = vec3(0.72, 0.52, 0.28);
  vec3 gold = vec3(0.95, 0.78, 0.42);
  vec3 amber = vec3(0.86, 0.48, 0.18);

  // Sete faixas verticais — eco da grade semanal
  float col = fract(uv.x * 7.0);
  float colLine = smoothstep(0.0, 0.02, col) * smoothstep(0.05, 0.02, col);
  float colWash = pow(1.0 - abs(col - 0.5) * 2.0, 2.2) * 0.12;

  // Linhas horizontais leves (linhas de agenda)
  float row = fract(uv.y * 11.0 + t * 0.15);
  float rowLine = smoothstep(0.0, 0.03, row) * smoothstep(0.06, 0.03, row) * 0.08;

  vec2 lampDelta = (uv - uPointer) * vec2(aspect, 1.0);
  float lamp = smoothstep(0.55, 0.0, length(lampDelta));
  float wash = exp(-length((uv - vec2(0.5, 0.12)) * vec2(1.1, 1.8)) * 1.4);
  float grain = hash(uv * 140.0 + t) * 0.04;

  vec3 color = mix(ink, oak, wash * 0.35 + colWash * 0.4);
  color = mix(color, gold, wash * 0.12 + colLine * 0.55 + rowLine);
  color = mix(color, amber, lamp * 0.18);
  color += grain * gold * 0.35;

  float alpha = 0.045 + wash * 0.06 + lamp * 0.05 + colLine * 0.07 + rowLine * 0.04;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.14));
}
`

/** Fundo sutil da página Chegada de Materiais — grade de semana + âmbar. */
export function ChegadaMateriaisAura({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isPhone = window.matchMedia('(max-width: 767px)').matches
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

    const uniforms = {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.75) },
      uResolution: { value: new THREE.Vector2(1, 1) },
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

    const pointer = uniforms.uPointer.value as THREE.Vector2
    const onMove = (event: PointerEvent) => {
      if (prefersReduced) return
      const rect = host.getBoundingClientRect()
      pointer.set(
        (event.clientX - rect.left) / Math.max(rect.width, 1),
        1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
      )
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let frame = 0
    let running = true
    let visible = true
    const startedAt = performance.now()

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? 1.1 : 1.35))
      renderer.setSize(w, h, false)
      uniforms.uResolution.value.set(w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting !== false
      },
      { threshold: 0.05 },
    )
    io.observe(host)

    const draw = () => {
      if (!running) return
      if (!prefersReduced) frame = requestAnimationFrame(draw)
      if (!visible) return
      uniforms.uTime.value = prefersReduced ? 0 : (performance.now() - startedAt) / 1000
      renderer.render(scene, camera)
    }

    if (prefersReduced) renderer.render(scene, camera)
    else draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      ro.disconnect()
      io.disconnect()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={cn('chegada-materiais-aura pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  )
}
