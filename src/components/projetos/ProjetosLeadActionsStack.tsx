import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ArrowDownToLine, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

interface ProjetosLeadActionsStackProps {
  onAdicionar: () => void
  onPuxar: () => void
  className?: string
}

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/** Véu dourado discreto atrás dos botões — linho + brilho de ouro. */
const FRAGMENT = `
uniform float uTime;
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

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.35;

  vec3 paper = vec3(0.98, 0.95, 0.90);
  vec3 oak = vec3(0.88, 0.78, 0.58);
  vec3 gold = vec3(0.78, 0.58, 0.28);
  vec3 ink = vec3(0.16, 0.10, 0.07);

  float wash = exp(-length((uv - vec2(0.5, 0.45)) * vec2(1.35, 1.8)) * 1.55);
  float rim = pow(1.0 - abs(uv.x - 0.5) * 1.65, 2.4);
  float grain = hash(uv * 90.0 + t) * 0.05;
  float soft = noise(uv * 6.0 + t * 0.15) * 0.06;

  vec3 color = mix(paper, oak, 0.35 + wash * 0.25);
  color = mix(color, gold, wash * 0.22 + rim * 0.08);
  color = mix(color, ink, soft * 0.12);
  color += grain;

  float alpha = 0.42 + wash * 0.28 + rim * 0.08;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
}
`

function ActionsAura({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // No celular o CSS do cartão basta — economiza um contexto WebGL.
    if (window.matchMedia('(max-width: 767px)').matches) return

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

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: { uTime: { value: 0 } },
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

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
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
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-2xl', className)}
      aria-hidden
    />
  )
}

export function ProjetosLeadActionsStack({
  onAdicionar,
  onPuxar,
  className,
}: ProjetosLeadActionsStackProps) {
  return (
    <div
      className={cn(
        'relative isolate min-w-0 w-full overflow-hidden rounded-2xl border border-[#c9a35a]/35',
        'bg-[#fff8ee]/80 shadow-[0_14px_28px_rgba(42,24,18,0.08)] backdrop-blur-md',
        'md:w-[min(100%,11.5rem)]',
        className,
      )}
    >
      <ActionsAura />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(0deg,transparent,transparent_10px,#2a1812_11px)]"
        aria-hidden
      />

      <div className="relative z-10 flex flex-row gap-2 p-2.5 md:flex-col">
        <p className="hidden px-1 font-display text-[10px] tracking-[0.28em] text-[#8d5e22] md:block">
          LEAD
        </p>

        <Button
          type="button"
          size="sm"
          className="h-auto min-w-0 flex-1 flex-col items-stretch justify-start gap-0.5 whitespace-normal rounded-xl bg-gold px-3 py-2 text-left text-[#1a120e] shadow-sm hover:bg-gold/90"
          onClick={onAdicionar}
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            Adicionar lead
          </span>
          <span className="pl-5 text-[10px] font-normal leading-tight text-[#1a120e]/75">
            Cria um cadastro novo na fila
          </span>
        </Button>

        <Button
          type="button"
          size="sm"
          className="h-auto min-w-0 flex-1 flex-col items-stretch justify-start gap-0.5 whitespace-normal rounded-xl bg-[#2a7d6a] px-3 py-2 text-left text-white shadow-sm hover:bg-[#236b5b]"
          onClick={onPuxar}
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden />
            Puxar lead
          </span>
          <span className="pl-5 text-[10px] font-normal leading-tight text-white/80">
            Busca um lead que já existe
          </span>
        </Button>
      </div>
    </div>
  )
}
