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

/** Folha de ponto: linho claro, linhas de grade semanal e carimbo dourado suave. */
const FRAGMENT = `
uniform float uTime;
uniform sampler2D uLinen;
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

  vec3 linen = texture2D(uLinen, uv * vec2(3.0, 3.8)).rgb;
  vec3 paper = vec3(0.996, 0.984, 0.965);
  vec3 oak = vec3(0.90, 0.80, 0.64);
  vec3 gold = vec3(0.48, 0.30, 0.10);

  vec2 lampDelta = (uv - uPointer) * vec2(aspect, 1.0);
  float lamp = smoothstep(0.6, 0.0, length(lampDelta));
  float wash = exp(-length((uv - vec2(0.18, 0.06)) * vec2(1.2, 1.6)) * 1.35);

  float cols = abs(sin(uv.x * 8.0 * 3.14159));
  float rows = abs(sin(uv.y * 14.0 * 3.14159));
  float grid = (smoothstep(0.97, 1.0, cols) + smoothstep(0.975, 1.0, rows)) * 0.14;
  float margin = smoothstep(0.03, 0.0, abs(uv.x - 0.07)) * 0.18;
  float grain = hash(uv * 160.0 + t) * 0.035;

  vec3 color = mix(paper, oak, wash * 0.14);
  color = mix(color, linen, 0.12);
  color = mix(color, gold, wash * 0.04 + lamp * 0.07 + grid * 0.45 + margin * 0.5);
  color += grain * gold * 0.25;

  float alpha = 0.07 + wash * 0.05 + lamp * 0.05 + grid * 0.04;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.16));
}
`

function makeLinenTexture() {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const n = 222 + Math.floor(Math.random() * 22)
    data[i * 4] = n
    data[i * 4 + 1] = n - 8
    data[i * 4 + 2] = n - 20
    data[i * 4 + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Aura clara do Resumo de Ponto — grade de folha + linho. */
export function ResumoPontoAura({ className }: { className?: string }) {
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

    const linen = makeLinenTexture()
    const uniforms = {
      uTime: { value: 0 },
      uLinen: { value: linen },
      uPointer: { value: new THREE.Vector2(0.2, 0.8) },
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
      linen.dispose()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={cn('resumo-ponto-aura pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  )
}
