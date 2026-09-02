import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/** Véu claro: linho + lavagem teal suave + grano de oficina. */
const FRAGMENT = `
uniform float uTime;
uniform sampler2D uBrand;
uniform sampler2D uLinen;
uniform float uHasBrand;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.025;

  vec3 linen = texture2D(uLinen, uv * vec2(2.4, 3.2) + vec2(t * 0.02, 0.0)).rgb;
  vec3 brand = texture2D(uBrand, uv * vec2(1.15, 1.4) + vec2(0.008 * sin(t), 0.0)).rgb * uHasBrand;

  // Papel de oficina: branco quente + sage
  vec3 paper = vec3(0.97, 0.95, 0.91);
  vec3 chalk = vec3(0.93, 0.96, 0.95);
  vec3 sage = vec3(0.55, 0.72, 0.66);
  vec3 oak = vec3(0.78, 0.68, 0.52);

  float radial = exp(-length((uv - vec2(0.42, 0.08)) * vec2(1.05, 1.55)) * 1.15);
  float floorWash = smoothstep(1.05, 0.35, uv.y);
  float grain = hash(uv * 160.0 + t) * 0.035;
  float softNoise = noise(uv * 8.0 + t * 0.4) * 0.04;

  vec3 color = mix(paper, chalk, 0.45);
  color = mix(color, linen, 0.18);
  color = mix(color, sage, radial * 0.12 + floorWash * 0.05);
  color = mix(color, oak, radial * 0.05);
  color = mix(color, brand, 0.025 * uHasBrand);
  color += grain + softNoise;

  float alpha = 0.22 + radial * 0.14 + floorWash * 0.06;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.38));
}
`

function makeLinenTexture() {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const n = 228 + Math.floor(Math.random() * 22)
    data[i * 4] = n
    data[i * 4 + 1] = n - 4
    data[i * 4 + 2] = n - 10
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

/** Véu claro de oficina — linho + teal suave por baixo do quadro. */
export function ProducaoBoardAura({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

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

    THREE.Cache.enabled = true
    const fallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
    fallback.needsUpdate = true
    const linen = makeLinenTexture()

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uBrand: { value: fallback },
        uLinen: { value: linen },
        uHasBrand: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const manager = new THREE.LoadingManager()
    const loader = new THREE.TextureLoader(manager)
    loader.load(GARBO_LOGO_SRC, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.needsUpdate = true
      material.uniforms.uBrand.value = texture
      material.uniforms.uHasBrand.value = 1
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35))
      renderer.setSize(w, h, false)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const draw = () => {
      if (!running) return
      if (!prefersReduced) frame = requestAnimationFrame(draw)
      material.uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime()
      renderer.render(scene, camera)
    }
    draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      linen.dispose()
      fallback.dispose()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    />
  )
}
