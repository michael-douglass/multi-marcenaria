import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand'
import { GARBO_WOOD_TEXTURE_URL } from '@/lib/furniture-catalog-banks'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Arquivo de RH: trilho de pastas suspensas, abas manila, veios de mogno
 * e uma lâmpada de ouro que segue o ponteiro. Alpha baixo para a tinta
 * das pastas continuar nítida no papel creme.
 */
const FRAGMENT = `
uniform float uTime;
uniform sampler2D uBrand;
uniform sampler2D uWood;
uniform sampler2D uLinen;
uniform float uHasBrand;
uniform float uHasWood;
uniform vec2 uPointer;
uniform vec2 uResolution;
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
  float t = uTime * 0.018;
  float aspect = max(uResolution.x / max(uResolution.y, 1.0), 1.0);

  vec3 linen = texture2D(uLinen, uv * vec2(3.2, 4.0)).rgb;
  vec2 woodUv = uv * vec2(1.12, 1.42) + vec2(0.008 * sin(t), -0.004 * t);
  vec3 wood = texture2D(uWood, woodUv).rgb * uHasWood;
  vec2 brandUv = uv * vec2(1.22, 1.52) + vec2(0.06, 0.05);
  vec3 brand = texture2D(uBrand, brandUv).rgb * uHasBrand;

  vec3 paper = vec3(0.996, 0.980, 0.957);
  vec3 manila = vec3(0.86, 0.72, 0.48);
  vec3 gold = vec3(0.42, 0.25, 0.07);
  vec3 mahogany = vec3(0.18, 0.10, 0.06);

  vec2 lampDelta = (uv - uPointer) * vec2(aspect, 1.0);
  float lamp = smoothstep(0.58, 0.0, length(lampDelta));
  float wash = exp(-length((uv - vec2(0.18, 0.06)) * vec2(1.15, 1.55)) * 1.4);
  float corner = exp(-length((uv - vec2(0.92, 0.94)) * vec2(1.25, 1.35)) * 1.65);
  float grain = hash(uv * 170.0 + t) * 0.035;

  float rail = smoothstep(0.965, 0.985, uv.y) * 0.28;
  float hang = abs(sin((uv.x * 7.0 + 0.12) * 3.14159));
  float tab = smoothstep(0.78, 1.0, hang) * step(0.88, uv.y) * (1.0 - step(0.965, uv.y));
  float ruling = smoothstep(0.94, 1.0, abs(sin((uv.y * 28.0) * 3.14159))) * 0.16;
  float goldVein = smoothstep(0.64, 0.92, noise(uv * vec2(6.5, 16.0) + vec2(t * 0.35, 0.0)));

  vec3 color = mix(paper, manila, wash * 0.16 + tab * 0.22 + rail * 0.18);
  color = mix(color, linen, 0.12);
  color = mix(color, wood, 0.06 * uHasWood);
  color = mix(color, mahogany, corner * 0.07 + rail * 0.08);
  color = mix(color, gold, wash * 0.04 + lamp * 0.08 + goldVein * 0.04 + ruling * 0.06 + tab * 0.08);
  color = mix(color, brand, 0.025 * uHasBrand);
  color += grain * gold * 0.28;

  float alpha = 0.06 + wash * 0.04 + lamp * 0.05 + corner * 0.03 + tab * 0.04 + rail * 0.03;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.14));
}
`

function makeLinenTexture() {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const n = 216 + Math.floor(Math.random() * 26)
    data[i * 4] = n
    data[i * 4 + 1] = n - 12
    data[i * 4 + 2] = n - 26
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

function configureMap(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 1
  texture.needsUpdate = true
}

export function FuncionariosPageAura({ className }: { className?: string }) {
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

    THREE.Cache.enabled = true
    const fallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
    fallback.needsUpdate = true
    const linen = makeLinenTexture()

    const uniforms = {
      uTime: { value: 0 },
      uBrand: { value: fallback },
      uWood: { value: fallback },
      uLinen: { value: linen },
      uHasBrand: { value: 0 },
      uHasWood: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.22, 0.82) },
      uResolution: { value: new THREE.Vector2(1, 1) },
    }

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const manager = new THREE.LoadingManager()
    const loader = new THREE.TextureLoader(manager)

    loader.load(
      GARBO_LOGO_SRC,
      (texture) => {
        configureMap(texture)
        uniforms.uBrand.value = texture
        uniforms.uHasBrand.value = 1
      },
      undefined,
      () => {
        /* Sem logo o véu de linho continua. */
      },
    )

    loader.load(
      GARBO_WOOD_TEXTURE_URL,
      (texture) => {
        configureMap(texture)
        uniforms.uWood.value = texture
        uniforms.uHasWood.value = 1
      },
      undefined,
      () => {
        /* Sem madeira o véu segue só com linho. */
      },
    )

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    const pointer = uniforms.uPointer.value as THREE.Vector2
    const onMove = (event: PointerEvent) => {
      if (prefersReduced) return
      const rect = host.getBoundingClientRect()
      const w = Math.max(rect.width, 1)
      const h = Math.max(rect.height, 1)
      pointer.set((event.clientX - rect.left) / w, 1 - (event.clientY - rect.top) / h)
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let frame = 0
    let running = true
    let visible = true
    const startedAt = performance.now()

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      const cap = isPhone ? 1.1 : 1.4
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
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

    if (prefersReduced) {
      renderer.render(scene, camera)
    } else {
      draw()
    }

    return () => {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      ro.disconnect()
      io.disconnect()
      const brand = uniforms.uBrand.value as THREE.Texture
      const wood = uniforms.uWood.value as THREE.Texture
      if (brand && brand !== fallback) brand.dispose()
      if (wood && wood !== fallback) wood.dispose()
      fallback.dispose()
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
      className={cn('pointer-events-none absolute inset-0 opacity-80', className)}
      aria-hidden
    />
  )
}
