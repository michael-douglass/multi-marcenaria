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
 * Aura do perfil (paleta clara): medalhão suave sobre papel —
 * anel âmbar, linho e luz quente. Opacidade baixa para o texto continuar nítido.
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
  float t = uTime * 0.02;
  float aspect = max(uResolution.x / max(uResolution.y, 1.0), 1.0);

  // Base clara (papel) em vez de tinta preta
  vec3 paper = vec3(0.99, 0.97, 0.93);
  vec3 oak = vec3(0.78, 0.62, 0.42);
  vec3 gold = vec3(0.72, 0.52, 0.24);
  vec3 amber = vec3(0.86, 0.62, 0.32);

  vec2 center = vec2(0.82, 0.22);
  vec2 d = (uv - center) * vec2(aspect, 1.0);
  float dist = length(d);
  float ring = smoothstep(0.014, 0.0, abs(dist - 0.18))
             + smoothstep(0.01, 0.0, abs(dist - 0.24)) * 0.65;
  float tick = step(0.88, fract(atan(d.y, d.x) / 6.28318 * 16.0 + t * 0.2));

  vec2 lampDelta = (uv - uPointer) * vec2(aspect, 1.0);
  float lamp = smoothstep(0.55, 0.0, length(lampDelta));
  float wash = exp(-length((uv - vec2(0.18, 0.08)) * vec2(1.2, 1.6)) * 1.35);
  float grain = hash(uv * 150.0 + t) * 0.03;
  float rule = smoothstep(0.97, 1.0, abs(sin(uv.y * 22.0 * 3.14159))) * 0.08;

  vec3 color = mix(paper, oak, wash * 0.22 + ring * 0.18);
  color = mix(color, gold, wash * 0.06 + ring * 0.4 * tick + rule * 0.28);
  color = mix(color, amber, lamp * 0.1);
  color += grain * gold * 0.2;

  float alpha = 0.03 + wash * 0.05 + lamp * 0.04 + ring * 0.06;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.12));
}
`

/** Fundo sutil da página de perfil CRM. */
export function ProfileAura({ className }: { className?: string }) {
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
      uPointer: { value: new THREE.Vector2(0.35, 0.7) },
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
      className={cn('profile-aura pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  )
}
