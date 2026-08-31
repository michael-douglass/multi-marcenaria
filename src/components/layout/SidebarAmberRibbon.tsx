import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'

interface SidebarAmberRibbonProps {
  className?: string
  /** Pausa o loop quando o menu está recolhido ou a aba está oculta. */
  active?: boolean
}

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT = `
uniform float time;
uniform vec2 resolution;
varying vec2 vUv;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  float t = time * 0.18;

  float grain = noise(uv * vec2(18.0, 9.0) + vec2(t * 0.4, -t * 0.15));
  float ribbon = noise(vec2(uv.x * 3.2 + t, uv.y * 1.6 - t * 0.35));
  float wave = sin(uv.x * 9.0 + t * 1.4 + ribbon * 4.0) * 0.5 + 0.5;
  float rim = pow(1.0 - abs(uv.y - 0.48 - wave * 0.08), 3.2);
  float vignette = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x);

  vec3 mahogany = vec3(0.08, 0.03, 0.015);
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 ember = vec3(0.72, 0.38, 0.14);

  vec3 color = mix(mahogany, ember, ribbon * 0.45);
  color = mix(color, gold, rim * 0.88);
  color += gold * grain * 0.08;
  float alpha = (0.08 + rim * 0.62 + grain * 0.04) * vignette;
  gl_FragColor = vec4(color, alpha);
}
`

/** Faixa dourada com shader (ouro + mogno). Só atmosfera — não bloqueia clique. */
export function SidebarAmberRibbon({ className, active = true }: SidebarAmberRibbonProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      })
    } catch {
      return
    }

    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    const clock = new THREE.Clock()
    let frame = 0
    let running = true

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(w, h, false)
      material.uniforms.resolution.value.set(w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const draw = () => {
      if (!running) return
      frame = requestAnimationFrame(draw)
      const hidden = document.hidden
      if (!active || hidden) return
      const t = prefersReduced ? 0 : clock.getElapsedTime()
      material.uniforms.time.value = t
      renderer.render(scene, camera)
      if (prefersReduced) running = false
    }

    renderer.render(scene, camera)
    if (!prefersReduced) draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    }
  }, [active])

  return (
    <div
      ref={hostRef}
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-0 h-2 overflow-hidden',
        className,
      )}
      aria-hidden
    />
  )
}
