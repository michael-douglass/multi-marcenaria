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

const FRAGMENT = `
uniform float uTime;
uniform float uFocus;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.55;
  float scan = abs(uv.x - fract(t * 0.18));
  float filament = exp(-scan * 38.0) * (0.22 + uFocus * 0.55);
  float grain = hash(uv * 64.0 + t) * 0.07;
  float rim = pow(1.0 - abs(uv.y - 0.5) * 2.0, 3.0) * 0.18;
  vec3 gold = vec3(0.78, 0.58, 0.28);
  vec3 ink = vec3(0.16, 0.11, 0.07);
  vec3 color = mix(ink, gold, filament + rim * 0.35 + grain * 0.12);
  float alpha = 0.10 + filament * 0.55 + rim * 0.12 + uFocus * 0.08;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
}
`

/** Filete dourado atrás do buscador — só um brilho, sem atrapalhar a digitação. */
export function LeadModalSearchAura({
  className,
  focused = false,
}: {
  className?: string
  focused?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef(focused)
  focusRef.current = focused

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isCompactViewport = window.matchMedia('(max-width: 1024px)').matches
    if (prefersReduced || isCompactViewport) return

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
      uniforms: {
        uTime: { value: 0 },
        uFocus: { value: focused ? 1 : 0 },
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
      if (prefersReduced) return
      material.uniforms.uTime.value = clock.getElapsedTime()
      const target = focusRef.current ? 1 : 0.22
      material.uniforms.uFocus.value += (target - material.uniforms.uFocus.value) * 0.12
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

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', className)}
      aria-hidden
    />
  )
}
