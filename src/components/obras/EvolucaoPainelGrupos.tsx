import { useState } from 'react'
import { Calendar, Camera, HardHat, Maximize2, MessageSquareText } from 'lucide-react'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import { EvolucaoObservacao } from '@/components/obras/EvolucaoObservacao'
import { ObraMontadoresConclusao } from '@/components/obras/ObraMontadoresConclusao'
import {
  evolucaoLightboxPages,
  evolucaoThumbUrl,
  type EvolucaoPainelItemComUrl,
} from '@/lib/obra-evolucao'
import type { EvolucaoGrupoObra } from '@/hooks/useObraEvolucao'
import type { ObraFull } from '@/types'
import { fmtDate, fmtTime } from '@/lib/utils'

type LightboxState = {
  url: string
  pages?: string[]
  nome: string
  kind: 'image' | 'pdf' | 'video' | 'text'
  observacao?: string | null
}

function EvolucaoThumb({
  foto,
  onOpen,
}: {
  foto: EvolucaoPainelItemComUrl
  onOpen: () => void
}) {
  const thumbUrl = evolucaoThumbUrl(foto)
  const horario = fmtTime(foto.tirado_em)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-md border border-[rgba(240,210,140,0.15)] bg-black/40 sm:h-[8.25rem] sm:w-[8.25rem]"
      aria-label={`Ver foto de ${foto.obra_nome} às ${horario}`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={foto.nome_arquivo}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#edd9c4]">
          <Camera size={14} />
        </div>
      )}

      {foto.kind === 'video' && (
        <span className="absolute left-0.5 top-0.5 rounded bg-[rgba(59,130,246,0.9)] px-0.5 text-[0.45rem] font-bold uppercase text-white">
          VÍD
        </span>
      )}
      {foto.kind === 'pdf' && (
        <span className="absolute left-0.5 top-0.5 rounded bg-[rgba(240,210,140,0.9)] px-0.5 text-[0.45rem] font-bold uppercase text-[#2a1812]">
          PDF
        </span>
      )}

      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1 py-px text-[0.5rem] font-semibold tabular-nums leading-tight text-white">
        {horario}
      </span>

      <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
        <Maximize2 size={12} className="text-white" />
      </div>
    </button>
  )
}

interface EvolucaoPainelGruposProps {
  grupos: EvolucaoGrupoObra[]
  emptyMessage?: string
  emptySubmessage?: string
  obrasById?: Map<string, ObraFull>
  showMontadoresConclusao?: boolean
}

export function EvolucaoPainelGrupos({
  grupos,
  emptyMessage = 'Nenhuma foto registrada no período',
  emptySubmessage = 'Os montadores ainda não enviaram atualizações.',
  obrasById,
  showMontadoresConclusao = false,
}: EvolucaoPainelGruposProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const openFoto = (foto: EvolucaoPainelItemComUrl) => {
    const pages = evolucaoLightboxPages(foto)
    if (!pages.length) return
    setLightbox({
      url: pages[0],
      pages,
      nome: foto.nome_arquivo,
      kind: foto.kind,
      observacao: foto.observacao,
    })
  }

  if (grupos.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center py-10 text-[#d4bc9f]">
        <Camera size={36} className="mb-3 opacity-25" />
        <p className="text-sm font-semibold text-[#edd9c4]">{emptyMessage}</p>
        {emptySubmessage ? <p className="mt-1 text-xs">{emptySubmessage}</p> : null}
      </div>
    )
  }

  return (
    <>
      <div className="w-full space-y-3">
        {grupos.map(grupo => (
          <div key={grupo.obra_id} className="viz-acomp-card glass-card border-[rgba(240,210,140,0.12)] p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-full bg-[#f2d892]/10 p-1.5 text-[#f2d892]">
                <HardHat size={16} />
              </div>
              <h3 className="min-w-0 truncate font-display text-sm font-bold leading-tight text-cream sm:text-base">
                {grupo.obra_nome}
              </h3>
            </div>

            {showMontadoresConclusao && obrasById?.get(grupo.obra_id) && (
              <div className="mb-3">
                <ObraMontadoresConclusao
                  obra={obrasById.get(grupo.obra_id)!}
                  compact
                  visible
                />
              </div>
            )}

            <div className="space-y-3">
              {grupo.dias.map(dia => (
                <div key={dia.data} className="relative border-l border-[rgba(240,210,140,0.2)] pl-4">
                  <div className="absolute -left-[4px] top-0 h-[7px] w-[7px] rounded-full bg-[#f2d892]" />

                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Calendar size={10} className="text-[#f2d892]" />
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-[#f2d892]">
                      {fmtDate(dia.data)}
                    </span>
                    <span className="text-[0.6rem] text-[#edd9c4]">
                      · {dia.fotos.length} {dia.fotos.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {dia.fotos.map(foto => (
                      foto.kind === 'text' ? (
                        <div
                          key={foto.id}
                          className="min-w-[12rem] max-w-full flex-1 rounded-md border border-[rgba(240,210,140,0.18)] bg-black/25 p-2.5"
                        >
                          <div className="mb-1.5 flex items-center gap-1.5 text-[#f2d892]">
                            <MessageSquareText size={12} />
                            <span className="text-[0.62rem] font-semibold uppercase tracking-wide">Observação</span>
                            <span className="text-[0.58rem] text-[#edd9c4]">{fmtTime(foto.tirado_em)}</span>
                          </div>
                          {foto.observacao?.trim() ? (
                            <EvolucaoObservacao texto={foto.observacao.trim()} />
                          ) : null}
                        </div>
                      ) : (
                      <div
                        key={foto.id}
                        className="flex w-[7.5rem] shrink-0 flex-col gap-1 sm:w-[8.25rem]"
                      >
                        <EvolucaoThumb foto={foto} onOpen={() => openFoto(foto)} />
                        {foto.observacao?.trim() ? (
                          <EvolucaoObservacao texto={foto.observacao.trim()} />
                        ) : null}
                      </div>
                      )
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightbox ? (
        <AnexoLightbox
          open
          imageUrl={lightbox.url}
          pages={lightbox.pages}
          title={lightbox.nome}
          description={lightbox.observacao}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </>
  )
}
