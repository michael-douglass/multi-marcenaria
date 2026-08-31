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

const FRAGMENT = `
uniform float uTime;
uniform sampler2D uBrand;
uniform float uHasBrand;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.12;
  vec2 brandUv = uv * vec2(2.4, 1.8) + vec2(t * 0.04, 0.0);
  vec3 brand = texture2D(uBrand, brandUv).rgb * uHasBrand;
  float rim = pow(1.0 - abs(uv.y - 0.5), 3.0);
  vec3 gold = vec3(0.95, 0.84, 0.55);
  vec3 ink = vec3(0.08, 0.03, 0.015);
  vec3 color = mix(ink, gold, rim * 0.45);
  color = mix(color, brand, 0.16 * uHasBrand);
  float alpha = 0.18 + rim * 0.22;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.38));
}
`

/** Filete da marca no campo de busca. TextureLoader só — sem modelo 3D. */
export function SidebarSearchAura({ className }: { className?: string }) {
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
    host.appendChild(renderer.domElement)

    THREE.Cache.enabled = true
    const fallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
    fallback.needsUpdate = true

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uBrand: { value: fallback },
        uHasBrand: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const loader = new THREE.TextureLoader()
    loader.load(GARBO_LOGO_SRC, texture => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
      renderer.setSize(w, h, false)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const draw = () => {
      if (!running) return
      frame = requestAnimationFrame(draw)
      if (document.hidden) return
      material.uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime()
      renderer.render(scene, camera)
      if (prefersReduced) running = false
    }

    renderer.render(scene, camera)
    if (!prefersReduced) draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      const brand = material.uniforms.uBrand.value as THREE.Texture
      if (brand && brand !== fallback) brand.dispose()
      fallback.dispose()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
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
