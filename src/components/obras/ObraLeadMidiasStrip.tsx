import { useMemo, useState } from 'react'
import { FileText, ImageIcon, Loader2 } from 'lucide-react'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import type { LeadMidia } from '@/types'

const MAX_THUMBS_COMPACT = 4

interface ObraLeadMidiasStripProps {
  midias: LeadMidia[]
  loading?: boolean
  /** Card da agenda: faixa compacta. Modal: grade um pouco maior. */
  variant?: 'compact' | 'detail'
}

function midiaKind(tipo: LeadMidia['tipo']): 'image' | 'pdf' | 'video' {
  if (tipo === 'pdf') return 'pdf'
  if (tipo === 'video') return 'video'
  return 'image'
}

export function ObraLeadMidiasStrip({
  midias,
  loading = false,
  variant = 'compact',
}: ObraLeadMidiasStripProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const visible = useMemo(() => {
    if (variant === 'detail') return midias
    return midias.slice(0, MAX_THUMBS_COMPACT)
  }, [midias, variant])

  const extra = variant === 'compact' ? Math.max(0, midias.length - MAX_THUMBS_COMPACT) : 0
  const active = lightboxIndex != null ? midias[lightboxIndex] : null

  if (loading && midias.length === 0) {
    return (
      <div
        className="flex items-center gap-1.5 text-[0.65rem] text-[#b8957f]"
        onClick={e => e.stopPropagation()}
      >
        <Loader2 size={12} className="animate-spin shrink-0" />
        <span>Carregando fotos…</span>
      </div>
    )
  }

  if (midias.length === 0) return null

  const thumbSize = variant === 'compact' ? 'h-12 w-12' : 'h-16 w-16'

  return (
    <>
      <div
        className="flex flex-col gap-1 min-w-0"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {variant === 'detail' && (
          <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4] m-0">
            Fotos / docs do projeto
          </p>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 min-w-0">
          {visible.map((midia, index) => {
            const isPdf = midia.tipo === 'pdf'
            return (
              <button
                key={midia.id}
                type="button"
                title={midia.titulo}
                className={`relative shrink-0 ${thumbSize} overflow-hidden rounded border border-[rgba(240,210,140,0.28)] bg-[rgba(68,46,34,0.65)] hover:border-[#f2d892]/70 transition-colors`}
                onClick={() => setLightboxIndex(index)}
              >
                {isPdf ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[rgba(0,0,0,0.35)] px-0.5">
                    <FileText size={variant === 'compact' ? 14 : 18} className="text-[#f2d892] opacity-90" />
                    <span className="text-[0.45rem] font-bold uppercase text-[#f2d892]">PDF</span>
                  </div>
                ) : midia.file_url ? (
                  <img
                    src={midia.file_url}
                    alt={midia.titulo}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon size={14} className="text-[#b8957f]" />
                  </div>
                )}
              </button>
            )
          })}
          {extra > 0 && (
            <button
              type="button"
              className={`shrink-0 ${thumbSize} rounded border border-[rgba(240,210,140,0.28)] bg-[rgba(68,46,34,0.85)] text-[0.7rem] font-semibold text-[#f2d892] hover:border-[#f2d892]/70`}
              title={`Ver mais ${extra} arquivo${extra !== 1 ? 's' : ''}`}
              onClick={() => setLightboxIndex(MAX_THUMBS_COMPACT)}
            >
              +{extra}
            </button>
          )}
        </div>
      </div>

      {active && (
        <AnexoLightbox
          open
          imageUrl={active.file_url}
          title={active.titulo}
          kind={midiaKind(active.tipo)}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
