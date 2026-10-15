import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tryCreateWebGLRenderer } from '@/lib/webgl-support'
import type { AtomicPiece, AtomicPieceRole } from '@/lib/orcamentos-ia/schemas'
import { colorForAtomicPiece } from '@/lib/orcamentos-ia/bom-engine/atomic-pieces'

export interface RaioX3DProps {
  /** Peças atômicas já posicionadas (builder client-side). */
  atomic_pieces: AtomicPiece[]
  selectedPieceId?: string | null
  className?: string
  moduleName?: string
  environmentName?: string
  dimensionsMm?: {
    width_mm?: number | null
    height_mm?: number | null
    depth_mm?: number | null
  } | null
  /** Índice 0-based do módulo atual na lista navegável. */
  moduleIndex?: number
  moduleCount?: number
  /** Origem das peças: lista de corte, extração ou desmonte estimado. */
  sourceLabel?: string
  onPrevModule?: () => void
  onNextModule?: () => void
}

const ROLE_LABELS: Record<AtomicPieceRole, string> = {
  lateral: 'Lateral',
  base: 'Base',
  tampo: 'Tampo',
  divisoria: 'Divisória',
  prateleira: 'Prateleira',
  fundo: 'Fundo',
  travessa: 'Travessa',
  sarrafo: 'Sarrafo',
  frente: 'Frente',
  porta: 'Porta',
  gaveta_lateral: 'Lateral de gaveta',
  gaveta_contrafundo: 'Contrafundo de gaveta',
  gaveta_fundo: 'Fundo de gaveta',
  outro: 'Outra peça',
}

interface LegendItem {
  key: string
  label: string
  color: string
  count: number
}

