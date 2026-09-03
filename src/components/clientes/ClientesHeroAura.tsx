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

/** Folha de ouro + veios de madeira — atmosfera de ateliê Garbo. */
const FRAGMENT = `
uniform float uTime;
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.14;

  vec3 ink = vec3(0.055, 0.028, 0.016);
  vec3 mahogany = vec3(0.14, 0.06, 0.032);
  vec3 lacquer = vec3(0.22, 0.1, 0.05);
  vec3 brass = vec3(0.95, 0.84, 0.55);
  vec3 cream = vec3(1.0, 0.97, 0.93);

  float grain = fbm(uv * vec2(7.5, 28.0) + vec2(t * 0.1, -t * 0.06));
  float vein = sin((uv.x * 14.0 + grain * 3.2 + t * 0.4) * 3.14159) * 0.5 + 0.5;
  float wash = exp(-length((uv - vec2(0.18, 0.55)) * vec2(1.35, 1.15)) * 1.65);
  float bloom = exp(-length((uv - vec2(0.82, 0.35)) * vec2(1.9, 1.7)) * 2.4);
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float rim = pow(1.0 - clamp(edge * 3.8, 0.0, 1.0), 2.6);
  float foil = pow(max(0.0, 1.0 - abs(uv.y - 0.42 - 0.04 * sin(t + uv.x * 4.0))), 12.0);
  float speck = hash(uv * 280.0 + t) * 0.045;
  float breath = 0.78 + 0.22 * sin(t * 1.15);

  vec3 wood = mix(ink, mahogany, uv.y * 0.7 + grain * 0.25);
  wood = mix(wood, lacquer, vein * 0.14 + wash * 0.12);
  wood += brass * (0.03 + wash * 0.12 * breath + foil * 0.28 + bloom * 0.1);
  wood = mix(wood, cream, wash * 0.04);
  wood += brass * rim * 0.22;
  wood += speck * brass;

  float alpha = 0.38 + wash * 0.14 + rim * 0.1 + foil * 0.08;
  gl_FragColor = vec4(wood, clamp(alpha, 0.28, 0.62));
}
`

interface ClientesHeroAuraProps {
  className?: string
}

export function ClientesHeroAura({ className }: ClientesHeroAuraProps) {
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
    let visible = true

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      const cap = isPhone ? 1.1 : 1.5
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
      renderer.setSize(w, h, false)
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
      material.uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime()
      renderer.render(scene, camera)
    }

    if (prefersReduced) {
      renderer.render(scene, camera)
    } else {
      draw()
    }

    return () => {
      running = false
      cancelAnimationFrame(frame)
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
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  )
}
