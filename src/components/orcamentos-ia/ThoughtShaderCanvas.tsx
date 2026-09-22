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

/**
 * Blueprint atelier: grade técnica + varredura de leitura + pulso de atenção (#0066FF).
 * Reage a uProgress (0–1) e uIntensity (0–1).
 */
const FRAGMENT = `
uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform vec3 uAccent;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  float aspect = max(uResolution.x / max(uResolution.y, 1.0), 1.0);

  vec3 paper = vec3(0.973, 0.957, 0.933);
  vec3 warm = vec3(0.94, 0.90, 0.84);
  vec3 ink = vec3(0.14, 0.18, 0.26);

  float gridX = abs(fract(uv.x * 18.0) - 0.5);
  float gridY = abs(fract(uv.y * 12.0) - 0.5);
  float blueprint = 1.0 - smoothstep(0.0, 0.04, min(gridX, gridY));

  float scanY = fract(uTime * (0.12 + uIntensity * 0.22) + uProgress * 0.35);
  float scan = smoothstep(0.0, 0.04, abs(uv.y - scanY));
  scan = 1.0 - scan;

  float beam = exp(-pow((uv.x - (0.15 + uProgress * 0.7)) * aspect * 4.0, 2.0));
  float pulse = 0.5 + 0.5 * sin(uTime * (1.8 + uIntensity * 2.5));
  float grain = hash(uv * 90.0 + uTime * 0.4) * 0.05;

  vec3 base = mix(paper, warm, uv.y * 0.45);
  base = mix(base, ink, blueprint * 0.06);
  base += uAccent * blueprint * (0.04 + uIntensity * 0.06);
  base += uAccent * scan * (0.12 + uIntensity * 0.18) * pulse;
  base += uAccent * beam * 0.1 * uIntensity;
  base += grain * uAccent * 0.35;

  float rim = pow(1.0 - min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)) * 2.4, 2.2);
  base += uAccent * rim * 0.07;

  gl_FragColor = vec4(base, 1.0);
}
`

interface ThoughtShaderCanvasProps {
  className?: string
  /** 0–1 progresso geral ou da etapa. */
  progress?: number
  /** 0–1 intensidade do “pensar”. */
  intensity?: number
  active?: boolean
}

export function ThoughtShaderCanvas({
  className,
  progress = 0.35,
  intensity = 0.5,
  active = true,
}: ThoughtShaderCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)
  const intensityRef = useRef(intensity)
  const activeRef = useRef(active)

  progressRef.current = progress
  intensityRef.current = intensity
  activeRef.current = active

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isPhone = window.matchMedia('(max-width: 767px)').matches

    if (prefersReduced) {
      host.style.background =
        'linear-gradient(135deg, #f7f4ef 0%, #ebe4d8 50%, rgba(0,102,255,0.12) 100%)'
      return
    }

    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          alpha: false,
          antialias: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: true,
        }),
    )
    if (!renderer) {
      host.style.background =
        'linear-gradient(135deg, #f7f4ef 0%, #ebe4d8 50%, rgba(0,102,255,0.12) 100%)'
      return
    }

    renderer.setClearColor(0xf7f4ef, 1)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.pointerEvents = 'none'
    host.appendChild(renderer.domElement)

    const uniforms = {
      uTime: { value: 0 },
      uProgress: { value: progressRef.current },
      uIntensity: { value: intensityRef.current },
      uAccent: { value: new THREE.Color('#0066FF') },
      uResolution: { value: new THREE.Vector2(1, 1) },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
    })

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    let frame = 0
    let running = true
    let visible = true
    const startedAt = performance.now()

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? 1.1 : 1.4))
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
      frame = requestAnimationFrame(draw)
      if (!visible) return
      const t = (performance.now() - startedAt) / 1000
      uniforms.uTime.value = activeRef.current ? t : t * 0.15
      uniforms.uProgress.value = THREE.MathUtils.lerp(
        uniforms.uProgress.value,
        progressRef.current,
        0.08,
      )
      uniforms.uIntensity.value = THREE.MathUtils.lerp(
        uniforms.uIntensity.value,
        intensityRef.current * (activeRef.current ? 1 : 0.25),
        0.08,
      )
      renderer.render(scene, camera)
    }
    draw()

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      io.disconnect()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={cn('relative overflow-hidden rounded-xl', className)}
      aria-hidden
    />
  )
}
