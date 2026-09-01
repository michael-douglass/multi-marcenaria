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
uniform vec3 uStatus;
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
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.52;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.18;
  vec3 mahogany = vec3(0.122, 0.055, 0.031);
  vec3 lacquer = vec3(0.196, 0.094, 0.055);
  vec3 gold = vec3(0.965, 0.863, 0.604);
  vec3 cream = vec3(1.0, 0.973, 0.933);

  float grain = fbm(uv * vec2(9.0, 22.0) + vec2(t * 0.12, -t * 0.08));
  float vein = sin((uv.y * 11.0 + grain * 2.8 + t * 0.35) * 3.14159) * 0.5 + 0.5;
  float wash = exp(-length((uv - vec2(0.12, 0.08)) * vec2(1.55, 1.9)) * 1.55);
  float corner = exp(-length((uv - vec2(0.92, 0.88)) * vec2(1.8, 1.6)) * 2.2);
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float rim = pow(1.0 - clamp(edge * 4.2, 0.0, 1.0), 2.4);
  float speckle = hash(uv * 240.0 + t) * 0.05;
  float pulse = 0.72 + 0.28 * sin(t * 1.4);

  vec3 wood = mix(mahogany, lacquer, uv.y * 0.55 + grain * 0.22);
  wood += gold * (0.045 + vein * 0.07 + wash * 0.22);
  wood = mix(wood, uStatus, corner * 0.28 * pulse + rim * 0.16);
  wood = mix(wood, cream, wash * 0.08);
  wood += gold * rim * (0.38 + pulse * 0.12);
  wood += speckle * gold;

  float alpha = 0.52 + wash * 0.22 + rim * 0.18 + corner * 0.1;
  gl_FragColor = vec4(wood, clamp(alpha, 0.42, 0.82));
}
`

function hexToColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex)
  } catch {
    return new THREE.Color('#f2d892')
  }
}

interface ObraDetalheLeadAuraProps {
  statusHex: string
  className?: string
}

/** Véu de mogno + ouro atrás da ficha do lead na obra. Some se o aparelho não aguentar. */
export function ObraDetalheLeadAura({ statusHex, className }: ObraDetalheLeadAuraProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef(statusHex)
  statusRef.current = statusHex

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

    const uniforms = {
      uTime: { value: 0 },
      uStatus: { value: hexToColor(statusRef.current) },
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

    const clock = new THREE.Clock()
    let frame = 0
    let running = true
    let visible = true
    let lastHex = ''

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35))
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
      uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime()
      if (statusRef.current !== lastHex) {
        lastHex = statusRef.current
        uniforms.uStatus.value.copy(hexToColor(lastHex))
      }
      renderer.render(scene, camera)
    }
    draw()

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
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', className)}
      aria-hidden
    />
  )
}
