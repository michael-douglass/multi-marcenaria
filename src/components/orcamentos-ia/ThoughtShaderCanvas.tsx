import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'
import type { ShaderThoughtMode } from '@/lib/orcamentos-ia/pipeline-telemetry'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Blueprint atelier (#0066FF).
 * uMode: 0 = idle, 1 = extract (scan + beam), 2 = audit (nós/engrenagens).
 */
const FRAGMENT = `
uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform float uMode;
uniform vec3 uAccent;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float circleNode(vec2 uv, vec2 center, float r) {
  float d = length(uv - center);
  float ring = smoothstep(r, r - 0.008, d) * smoothstep(r - 0.022, r - 0.014, d);
  return ring;
}

void main() {
  vec2 uv = vUv;
  float aspect = max(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 uva = vec2(uv.x * aspect, uv.y);

  vec3 paper = vec3(0.973, 0.957, 0.933);
  vec3 warm = vec3(0.94, 0.90, 0.84);
  vec3 ink = vec3(0.14, 0.18, 0.26);

  float gridScale = mix(18.0, 28.0, step(1.5, uMode));
  float gridX = abs(fract(uv.x * gridScale) - 0.5);
  float gridY = abs(fract(uv.y * (gridScale * 0.66)) - 0.5);
  float blueprint = 1.0 - smoothstep(0.0, 0.04, min(gridX, gridY));

  float pulse = 0.5 + 0.5 * sin(uTime * (1.8 + uIntensity * 2.5));
  float grain = hash(uv * 90.0 + uTime * 0.4) * 0.05;

  vec3 base = mix(paper, warm, uv.y * 0.45);
  base = mix(base, ink, blueprint * 0.06);
  base += uAccent * blueprint * (0.04 + uIntensity * 0.06);

  // Idle / extract: varredura vertical
  float scanY = fract(uTime * (0.12 + uIntensity * 0.22) + uProgress * 0.35);
  float scan = 1.0 - smoothstep(0.0, 0.04, abs(uv.y - scanY));
  float beam = exp(-pow((uv.x - (0.15 + uProgress * 0.7)) * aspect * 4.0, 2.0));

  // Extract: feixe horizontal + scan mais forte
  float extractMix = 1.0 - abs(uMode - 1.0);
  extractMix = smoothstep(0.0, 0.5, extractMix);
  float hScan = 1.0 - smoothstep(0.0, 0.035, abs(uv.x - fract(uTime * 0.18 + uProgress * 0.5)));
  base += uAccent * scan * (0.10 + uIntensity * 0.16) * pulse * mix(1.0, 1.35, extractMix);
  base += uAccent * beam * 0.12 * uIntensity * mix(0.7, 1.4, extractMix);
  base += uAccent * hScan * 0.14 * uIntensity * extractMix;

  // Audit: nós em grade (engrenagens) iluminados até uProgress
  float auditMix = smoothstep(0.0, 0.5, 1.0 - abs(uMode - 2.0));
  float nodes = 0.0;
  const float COLS = 5.0;
  const float ROWS = 4.0;
  float totalNodes = COLS * ROWS;
  float lit = floor(uProgress * totalNodes + 0.001);
  for (float row = 0.0; row < 4.0; row += 1.0) {
    for (float col = 0.0; col < 5.0; col += 1.0) {
      float idx = row * COLS + col;
      vec2 c = vec2((col + 0.5) / COLS, (row + 0.5) / ROWS);
      c.x = (c.x - 0.5) / aspect + 0.5;
      float on = step(idx, lit - 0.5);
      float glow = circleNode(uv, c, 0.045 + 0.01 * pulse);
      float hub = 1.0 - smoothstep(0.0, 0.02, length(uv - c));
      nodes += (glow * 0.85 + hub * 0.35) * mix(0.25, 1.0, on);
    }
  }
  // elos entre nós (linhas horizontais suaves)
  float linkY = abs(fract(uv.y * ROWS) - 0.5);
  float links = (1.0 - smoothstep(0.0, 0.03, linkY)) * 0.15 * uProgress;
  base += uAccent * nodes * (0.18 + uIntensity * 0.22) * auditMix;
  base += uAccent * links * auditMix * pulse;

  base += grain * uAccent * 0.35;

  float rim = pow(1.0 - min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)) * 2.4, 2.2);
  base += uAccent * rim * 0.07;

  gl_FragColor = vec4(base, 1.0);
}
`

function modeToUniform(mode: ShaderThoughtMode): number {
  if (mode === 'extract') return 1
  if (mode === 'audit') return 2
  return 0
}

interface ThoughtShaderCanvasProps {
  className?: string
  /** 0–1 progresso geral ou da etapa. */
  progress?: number
  /** 0–1 intensidade do “pensar”. */
  intensity?: number
  active?: boolean
  /** idle | extract | audit — visual distinto por fase. */
  mode?: ShaderThoughtMode
}

export function ThoughtShaderCanvas({
  className,
  progress = 0.35,
  intensity = 0.5,
  active = true,
  mode = 'idle',
}: ThoughtShaderCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)
  const intensityRef = useRef(intensity)
  const activeRef = useRef(active)
  const modeRef = useRef(modeToUniform(mode))

  progressRef.current = progress
  intensityRef.current = intensity
  activeRef.current = active
  modeRef.current = modeToUniform(mode)

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
      uMode: { value: modeRef.current },
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
      uniforms.uMode.value = THREE.MathUtils.lerp(uniforms.uMode.value, modeRef.current, 0.12)
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
