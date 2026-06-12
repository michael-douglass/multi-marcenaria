import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X, ZoomIn, Play } from 'lucide-react'

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
            Tela cheia · Esc para fechar
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

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {kind === 'video' ? (
          <video
            src={imageUrl}
            controls
            autoPlay={false}
            playsInline
            className="max-h-full max-w-full rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          />
        ) : (
          <img
            src={imageUrl}
            alt={title}
            className="max-h-full max-w-full rounded-lg object-contain shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          />
        )}
      </div>
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