function buildLegendItems(pieces: AtomicPiece[]): LegendItem[] {
  const map = new Map<string, LegendItem>()
  for (const piece of pieces) {
    const key = piece.role
    const existing = map.get(key)
    if (existing) {
      existing.count += piece.quantity || 1
      continue
    }
    const { color } = colorForAtomicPiece(piece)
    map.set(key, {
      key,
      label: ROLE_LABELS[piece.role] ?? piece.role,
      color,
      count: piece.quantity || 1,
    })
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

function formatDimsMm(dims?: RaioX3DProps['dimensionsMm']): string | null {
  if (!dims) return null
  const w = Number(dims.width_mm)
  const h = Number(dims.height_mm)
  const d = Number(dims.depth_mm)
  const parts: string[] = []
  if (Number.isFinite(w) && w > 0) parts.push(`${Math.round(w)}`)
  if (Number.isFinite(h) && h > 0) parts.push(`${Math.round(h)}`)
  if (Number.isFinite(d) && d > 0) parts.push(`${Math.round(d)}`)
  if (parts.length < 2) return null
  return `${parts.join(' × ')} mm`
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
  moduleName,
  environmentName,
  dimensionsMm,
  moduleIndex = 0,
  moduleCount = 1,
  sourceLabel,
  onPrevModule,
  onNextModule,
}: RaioX3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<{
    startX: number
    startY: number
    totalX: number
    totalY: number
    active: boolean
  } | null>(null)
  /** Legenda recolhida por padrão para maximizar a área 3D. */
  const [legendOpen, setLegendOpen] = useState(false)

  const legend = useMemo(() => buildLegendItems(atomic_pieces), [atomic_pieces])
  const dimsLabel = formatDimsMm(dimensionsMm)
  const canPrev = Boolean(onPrevModule) && moduleIndex > 0
  const canNext = Boolean(onNextModule) && moduleIndex < moduleCount - 1
  const counterLabel =
    moduleCount > 0 ? `${Math.min(moduleIndex + 1, moduleCount)} / ${moduleCount}` : '—'

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
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 80)

    const group = new THREE.Group()

    for (const piece of atomic_pieces) {
      const highlighted =
        selectedPieceId != null &&
        (piece.id === selectedPieceId ||
          piece.id.startsWith(`${selectedPieceId}-`) ||
          selectedPieceId.startsWith(piece.id))
      const painted: AtomicPiece = highlighted ? { ...piece, highlighted: true } : piece
      const { color, opacity } = colorForAtomicPiece(painted)
      const isFront =
        piece.sheet_role === 'front_color' ||
        piece.role === 'frente' ||
        piece.role === 'porta'

      const geo = new THREE.BoxGeometry(piece.size_m[0], piece.size_m[1], piece.size_m[2])
      // Caixa = vidro Branco TX (opacidade ~0.6, transmission alto);
      // Frentes decorativas = contraste (opacidade ~0.85, transmission baixo).
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity,
        roughness: isFront ? 0.4 : 0.12,
        metalness: 0,
        transmission: isFront ? 0.05 : 0.35,
        thickness: isFront ? 0.25 : 0.55,
        ior: 1.4,
        clearcoat: isFront ? 0.2 : 0.45,
        clearcoatRoughness: isFront ? 0.35 : 0.25,
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

    // Enquadra o móvel inteiro na área útil (fit-to-view).
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)
    const fitDist = Math.max(sphere.radius / Math.sin((camera.fov * Math.PI) / 360) / 1.15, 1.2)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(2.2, 3.2, 1.6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35)
    fill.position.set(-1.8, 1.2, -1.4)
    scene.add(fill)

    let raf = 0
    let yaw = 0.55
    let pitch = 0.28
    let dist = fitDist
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
      // Ignora cliques nos botões da barra (eles estão fora do host canvas area via overlay)
      if ((e.target as HTMLElement | null)?.closest?.('[data-raiox-chrome]')) return
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      swipeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        totalX: 0,
        totalY: 0,
        active: true,
      }
      host.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (swipeRef.current?.active) {
        swipeRef.current.totalX += dx
        swipeRef.current.totalY += dy
      }
      // Orbit só quando o gesto não é um swipe horizontal dominante
      const swipe = swipeRef.current
      const isSwipe =
        swipe &&
        Math.abs(swipe.totalX) > 40 &&
        Math.abs(swipe.totalX) > Math.abs(swipe.totalY) * 1.8
      if (!isSwipe) {
        yaw += dx * 0.008
        pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.008))
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      try {
        host.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const swipe = swipeRef.current
      swipeRef.current = null
      if (!swipe?.active) return
      const absX = Math.abs(swipe.totalX)
      const absY = Math.abs(swipe.totalY)
      if (absX < 70 || absX < absY * 1.6) return
      if (swipe.totalX < 0) onNextModule?.()
      else onPrevModule?.()
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      dist = Math.max(fitDist * 0.35, Math.min(fitDist * 3.5, dist + e.deltaY * 0.0025))
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
  }, [atomic_pieces, selectedPieceId, onPrevModule, onNextModule])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrevModule?.()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNextModule?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrevModule, onNextModule])

  return (
    <div
      className={cn(
        'relative flex h-full min-h-[240px] w-full flex-col overflow-hidden rounded-lg bg-[#0f1419]',
        className,
      )}
      role="img"
      aria-label={
        moduleName
          ? `Raio-X 3D do módulo ${moduleName}`
          : 'Visualização raio-X 3D da caixaria atômica do módulo'
      }
    >
      {/* Barra compacta — pouco overlay para maximizar o 3D */}
      <div
        data-raiox-chrome
        className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 bg-gradient-to-b from-black/55 to-transparent px-1.5 pb-4 pt-1.5"
      >
        <button
          type="button"
          data-raiox-chrome
          disabled={!canPrev}
          onClick={() => onPrevModule?.()}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition',
            canPrev ? 'hover:bg-[#0066FF]/80' : 'cursor-not-allowed opacity-35',
          )}
          aria-label="Módulo anterior"
          title="Módulo anterior (←)"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 text-center leading-tight">
          <p className="truncate text-[13px] font-semibold text-white">
            {moduleName ?? 'Módulo'}
            <span className="ml-1.5 font-normal tabular-nums text-[#8eb6ff]">{counterLabel}</span>
          </p>
          <p className="truncate text-[10px] text-white/60">
            {[environmentName, dimsLabel].filter(Boolean).join(' · ') || 'Raio-X'}
          </p>
        </div>

        <button
          type="button"
          data-raiox-chrome
          disabled={!canNext}
          onClick={() => onNextModule?.()}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition',
            canNext ? 'hover:bg-[#0066FF]/80' : 'cursor-not-allowed opacity-35',
          )}
          aria-label="Próximo módulo"
          title="Próximo módulo (→)"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas Three.js — ocupa 100% do painel */}
      <div ref={hostRef} className="relative z-[1] min-h-0 flex-1 touch-none" />

      {/* Legenda recolhível */}
      {legend.length > 0 && (
        <div
          data-raiox-chrome
          className={cn(
            'pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-2',
            legendOpen
              ? 'bg-gradient-to-t from-black/80 via-black/50 to-transparent pb-2 pt-6'
              : 'bg-gradient-to-t from-black/50 to-transparent pb-1.5 pt-4',
          )}
        >
          <button
            type="button"
            data-raiox-chrome
            onClick={() => setLegendOpen((o) => !o)}
            className="mx-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/75 backdrop-blur-sm hover:bg-black/55"
            aria-expanded={legendOpen}
          >
            {legendOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            Legenda · {legend.length}
          </button>
          {legendOpen && (
            <>
              <ul className="mt-1.5 flex max-h-[5.5rem] flex-wrap justify-center gap-x-3 gap-y-1 overflow-y-auto">
                {legend.map((item) => (
                  <li
                    key={item.key}
                    className="inline-flex items-center gap-1.5 text-[11px] text-white/90"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/30"
                      style={{ backgroundColor: item.color }}
                      aria-hidden
                    />
                    <span>
                      {item.label}
                      <span className="text-white/50"> · {item.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-center text-[10px] text-white/40">
                Arraste · scroll zoom · ← → módulos
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
