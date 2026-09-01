import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

/**
 * Véu dourado atrás da ficha do destinatário: madeira líquida + borda de luz (fresnel).
 * Um canvas só, baixo consumo — se o aparelho não aguentar WebGL, some sem barulho.
 */
export function CaixaDestinatarioFoil({ className }: { className?: string }) {
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

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    }

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
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

        void main() {
          vec2 uv = vUv;
          float t = uTime * 0.22;
          vec3 mahogany = vec3(0.118, 0.055, 0.031);
          vec3 gold = vec3(0.949, 0.847, 0.573);
          vec3 cream = vec3(0.929, 0.851, 0.769);

          float n = noise(uv * 7.0 + vec2(t * 0.35, -t * 0.18));
          float n2 = noise(uv * 18.0 - vec2(t * 0.12, t * 0.2));
          float wash = exp(-length((uv - vec2(0.78, 0.12)) * vec2(1.35, 1.7)) * 2.1);
          float rim = pow(1.0 - abs(uv.y - 0.08) * 4.2, 3.0);
          rim = max(rim, 0.0);
          float grain = hash(uv * 220.0 + t) * 0.045;

          vec3 color = mix(mahogany, gold * 0.55, wash * 0.55 + n * 0.12);
          color = mix(color, cream, rim * 0.18 + n2 * 0.04);
          color += gold * wash * 0.22;
          color += grain;

          float alpha = 0.42 + wash * 0.28 + rim * 0.12;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
        }
      `,
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(w, h, false)
      uniforms.uResolution.value.set(w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const draw = () => {
      if (!running) return
      if (!prefersReduced) frame = requestAnimationFrame(draw)
      uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime()
      renderer.render(scene, camera)
    }
    draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
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
