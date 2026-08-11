import { useEffect, useMemo, useState } from 'react'
import { FileText, ImageIcon, Loader2 } from 'lucide-react'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import {
  expandLeadMidiasToDisplayItems,
  type LeadMidiaDisplayItem,
} from '@/lib/obra-lead-midias-display'
import type { LeadMidia } from '@/types'

const MAX_THUMBS_COMPACT = 4

interface ObraLeadMidiasStripProps {
  midias: LeadMidia[]
  loading?: boolean
  /** Card da agenda: faixa compacta. Modal: grade um pouco maior. */
  variant?: 'compact' | 'detail'
}

function itemDisplayUrl(item: LeadMidiaDisplayItem): string {
  return item.thumbUrl || item.galleryPages[item.galleryIndex] || item.galleryPages[0] || ''
}

export function ObraLeadMidiasStrip({
  midias,
  loading = false,
  variant = 'compact',
}: ObraLeadMidiasStripProps) {
  const [items, setItems] = useState<LeadMidiaDisplayItem[]>([])
  const [expanding, setExpanding] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const midiasKey = useMemo(
    () => midias.map(m => `${m.id}:${m.tipo}:${m.file_url}`).join('|'),
    [midias],
  )

  useEffect(() => {
    let cancelled = false

    if (midias.length === 0) {
      setItems([])
      setExpanding(false)
      return
    }

    const hasPdf = midias.some(m => m.tipo === 'pdf')
    setExpanding(hasPdf)

    void expandLeadMidiasToDisplayItems(midias, next => {
      if (!cancelled) setItems(next)
    })
      .then(next => {
        if (!cancelled) setItems(next)
      })
      .finally(() => {
        if (!cancelled) setExpanding(false)
      })

    return () => {
      cancelled = true
    }
  }, [midiasKey, midias])

  /** Todas as fotos do lead (imagens + páginas de PDF) para navegar ← → na tela cheia. */
  const galleryPages = useMemo(
    () => items.map(itemDisplayUrl).filter(Boolean),
    [items],
  )

  const visible = useMemo(() => {
    if (variant === 'detail') return items
    return items.slice(0, MAX_THUMBS_COMPACT)
  }, [items, variant])

  const extra = variant === 'compact' ? Math.max(0, items.length - MAX_THUMBS_COMPACT) : 0
  const showLoading = (loading || expanding) && items.length === 0
  const activeItem = lightboxIndex != null ? items[lightboxIndex] : null
  const activeUrl =
    lightboxIndex != null ? galleryPages[lightboxIndex] ?? itemDisplayUrl(activeItem!) : ''

  if (showLoading) {
    return (
      <div
        className="flex items-center gap-1.5 text-[0.65rem] text-[#b8957f]"
        onClick={e => e.stopPropagation()}
      >
        <Loader2 size={12} className="animate-spin shrink-0" />
        <span>{expanding ? 'Preparando páginas do PDF…' : 'Carregando fotos…'}</span>
      </div>
    )
  }

  if (items.length === 0) return null

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
            {expanding ? ' · convertendo PDF…' : ''}
            {galleryPages.length > 1 ? ` · ${galleryPages.length} fotos` : ''}
          </p>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 min-w-0">
          {visible.map(item => {
            const openIndex = items.findIndex(i => i.key === item.key)
            return (
              <button
                key={item.key}
                type="button"
                title={item.title}
                className={`relative shrink-0 ${thumbSize} overflow-hidden rounded border border-[rgba(240,210,140,0.28)] bg-[rgba(68,46,34,0.65)] hover:border-[#f2d892]/70 transition-colors`}
                onClick={() => setLightboxIndex(openIndex >= 0 ? openIndex : 0)}
              >
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : item.kind === 'pdf' ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[rgba(0,0,0,0.35)] px-0.5">
                    <FileText size={variant === 'compact' ? 14 : 18} className="text-[#f2d892] opacity-90" />
                    <span className="text-[0.45rem] font-bold uppercase text-[#f2d892]">PDF</span>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon size={14} className="text-[#b8957f]" />
                  </div>
                )}
                {galleryPages.length > 1 && (
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-[rgba(0,0,0,0.7)] px-1 text-[0.45rem] font-bold text-[#f2d892]">
                    {openIndex + 1}/{galleryPages.length}
                  </span>
                )}
              </button>
            )
          })}
          {extra > 0 && (
            <button
              type="button"
              className={`shrink-0 ${thumbSize} rounded border border-[rgba(240,210,140,0.28)] bg-[rgba(68,46,34,0.85)] text-[0.7rem] font-semibold text-[#f2d892] hover:border-[#f2d892]/70`}
              title={`Ver mais ${extra} foto${extra !== 1 ? 's' : ''}`}
              onClick={() => setLightboxIndex(MAX_THUMBS_COMPACT)}
            >
              +{extra}
            </button>
          )}
        </div>
      </div>

      {lightboxIndex != null && activeUrl && (
        <AnexoLightbox
          open
          imageUrl={activeUrl}
          pages={galleryPages}
          initialPageIndex={lightboxIndex}
          title={activeItem?.title ?? `Foto ${lightboxIndex + 1}`}
          kind="image"
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
