import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

export interface ReciboFoilBandHandle {
  snapshot: () => string | null
}

/**
 * Faixa dourada do recibo: veios de madeira, brilho nas bordas (como luz
 * batendo na borda de um metal) e um leve movimento. Se o aparelho não
 * aguentar, some e o papel continua com o degradê de reserva.
 */
export const ReciboFoilBand = forwardRef<ReciboFoilBandHandle, { className?: string }>(
  function ReciboFoilBand({ className }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

    useImperativeHandle(ref, () => ({
      snapshot: () => {
        const renderer = rendererRef.current
        if (!renderer) return null
        try {
          return renderer.domElement.toDataURL('image/png')
        } catch {
          return null
        }
      },
    }))

    useEffect(() => {
      const host = hostRef.current
      if (!host) return

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const renderer = tryCreateWebGLRenderer(
        () =>
          new THREE.WebGLRenderer({
            alpha: true,
            antialias: false,
            preserveDrawingBuffer: true,
            powerPreference: 'low-power',
            failIfMajorPerformanceCaveat: true,
          }),
      )
      if (!renderer) return

      rendererRef.current = renderer
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
            float t = uTime * 0.16;
            vec3 cream = vec3(0.965, 0.925, 0.855);
            vec3 gold = vec3(0.820, 0.655, 0.310);
            vec3 mahogany = vec3(0.165, 0.078, 0.043);
            vec3 brass = vec3(0.745, 0.545, 0.220);

            float grain = noise(vec2(uv.x * 11.0 + t * 0.12, uv.y * 38.0));
            float vein = smoothstep(0.38, 0.88, noise(vec2(uv.x * 2.6, uv.y * 22.0 - t * 0.07)));
            float wash = exp(-length((uv - vec2(0.18, 0.42)) * vec2(1.15, 1.8)) * 1.7);
            float rim = pow(max(1.0 - abs(uv.y * 2.0 - 1.0), 0.0), 2.8);
            float spark = hash(uv * 190.0 + t) * 0.05;

            vec3 color = mix(mahogany, brass, 0.42 + grain * 0.22);
            color = mix(color, gold, wash * 0.62 + vein * 0.18);
            color = mix(color, cream, rim * 0.22);
            color += gold * spark;

            float alpha = 0.52 + wash * 0.28 + rim * 0.18;
            gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.88));
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
        rendererRef.current = null
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
  },
)
