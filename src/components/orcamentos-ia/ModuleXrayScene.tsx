import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'
import {
  buildBoxMeshesFromBom,
  type BoxMeshDesc,
} from '@/lib/orcamentos-ia/bom-engine/xray-geometry'
import type { CutPiece } from '@/lib/orcamentos-ia/bom-engine/types'

const XRAY_VERT = `
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const XRAY_FRAG = `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uHighlight;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(0.0, dot(viewDir, normalize(vNormal))), 2.4);
  vec3 base = mix(uColor, uAccent, uHighlight * 0.85);
  vec3 col = mix(base, uAccent, fresnel * 0.55);
  float alpha = mix(uOpacity, min(0.95, uOpacity + 0.35), fresnel);
  alpha = mix(alpha, 0.92, uHighlight);
  gl_FragColor = vec4(col, alpha);
}
`

interface ModuleXraySceneProps {
  pieces: CutPiece[]
  moduleWidthMm: number
  moduleHeightMm: number
  moduleDepthMm: number
  boxThicknessMm?: number
  selectedPieceId?: string | null
  className?: string
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Cena 3D raio-X (Three.js + ShaderMaterial fresnel). */
export function ModuleXrayScene({
  pieces,
  moduleWidthMm,
  moduleHeightMm,
  moduleDepthMm,
  boxThicknessMm = 15,
  selectedPieceId = null,
  className,
}: ModuleXraySceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || pieces.length === 0) return

    if (prefersReducedMotion()) {
      host.innerHTML =
        '<div class="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">Raio-X 3D pausado (movimento reduzido). Use a lista de peças.</div>'
      return () => {
        host.innerHTML = ''
      }
    }

    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'low-power',
        }),
    )
    if (!renderer) {
      host.innerHTML =
        '<div class="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">WebGL indisponível neste dispositivo.</div>'
      return () => {
        host.innerHTML = ''
      }
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x0f1419, 1)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 50)
    camera.position.set(1.4, 1.1, 1.8)

    const meshes = buildBoxMeshesFromBom(pieces, {
      moduleWidthMm,
      moduleHeightMm,
      moduleDepthMm,
      boxThicknessMm,
      selectedPieceId,
    })

    const group = new THREE.Group()
    const accent = new THREE.Color(0x0066ff)
    const wood = new THREE.Color(0xc4a574)

    for (const desc of meshes) {
      const geo = new THREE.BoxGeometry(desc.size[0], desc.size[1], desc.size[2])
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: wood.clone() },
          uAccent: { value: accent.clone() },
          uHighlight: { value: desc.highlighted ? 1 : 0 },
          uOpacity: { value: 0.28 },
        },
        vertexShader: XRAY_VERT,
        fragmentShader: XRAY_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(desc.position[0], desc.position[1], desc.position[2])
      mesh.name = desc.gapTag ? `${desc.name} · ${desc.gapTag}` : desc.name
      mesh.userData.desc = desc as BoxMeshDesc
      mesh.userData.gapTag = desc.gapTag
      group.add(mesh)
    }

    // Centraliza o grupo
    const box = new THREE.Box3().setFromObject(group)
    const center = box.getCenter(new THREE.Vector3())
    group.position.sub(center)
    scene.add(group)

    const amb = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(amb)

    let raf = 0
    let yaw = 0.6
    let pitch = 0.35
    let dist = 2.2
    let dragging = false
    let lastX = 0
    let lastY = 0

    const resize = () => {
      const w = host.clientWidth || 320
      const h = host.clientHeight || 240
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      host.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      yaw += (e.clientX - lastX) * 0.008
      pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * 0.008))
      lastX = e.clientX
      lastY = e.clientY
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      try {
        host.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      dist = Math.max(0.8, Math.min(6, dist + e.deltaY * 0.002))
    }

    host.addEventListener('pointerdown', onPointerDown)
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerup', onPointerUp)
    host.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const tick = () => {
      camera.position.set(
        Math.cos(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 0.2,
        Math.sin(yaw) * Math.cos(pitch) * dist,
      )
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      host.removeEventListener('pointerdown', onPointerDown)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerup', onPointerUp)
      host.removeEventListener('wheel', onWheel)
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
      host.innerHTML = ''
    }
  }, [
    pieces,
    moduleWidthMm,
    moduleHeightMm,
    moduleDepthMm,
    boxThicknessMm,
    selectedPieceId,
  ])

  return (
    <div
      ref={hostRef}
      className={cn('relative h-full min-h-[240px] w-full overflow-hidden rounded-lg bg-[#0f1419]', className)}
      role="img"
      aria-label="Visualização raio-X 3D do módulo"
    />
  )
}
