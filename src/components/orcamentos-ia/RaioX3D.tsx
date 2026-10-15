import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'
import type { AtomicPiece } from '@/lib/orcamentos-ia/schemas'
import { colorForAtomicPiece } from '@/lib/orcamentos-ia/bom-engine/atomic-pieces'

export interface RaioX3DProps {
  /** Peças atômicas já posicionadas (builder client-side). */
  atomic_pieces: AtomicPiece[]
  selectedPieceId?: string | null
  className?: string
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Raio-X 3D da caixaria atômica (Three.js + MeshPhysicalMaterial).
 * 100% client-side — sem requisições de IA.
 */
export function RaioX3D({
  atomic_pieces,
  selectedPieceId = null,
  className,
}: RaioX3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || atomic_pieces.length === 0) return

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

    const group = new THREE.Group()

    for (const piece of atomic_pieces) {
      const highlighted = selectedPieceId != null && (
        piece.id === selectedPieceId ||
        piece.id.startsWith(`${selectedPieceId}-`) ||
        selectedPieceId.startsWith(piece.id)
      )
      const painted: AtomicPiece = highlighted ? { ...piece, highlighted: true } : piece
      const { color, opacity } = colorForAtomicPiece(painted)
      const isFront = piece.sheet_role === 'front_color'

      const geo = new THREE.BoxGeometry(piece.size_m[0], piece.size_m[1], piece.size_m[2])
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: isFront ? Math.max(opacity, 0.82) : opacity,
        roughness: isFront ? 0.35 : 0.18,
        metalness: 0,
        transmission: isFront ? 0.08 : 0.22,
        thickness: 0.4,
        ior: 1.4,
        clearcoat: isFront ? 0.15 : 0.35,
        clearcoatRoughness: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      })

      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(piece.position_m[0], piece.position_m[1], piece.position_m[2])
      mesh.name = piece.gapTag ? `${piece.name} · ${piece.gapTag}` : piece.name
      mesh.userData.piece = piece
      group.add(mesh)
    }

    const box = new THREE.Box3().setFromObject(group)
    const center = box.getCenter(new THREE.Vector3())
    group.position.sub(center)
    scene.add(group)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(2.2, 3.2, 1.6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35)
    fill.position.set(-1.8, 1.2, -1.4)
    scene.add(fill)

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
  }, [atomic_pieces, selectedPieceId])

  return (
    <div
      ref={hostRef}
      className={cn(
        'relative h-full min-h-[240px] w-full overflow-hidden rounded-lg bg-[#0f1419]',
        className,
      )}
      role="img"
      aria-label="Visualização raio-X 3D da caixaria atômica do módulo"
    />
  )
}
