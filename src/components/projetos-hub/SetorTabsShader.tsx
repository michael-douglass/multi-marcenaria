import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

/**
 * Faixa de "veio de madeira" atrás da aba ativa da régua.
 * `mix` 0 = carvalho do ateliê, 1 = sálvia da oficina; a cor e a posição
 * deslizam suavemente até o alvo (interpolação no próprio loop de render).
 * Se o WebGL não existir, nada é desenhado — a pílula CSS da régua já cobre.
 */
export function SetorTabsShader({ mix, activeIndex, count, className }: SetorTabsShaderProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const slots = Math.max(count, 1)
  const target = { mix, start: activeIndex / slots, width: 1 / slots }
  const targetRef = useRef(target)
  const wakeRef = useRef<() => void>(() => {})

  targetRef.current = target

  useEffect(() => {
    wakeRef.current()
  }, [mix, activeIndex, count])

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
    Object.assign(renderer.domElement.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    })
    host.appendChild(renderer.domElement)

    const initial = targetRef.current
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uMix: { value: initial.mix },
        uActive: { value: new THREE.Vector2(initial.start, initial.width) },
        uAspect: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    const clock = new THREE.Clock()
    let frame = 0
    let running = true
    let visible = true
    let last = performance.now()

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(w, h, false)
      material.uniforms.uAspect.value = w / h
      if (prefersReduced) renderer.render(scene, camera)
    }

    /** Aproxima uniforms do alvo; devolve true enquanto ainda está em movimento. */
    const step = (dt: number) => {
      const target = targetRef.current
      const active = material.uniforms.uActive.value as THREE.Vector2
      if (prefersReduced) {
        material.uniforms.uMix.value = target.mix
        active.set(target.start, target.width)
        return false
      }
      // ~450 ms até assentar (amortecimento exponencial independente do FPS).
      const k = 1 - Math.exp(-dt * 9)
      material.uniforms.uMix.value += (target.mix - material.uniforms.uMix.value) * k
      active.x += (target.start - active.x) * k
      active.y += (target.width - active.y) * k
      return Math.abs(target.mix - material.uniforms.uMix.value) > 0.001 || Math.abs(target.start - active.x) > 0.001
    }

    const draw = (now: number) => {
      if (!running) return
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!prefersReduced) frame = requestAnimationFrame(draw)
      if (!visible || document.hidden) return
      step(dt)
      material.uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime()
      renderer.render(scene, camera)
    }

    wakeRef.current = () => {
      if (!prefersReduced) return
      step(0)
      renderer.render(scene, camera)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting !== false
    })
    io.observe(host)

    if (prefersReduced) {
      step(0)
      renderer.render(scene, camera)
    } else {
      frame = requestAnimationFrame(draw)
    }

    return () => {
      running = false
      wakeRef.current = () => {}
      cancelAnimationFrame(frame)
      ro.disconnect()
      io.disconnect()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={hostRef} className={cn('pointer-events-none absolute inset-0', className)} aria-hidden />
}

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Veio: anéis alongados no eixo X, torcidos por fbm (ruído em camadas).
 * A máscara recorta a "pílula" da aba ativa; um brilho estreito percorre a pílula.
 */
const FRAGMENT = `
uniform float uTime;
uniform float uMix;
uniform vec2 uActive;
uniform float uAspect;
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float t = uTime * 0.05;

  float warp = fbm(p * vec2(0.9, 2.6) + vec2(t, 0.0));
  float rings = sin((p.y * 7.0 + warp * 5.0) * 3.14159);
  float grain = smoothstep(0.1, 1.0, rings * 0.5 + 0.5);
  float fibers = noise(vec2(p.x * 1.5, p.y * 60.0)) * 0.12;

  vec3 oak = vec3(0.553, 0.369, 0.133);
  vec3 teal = vec3(0.176, 0.549, 0.471);
  vec3 base = mix(oak, teal, uMix);
  vec3 wood = mix(base * 1.22, base * 0.78, grain * 0.6 + warp * 0.3) - fibers * 0.25;

  float x0 = uActive.x;
  float x1 = uActive.x + uActive.y;
  float edge = 0.018;
  float mask = smoothstep(x0, x0 + edge, uv.x) * (1.0 - smoothstep(x1 - edge, x1, uv.x));

  float sweepX = x0 + fract(t * 1.6) * uActive.y;
  float sweep = exp(-pow((uv.x - sweepX) * uAspect * 3.2, 2.0));
  float topLight = smoothstep(0.35, 1.0, uv.y) * 0.12;

  vec3 color = wood + (sweep * 0.16 + topLight) * mask;
  float alpha = mask * 0.94 + (1.0 - mask) * grain * 0.04;
  gl_FragColor = vec4(color, alpha);
}
`

interface SetorTabsShaderProps {
  /** 0 = ateliê (carvalho), 1 = oficina (sálvia). */
  mix: number
  activeIndex: number
  count: number
  className?: string
}
