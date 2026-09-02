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
 * Aura do perfil: medalhão / placa de identificação do ateliê —
 * anel dourado, linho e luz âmbar. Opacidade baixa para o texto continuar nítido.
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

  vec3 ink = vec3(0.05, 0.025, 0.012);
  vec3 oak = vec3(0.68, 0.48, 0.26);
  vec3 gold = vec3(0.94, 0.78, 0.42);
  vec3 amber = vec3(0.82, 0.46, 0.16);

  vec2 center = vec2(0.82, 0.22);
  vec2 d = (uv - center) * vec2(aspect, 1.0);
  float dist = length(d);
  float ring = smoothstep(0.014, 0.0, abs(dist - 0.18))
             + smoothstep(0.01, 0.0, abs(dist - 0.24)) * 0.65;
  float tick = step(0.88, fract(atan(d.y, d.x) / 6.28318 * 16.0 + t * 0.2));

  vec2 lampDelta = (uv - uPointer) * vec2(aspect, 1.0);
  float lamp = smoothstep(0.55, 0.0, length(lampDelta));
  float wash = exp(-length((uv - vec2(0.18, 0.08)) * vec2(1.2, 1.6)) * 1.35);
  float grain = hash(uv * 150.0 + t) * 0.04;
  float rule = smoothstep(0.97, 1.0, abs(sin(uv.y * 22.0 * 3.14159))) * 0.1;

  vec3 color = mix(ink, oak, wash * 0.4 + ring * 0.25);
  color = mix(color, gold, wash * 0.08 + ring * 0.55 * tick + rule * 0.4);
  color = mix(color, amber, lamp * 0.16);
  color += grain * gold * 0.3;

  float alpha = 0.05 + wash * 0.06 + lamp * 0.05 + ring * 0.08;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.15));
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
