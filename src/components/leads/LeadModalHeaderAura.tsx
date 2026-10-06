import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'
import { isTouchOrCompactViewport } from '@/lib/viewport-ui'

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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.04;
  vec2 brandUv = uv * vec2(1.35, 2.05) + vec2(0.015 * sin(t), 0.0);
  vec3 brand = texture2D(uBrand, brandUv).rgb * uHasBrand;
  float grain = hash(uv * 90.0 + t) * 0.05;
  float wash = exp(-length((uv - vec2(0.18, 0.22)) * vec2(1.15, 1.45)) * 1.2);
  float rim = pow(1.0 - uv.y, 2.2) * 0.18;
  float fresnel = pow(1.0 - abs(uv.x - 0.5) * 1.35, 2.2) * 0.10;

  vec3 gold = vec3(0.55, 0.40, 0.22);
  vec3 paper = vec3(0.998, 0.980, 0.955);
  vec3 linen = vec3(0.965, 0.930, 0.880);
  vec3 color = mix(paper, linen, wash * 0.48 + fresnel * 0.22);
  color = mix(color, brand, 0.035 * uHasBrand);
  color += gold * (grain * 0.08 + rim * 0.07);

  float alpha = 0.035 + wash * 0.035 + rim * 0.028;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.09));
}
`

/** Véu dourado no card inteiro — textura da marca, sem atrapalhar o texto. */
export function LeadModalHeaderAura({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // WebGL no toque (Tab S9 Ultra incluso) costuma “piscar” ao montar o canvas.
    if (prefersReduced || isTouchOrCompactViewport()) return

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

    const manager = new THREE.LoadingManager()
    const loader = new THREE.TextureLoader(manager)
    loader.load(GARBO_LOGO_SRC, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.anisotropy = 1
      texture.needsUpdate = true
      material.uniforms.uBrand.value = texture
      material.uniforms.uHasBrand.value = 1
    })

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    const timer = new THREE.Timer()
    let frame = 0
    let running = true
    let visible = true

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
      timer.update()
      material.uniforms.uTime.value = prefersReduced ? 0 : timer.getElapsed()
      renderer.render(scene, camera)
    }
    draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      io.disconnect()
      const brand = material.uniforms.uBrand.value as THREE.Texture
      if (brand && brand !== fallback) brand.dispose()
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
