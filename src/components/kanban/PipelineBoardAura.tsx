import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { isTouchOrCompactViewport } from '@/lib/viewport-ui'
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
uniform vec2 uResolution;
uniform sampler2D uBrand;
uniform float uHasBrand;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.08;
  vec2 brandUv = uv * vec2(1.15, 1.35) + vec2(0.04 * sin(t), -0.03 * t);
  vec3 brand = texture2D(uBrand, brandUv).rgb * uHasBrand;
  float grain = hash(uv * 90.0 + t) * 0.1;
  float wash = exp(-length((uv - vec2(0.5, 0.4)) * vec2(1.15, 1.7)) * 1.8);
  float rim = pow(1.0 - abs(uv.y - 0.08), 4.0) * 0.22;
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 ink = vec3(0.07, 0.03, 0.015);
  vec3 color = mix(ink, gold, wash * 0.22);
  color = mix(color, brand, 0.12 * uHasBrand);
  color += gold * (grain * 0.7 + rim * 0.7);
  float vignette = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.86, uv.x)
    * smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.82, uv.y);
  float alpha = (0.12 + wash * 0.1 + grain * 0.05) * vignette;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.26));
}
`

/** Fundo do quadro: textura da marca + ouro. Um canvas só — celular aguenta. */
export function PipelineBoardAura({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Tablet/toque (Tab S9 Ultra incluso): WebGL no fundo do pipeline compete com o card do lead.
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
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBrand: { value: fallback },
        uHasBrand: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const manager = new THREE.LoadingManager()
    const loader = new THREE.TextureLoader(manager)
    loader.load(
      '/imagens/identidade-visual-garbo.png',
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

    const timer = new THREE.Timer()
    let frame = 0
    let running = true
    let visible = true

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(w, h, false)
      material.uniforms.uResolution.value.set(w, h)
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
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 opacity-90', className)}
      aria-hidden
    />
  )
}
