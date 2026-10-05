import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export interface AtelieShaderPlaneOptions {
  fragment: string
  uniforms: () => Record<string, THREE.IUniform>
  pixelRatioMax?: number
  pauseWhenHidden?: boolean
  /** No celular, pula o canvas (Safari limita WebGL e a página some). */
  skipOnPhone?: boolean
  className?: string
}

/** Plano fullscreen low-power. Reduced-motion = um frame estático. */
export function useAtelieShaderPlane({
  fragment,
  uniforms,
  pixelRatioMax = 1.5,
  pauseWhenHidden = false,
  skipOnPhone = false,
}: Omit<AtelieShaderPlaneOptions, 'className'>) {
  const hostRef = useRef<HTMLDivElement>(null)
  const uniformsRef = useRef(uniforms)
  uniformsRef.current = uniforms

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isPhone = window.matchMedia('(max-width: 767px)').matches
    if (skipOnPhone && isPhone) return

    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
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

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        ...uniformsRef.current(),
      },
      vertexShader: VERTEX,
      fragmentShader: fragment,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    // THREE.Clock está deprecado (r185+); Timer exige update() a cada frame.
    const timer = new THREE.Timer()
    let frame = 0
    let running = true
    let visible = true

    const resize = () => {
      const w = Math.max(host.clientWidth, 1)
      const h = Math.max(host.clientHeight, 1)
      const cap = isPhone ? Math.min(pixelRatioMax, 1.15) : pixelRatioMax
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
      renderer.setSize(w, h, false)
      material.uniforms.uResolution.value.set(w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const io =
      pauseWhenHidden || isPhone
        ? new IntersectionObserver(
            ([entry]) => {
              visible = entry?.isIntersecting !== false
            },
            { threshold: 0.05 },
          )
        : null
    if (io) io.observe(host)

    const syncDynamicUniforms = () => {
      const next = uniformsRef.current()
      for (const [key, uniform] of Object.entries(next)) {
        if (material.uniforms[key]) material.uniforms[key].value = uniform.value
      }
    }

    const renderOnce = (time: number) => {
      syncDynamicUniforms()
      material.uniforms.uTime.value = time
      renderer.render(scene, camera)
    }

    const draw = () => {
      if (!running) return
      if (!prefersReduced) frame = requestAnimationFrame(draw)
      if ((pauseWhenHidden || isPhone) && !visible) return
      timer.update()
      renderOnce(timer.getElapsed())
    }

    if (prefersReduced) {
      renderOnce(0)
    } else {
      draw()
    }

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      io?.disconnect()
      material.dispose()
      mesh.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [fragment, pixelRatioMax, pauseWhenHidden, skipOnPhone])

  return hostRef
}
