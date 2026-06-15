import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X, ZoomIn, ZoomOut, RotateCcw, Play } from 'lucide-react'

type Kind = 'image' | 'pdf' | 'video'

interface AnexoLightboxProps {
  open: boolean
  imageUrl: string
  title: string
  kind?: Kind
  onClose: () => void
  onDelete?: () => void
  deleting?: boolean
}

const MIN_SCALE = 1
const MAX_SCALE = 5
const ZOOM_STEP = 0.2

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  })

  const resetView = useCallback(() => {
    setScale(1)
    setPos({ x: 0, y: 0 })
  }, [])

  const applyZoom = useCallback((delta: number) => {
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta))
      if (next <= MIN_SCALE) setPos({ x: 0, y: 0 })
      return next
    })
  }, [])

  useEffect(() => {
    resetView()
  }, [src, resetView])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      applyZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    setPos({
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.active = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-[rgba(212,168,83,0.12)] px-4 py-2">
        <button
          type="button"
          className="btn btn-outline btn-sm !px-2"
          onClick={() => applyZoom(-ZOOM_STEP)}
          disabled={scale <= MIN_SCALE}
          aria-label="Diminuir zoom"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[3.5rem] text-center text-xs text-[#8a6a55]">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm !px-2"
          onClick={() => applyZoom(ZOOM_STEP)}
          disabled={scale >= MAX_SCALE}
          aria-label="Aumentar zoom"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm !px-2"
          onClick={resetView}
          disabled={scale === 1 && pos.x === 0 && pos.y === 0}
          aria-label="Redefinir zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <span className="hidden text-[0.65rem] text-[#6b5544] sm:inline">
          Scroll ou botões para zoom · arraste para mover
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 touch-none"
        onDoubleClick={() => (scale > 1 ? resetView() : applyZoom(ZOOM_STEP * 2))}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="max-h-full max-w-full select-none rounded-lg object-contain shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            cursor: scale > 1 ? (dragRef.current.active ? 'grabbing' : 'grab') : 'zoom-in',
            transition: dragRef.current.active ? 'none' : 'transform 0.12s ease-out',
          }}
        />
      </div>
    </div>
  )
}

export function AnexoLightbox({
  open,
  imageUrl,
  title,
  kind = 'image',
  onClose,
  onDelete,
  deleting = false,
}: AnexoLightboxProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const isVideo = kind === 'video'

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-[rgba(4,2,1,0.96)] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualização: ${title}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(212,168,83,0.15)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-cream">{title}</p>
          <p className="text-[0.65rem] uppercase tracking-wider text-[#8a6a55]">
            {isVideo ? 'Vídeo · Esc para fechar' : kind === 'pdf' ? 'PDF convertido · Esc para fechar' : 'Tela cheia · Esc para fechar'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onDelete && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm !px-2"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isVideo ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <video
            src={imageUrl}
            controls
            autoPlay={false}
            playsInline
            className="max-h-full max-w-full rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          />
        </div>
      ) : (
        <ZoomableImage src={imageUrl} alt={title} />
      )}
    </div>,
    document.body,
  )
}

interface AnexoThumbProps {
  previewUrl: string
  nome: string
  kind: Kind
  onOpenFullscreen: () => void
  onDelete?: () => void
}

export function AnexoThumb({ previewUrl, nome, kind, onOpenFullscreen, onDelete }: AnexoThumbProps) {
  const hasPreview = !!previewUrl

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[rgba(212,168,83,0.28)] bg-[rgba(15,7,3,0.65)]">
      <button
        type="button"
        className="block w-full"
        onClick={onOpenFullscreen}
        aria-label={`Ver ${nome} em tela cheia`}
      >
        <div className="relative aspect-[4/3] w-full min-w-[120px] max-w-[160px]">
          {hasPreview ? (
            <img src={previewUrl} alt={nome} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[rgba(0,0,0,0.4)]">
              <Play className="h-8 w-8 text-[#d4a853] opacity-60" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.35)] opacity-0 transition-opacity group-hover:opacity-100">
            {kind === 'video' ? (
              <Play className="h-6 w-6 text-[#d4a853]" />
            ) : (
              <ZoomIn className="h-6 w-6 text-[#d4a853]" />
            )}
          </div>
          {kind === 'pdf' && (
            <span className="absolute left-1 top-1 rounded bg-[rgba(212,168,83,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-[#150c09]">
              PDF
            </span>
          )}
          {kind === 'video' && (
            <span className="absolute left-1 top-1 rounded bg-[rgba(59,130,246,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-white">
              VÍD
            </span>
          )}
        </div>
      </button>
      <p className="truncate px-2 py-1 text-[0.65rem] text-[#8a6a55]" title={nome}>
        {nome}
      </p>
      {onDelete && (
        <button
          type="button"
          className="absolute right-1 top-1 rounded-md bg-[rgba(8,3,1,0.85)] p-1 text-red-400 opacity-0 transition-opacity hover:bg-red-950 group-hover:opacity-100"
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Excluir ${nome}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
