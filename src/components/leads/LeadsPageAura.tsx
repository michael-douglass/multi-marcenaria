import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand'

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
uniform sampler2D uLinen;
uniform float uHasBrand;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.04;
  vec2 linenUv = uv * vec2(3.4, 4.2);
  vec3 linen = texture2D(uLinen, linenUv).rgb;
  vec2 brandUv = uv * vec2(1.35, 1.7) + vec2(0.015 * sin(t), -0.01 * t);
  vec3 brand = texture2D(uBrand, brandUv).rgb * uHasBrand;

  vec3 paper = vec3(0.985, 0.972, 0.948);
  vec3 oak = vec3(0.93, 0.88, 0.80);
  vec3 gold = vec3(0.72, 0.56, 0.32);
  float wash = exp(-length((uv - vec2(0.52, 0.08)) * vec2(1.05, 1.55)) * 1.55);
  float grain = hash(uv * 160.0 + t) * 0.045;

  vec3 color = mix(paper, oak, wash * 0.28);
  color = mix(color, linen, 0.18);
  color = mix(color, gold, wash * 0.05);
  color = mix(color, brand, 0.045 * uHasBrand);
  color += grain;

  float alpha = 0.22 + wash * 0.10;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.32));
}
`

function makeLinenTexture() {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const n = 214 + Math.floor(Math.random() * 28)
    data[i * 4] = n
    data[i * 4 + 1] = n - 10
    data[i * 4 + 2] = n - 22
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

/**
 * Véu claro da lista de leads: linho + marca.
 * TextureLoader + LoadingManager — um canvas só, celular aguenta.
 */
export function LeadsPageAura({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isPhone = window.matchMedia('(max-width: 767px)').matches
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
    loader.load(
      GARBO_LOGO_SRC,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.anisotropy = 1
        texture.needsUpdate = true
        material.uniforms.uBrand.value = texture
        material.uniforms.uHasBrand.value = 1
      },
    )

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
      const brand = material.uniforms.uBrand.value as THREE.Texture
      if (brand && brand !== fallback) brand.dispose()
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
