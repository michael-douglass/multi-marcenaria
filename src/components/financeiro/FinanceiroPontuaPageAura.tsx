import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

const WOOD_SRC = '/imagens/apresentacao-garbo/projetos/cubo-painel-madeira.png'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT = `
uniform float uTime;
uniform sampler2D uBrand;
uniform sampler2D uWood;
uniform sampler2D uLinen;
uniform float uHasBrand;
uniform float uHasWood;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.028;
  vec3 linen = texture2D(uLinen, uv * vec2(3.1, 3.9)).rgb;
  vec2 woodUv = uv * vec2(1.15, 1.45) + vec2(0.008 * sin(t), -0.006 * t);
  vec3 wood = texture2D(uWood, woodUv).rgb * uHasWood;
  vec2 brandUv = uv * vec2(1.25, 1.6) + vec2(0.012 * sin(t * 0.8), -0.007 * t);
  vec3 brand = texture2D(uBrand, brandUv).rgb * uHasBrand;

  vec3 paper = vec3(0.996, 0.980, 0.957);
  vec3 oak = vec3(0.88, 0.78, 0.62);
  vec3 gold = vec3(0.42, 0.25, 0.07);
  float wash = exp(-length((uv - vec2(0.78, 0.08)) * vec2(1.15, 1.65)) * 1.55);
  float grain = hash(uv * 150.0 + t) * 0.035;

  vec3 color = mix(paper, oak, wash * 0.16);
  color = mix(color, linen, 0.12);
  color = mix(color, wood, 0.05 * uHasWood);
  color = mix(color, gold, wash * 0.035);
  color = mix(color, brand, 0.028 * uHasBrand);
  color += grain;

  float alpha = 0.055 + wash * 0.035;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.10));
}
`

function makeLinenTexture() {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const n = 220 + Math.floor(Math.random() * 22)
    data[i * 4] = n
    data[i * 4 + 1] = n - 14
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

/**
 * Véu de linho + madeira + marca no Financeiro Pontua.
 * TextureLoader + LoadingManager — opacidade baixa para o texto continuar nítido.
 */
export function FinanceiroPontuaPageAura({ className }: { className?: string }) {
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

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uBrand: { value: fallback },
        uWood: { value: fallback },
        uLinen: { value: linen },
        uHasBrand: { value: 0 },
        uHasWood: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const manager = new THREE.LoadingManager()
    const loader = new THREE.TextureLoader(manager)

    loader.load(
      GARBO_LOGO_SRC,
      (texture) => {
        configureMap(texture)
        material.uniforms.uBrand.value = texture
        material.uniforms.uHasBrand.value = 1
      },
      undefined,
      () => {
        /* Sem logo o véu de linho continua. */
      },
    )

    loader.load(
      WOOD_SRC,
      (texture) => {
        configureMap(texture)
        material.uniforms.uWood.value = texture
        material.uniforms.uHasWood.value = 1
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

    const clockStart = performance.now()
    let frame = 0
    let running = true
    let visible = true

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      const cap = isPhone ? 1.1 : 1.4
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
      material.uniforms.uTime.value = prefersReduced ? 0 : (performance.now() - clockStart) / 1000
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
      const brand = material.uniforms.uBrand.value as THREE.Texture
      const wood = material.uniforms.uWood.value as THREE.Texture
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
      className={cn('pointer-events-none absolute inset-0 opacity-60', className)}
      aria-hidden
    />
  )
}
