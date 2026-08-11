import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X, ZoomIn, ZoomOut, RotateCcw, Play, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useMobileLayout } from '@/hooks/useMobileLayout'

type Kind = 'image' | 'pdf' | 'video' | 'document'

interface AnexoLightboxProps {
  open: boolean
  imageUrl: string
  /** Todas as páginas (PDF multipágina). Se omitido, usa só imageUrl. */
  pages?: string[]
  /** Página inicial ao abrir (0-based). Útil quando o usuário clica na página 5 de 10. */
  initialPageIndex?: number
  title: string
  /** Descrição / observação do anexo (ex.: evolução da obra). */
  description?: string | null
  kind?: Kind
  onClose: () => void
  onDelete?: () => void
  deleting?: boolean
}

const MIN_SCALE = 1
const MAX_SCALE = 5
const ZOOM_STEP = 0.2

function ZoomableImage({ src, alt, compact = false }: { src: string; alt: string; compact?: boolean }) {
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      {compact ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-[rgba(240,210,140,0.2)] bg-[rgba(8,4,2,0.88)] px-2 py-1 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              className="btn btn-outline btn-sm !h-8 !min-h-8 !w-8 !px-0"
              onClick={() => applyZoom(-ZOOM_STEP)}
              disabled={scale <= MIN_SCALE}
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[2.75rem] text-center text-[0.65rem] text-[#edd9c4]">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm !h-8 !min-h-8 !w-8 !px-0"
              onClick={() => applyZoom(ZOOM_STEP)}
              disabled={scale >= MAX_SCALE}
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm !h-8 !min-h-8 !w-8 !px-0"
              onClick={resetView}
              disabled={scale === 1 && pos.x === 0 && pos.y === 0}
              aria-label="Redefinir zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-[rgba(240,210,140,0.12)] px-4 py-2">
          <button
            type="button"
            className="btn btn-outline btn-sm !px-2"
            onClick={() => applyZoom(-ZOOM_STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3.5rem] text-center text-xs text-[#edd9c4]">
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
          <span className="hidden text-[0.65rem] text-[#d4bc9f] sm:inline">
            Scroll ou botões para zoom · arraste para mover
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className={[
          'flex min-h-0 flex-1 items-center justify-center overflow-hidden touch-none',
          compact ? 'p-1 pb-14' : 'p-4',
        ].join(' ')}
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

function PdfPagesViewer({
  pages,
  title,
  compact = false,
  initialPageIndex = 0,
  counterLabel = 'Página',
  prevAriaLabel = 'Página anterior',
  nextAriaLabel = 'Próxima página',
}: {
  pages: string[]
  title: string
  compact?: boolean
  initialPageIndex?: number
  /** Texto do contador: "Página" (PDF) ou "Foto" (galeria do lead). */
  counterLabel?: string
  prevAriaLabel?: string
  nextAriaLabel?: string
}) {
  const total = pages.length
  const clampIndex = (i: number) => Math.min(Math.max(0, i), Math.max(0, total - 1))
  const [pageIndex, setPageIndex] = useState(() => clampIndex(initialPageIndex))
  const currentUrl = pages[clampIndex(pageIndex)] ?? ''
  // Chave estável do conteúdo — evita resetar a página a cada re-render.
  const pagesKey = pages.join('\0')

  useEffect(() => {
    setPageIndex(clampIndex(initialPageIndex))
  }, [pagesKey, initialPageIndex, total])

  useEffect(() => {
    if (total <= 1) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPageIndex(i => Math.max(0, i - 1))
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPageIndex(i => Math.min(total - 1, i + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {total > 1 && (
        <div className={[
          'flex shrink-0 items-center justify-center gap-3 border-b border-[rgba(240,210,140,0.12)]',
          compact ? 'px-2 py-1' : 'px-4 py-2',
        ].join(' ')}>
          <button
            type="button"
            className="btn btn-outline btn-sm !px-2"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex(i => Math.max(0, i - 1))}
            aria-label={prevAriaLabel}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs text-[#f2d892]">
            {counterLabel} {pageIndex + 1} / {total}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm !px-2"
            disabled={pageIndex >= total - 1}
            onClick={() => setPageIndex(i => Math.min(total - 1, i + 1))}
            aria-label={nextAriaLabel}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <ZoomableImage src={currentUrl} alt={`${title} — ${counterLabel.toLowerCase()} ${pageIndex + 1}`} compact={compact} />
    </div>
  )
}

/** Celular em paisagem (ex.: iPhone) usa layout compacto mesmo com largura > 767px. */
const LANDSCAPE_PHONE_MEDIA = '(max-height: 520px) and (pointer: coarse)'

function useLightboxCompact(): boolean {
  const isMobile = useMobileLayout()
  const [landscapePhone, setLandscapePhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(LANDSCAPE_PHONE_MEDIA).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(LANDSCAPE_PHONE_MEDIA)
    const onChange = () => setLandscapePhone(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile || landscapePhone
}

export function AnexoLightbox({
  open,
  imageUrl,
  pages,
  initialPageIndex = 0,
  title,
  description,
  kind = 'image',
  onClose,
  onDelete,
  deleting = false,
}: AnexoLightboxProps) {
  const compact = useLightboxCompact()
  const pageUrls = pages?.length ? pages : imageUrl ? [imageUrl] : []

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
  const isImageGallery = kind === 'image' && pageUrls.length > 1
  const isMultiPagePdf = (kind === 'pdf' || kind === 'document') && pageUrls.length > 1
  const useGalleryNav = isImageGallery || isMultiPagePdf || kind === 'pdf' || (kind === 'document' && pageUrls.length > 0)
  const galleryCounterLabel = kind === 'image' ? 'Foto' : 'Página'
  const galleryPrevLabel = kind === 'image' ? 'Foto anterior' : 'Página anterior'
  const galleryNextLabel = kind === 'image' ? 'Próxima foto' : 'Próxima página'

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-[rgba(4,2,1,0.96)] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0px,env(safe-area-inset-bottom))] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualização: ${title}`}
    >
      {compact ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 py-2">
          <div className="pointer-events-auto flex min-w-0 items-center gap-1.5">
            {onDelete ? (
              <button
                type="button"
                className="btn btn-danger btn-sm !h-11 !min-h-11 !w-11 !px-0"
                onClick={onDelete}
                disabled={deleting}
                aria-label={deleting ? 'Excluindo anexo' : 'Excluir anexo'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="pointer-events-auto btn btn-outline btn-sm !h-11 !min-h-11 !w-11 !px-0"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(240,210,140,0.15)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-cream">{title}</p>
            {description?.trim() && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[#d4c4a8] whitespace-pre-wrap">
                {description.trim()}
              </p>
            )}
            <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
              {isVideo
                ? 'Vídeo · Esc para fechar'
                : isImageGallery
                  ? `${pageUrls.length} fotos · Esc para fechar · ← → para navegar`
                  : kind === 'pdf' || kind === 'document'
                    ? `${pageUrls.length} página${pageUrls.length !== 1 ? 's' : ''} · Esc para fechar${isMultiPagePdf ? ' · ← → para navegar' : ''}`
                    : 'Tela cheia · Esc para fechar'}
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
              className="btn btn-outline btn-sm !min-h-11 !min-w-11 !px-2"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {compact && description?.trim() ? (
        <p className="pointer-events-none absolute bottom-[max(3.5rem,env(safe-area-inset-bottom))] left-0 right-0 z-10 line-clamp-2 px-3 text-center text-[0.62rem] leading-snug text-[#d4c4a8]/90">
          {description.trim()}
        </p>
      ) : null}

      {isVideo ? (
        <div className={`flex min-h-0 flex-1 items-center justify-center overflow-auto ${compact ? 'p-2 pt-14' : 'p-4'}`}>
          <video
            src={imageUrl}
            controls
            autoPlay={false}
            playsInline
            className="max-h-full max-w-full rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          />
        </div>
      ) : kind === 'document' && pageUrls.length === 0 ? (
        <div className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-4 ${compact ? 'p-4 pt-16' : 'p-8'}`}>
          <FileText className="h-16 w-16 text-[#f2d892]" />
          <p className="max-w-md text-center text-sm text-[#edd9c4]">{title}</p>
          <p className="text-xs text-[#b8957f]">Arquivo Word — pré-visualização indisponível.</p>
          {imageUrl ? (
            <a
              href={imageUrl}
              download={title}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-gold btn-sm"
            >
              Baixar arquivo
            </a>
          ) : null}
        </div>
      ) : useGalleryNav ? (
        <PdfPagesViewer
          pages={pageUrls}
          title={title}
          compact={compact}
          initialPageIndex={initialPageIndex}
          counterLabel={galleryCounterLabel}
          prevAriaLabel={galleryPrevLabel}
          nextAriaLabel={galleryNextLabel}
        />
      ) : (
        <ZoomableImage src={pageUrls[0] ?? imageUrl} alt={title} compact={compact} />
      )}
    </div>,
    document.body,
  )
}

interface AnexoThumbProps {
  previewUrl: string
  nome: string
  kind: Kind
  pageCount?: number
  onOpenFullscreen: () => void
  onDelete?: () => void
}

export function AnexoThumb({ previewUrl, nome, kind, pageCount, onOpenFullscreen, onDelete }: AnexoThumbProps) {
  const hasPreview = !!previewUrl
  const multiPage = (pageCount ?? 0) > 1

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[rgba(240,210,140,0.28)] bg-[rgba(68,46,34,0.65)]">
      <button
        type="button"
        className="block w-full"
        onClick={onOpenFullscreen}
        aria-label={`Ver ${nome} em tela cheia${multiPage ? ` (${pageCount} páginas)` : ''}`}
      >
        <div className="relative aspect-[4/3] w-full min-w-[120px] max-w-[160px]">
          {kind === 'document' && !hasPreview ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[rgba(0,0,0,0.35)] px-2">
              <FileText className="h-8 w-8 text-[#f2d892] opacity-80" />
              <span className="truncate text-[0.55rem] uppercase tracking-wider text-[#b8957f]">
                Word
              </span>
            </div>
          ) : hasPreview ? (
            <img src={previewUrl} alt={nome} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[rgba(0,0,0,0.4)]">
              <Play className="h-8 w-8 text-[#f2d892] opacity-60" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.35)] opacity-0 transition-opacity group-hover:opacity-100">
            {kind === 'video' ? (
              <Play className="h-6 w-6 text-[#f2d892]" />
            ) : (
              <ZoomIn className="h-6 w-6 text-[#f2d892]" />
            )}
          </div>
          {kind === 'pdf' && (
            <span className="absolute left-1 top-1 rounded bg-[rgba(240,210,140,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-[#2a1812]">
              {multiPage ? `PDF · ${pageCount}p` : 'PDF'}
            </span>
          )}
          {kind === 'document' && (
            <span className="absolute left-1 top-1 rounded bg-[rgba(37,99,235,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-white">
              {nome.toLowerCase().endsWith('.docx') ? 'DOCX' : 'DOTX'}
            </span>
          )}
          {kind === 'video' && (
            <span className="absolute left-1 top-1 rounded bg-[rgba(59,130,246,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-white">
              VÍD
            </span>
          )}
        </div>
      </button>
      <p className="truncate px-2 py-1 text-[0.65rem] text-[#edd9c4]" title={nome}>
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
