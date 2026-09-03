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
 * Papel encerado: um veio de madeira parado, uma luz que atravessa devagar
 * e um filete de ouro no rodapé que acende quando o campo recebe foco.
 */
const FRAGMENT = `
uniform float uTime;
uniform float uFocus;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(21.98, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.35;

  float luzX = uv.x - fract(t * 0.22);
  float sweep = exp(-luzX * luzX * 26.0);

  float veio = sin(uv.y * 26.0 + sin(uv.x * 3.0 + t * 0.6) * 1.4);
  veio = smoothstep(0.86, 1.0, veio) * 0.35;

  float filete = smoothstep(0.16, 0.0, uv.y) * (0.22 + uFocus * 0.9);
  float grao = hash(uv * vec2(180.0, 90.0)) * 0.05;

  vec3 ouro = vec3(0.62, 0.42, 0.15);
  vec3 tinta = vec3(0.36, 0.24, 0.16);
  float luz = sweep * (0.25 + uFocus * 0.55) + veio * 0.5 + filete;
  vec3 cor = mix(tinta, ouro, clamp(luz + grao, 0.0, 1.0));

  float alpha = (sweep * 0.12 + veio * 0.10 + filete * 0.5 + grao * 0.35)
    * (0.42 + uFocus * 0.75);
  gl_FragColor = vec4(cor, clamp(alpha, 0.0, 0.5));
}
`

interface Props {
  className?: string
  focused?: boolean
}

export function FuncionarioUsuarioAura({ className, focused = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef(focused)
  focusRef.current = focused

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

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uFocus: { value: focusRef.current ? 1 : 0.22 },
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

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
      renderer.setSize(w, h, false)
      // Sem animação o quadro é único: precisa ser redesenhado a cada resize.
      if (prefersReduced) renderer.render(scene, camera)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    if (!prefersReduced) {
      const draw = () => {
        if (!running) return
        frame = requestAnimationFrame(draw)
        material.uniforms.uTime.value = clock.getElapsedTime()
        const alvo = focusRef.current ? 1 : 0.22
        material.uniforms.uFocus.value += (alvo - material.uniforms.uFocus.value) * 0.12
        renderer.render(scene, camera)
      }
      draw()
    }

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
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', className)}
      aria-hidden
    />
  )
}
