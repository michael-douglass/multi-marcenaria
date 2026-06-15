import { useState } from 'react'
import { Camera, Calendar, HardHat, Maximize2 } from 'lucide-react'
import { useEvolucaoPainel, type FiltroPeriodo } from '@/hooks/useObraEvolucao'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { fmtDate, fmtTime } from '@/lib/utils'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import { evolucaoThumbUrl, evolucaoLightboxPages } from '@/lib/obra-evolucao'
import type { EvolucaoPainelItemComUrl } from '@/lib/obra-evolucao'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '@/components/page-zoom'

export function AcompanhamentoObras() {
  return (
    <PageZoomProvider pageKey="acompanhamento_obras">
      <AcompanhamentoObrasContent />
    </PageZoomProvider>
  )
}

type LightboxState = {
  url: string
  pages?: string[]
  nome: string
  kind: 'image' | 'pdf' | 'video'
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
      className="group relative h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-md border border-[rgba(212,168,83,0.15)] bg-black/40 sm:h-[8.25rem] sm:w-[8.25rem]"
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
        <div className="flex h-full w-full items-center justify-center text-[#8a6a55]">
          <Camera size={14} />
        </div>
      )}

      {foto.kind === 'video' && (
        <span className="absolute left-0.5 top-0.5 rounded bg-[rgba(59,130,246,0.9)] px-0.5 text-[0.45rem] font-bold uppercase text-white">
          VÍD
        </span>
      )}
      {foto.kind === 'pdf' && (
        <span className="absolute left-0.5 top-0.5 rounded bg-[rgba(212,168,83,0.9)] px-0.5 text-[0.45rem] font-bold uppercase text-[#150c09]">
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

function AcompanhamentoObrasContent() {
  const [filtro, setFiltro] = useState<FiltroPeriodo>('hoje')
  const { grupos, loading, error } = useEvolucaoPainel(filtro)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const openFoto = (foto: EvolucaoPainelItemComUrl) => {
    const pages = evolucaoLightboxPages(foto)
    if (!pages.length) return
    setLightbox({ url: pages[0], pages, nome: foto.nome_arquivo, kind: foto.kind })
  }

  const totalFotos = grupos.reduce(
    (acc, g) => acc + g.dias.reduce((d, dia) => d + dia.fotos.length, 0),
    0,
  )

  return (
    <div className="obra-page-shell obra-page-shell--acompanhamento fade-in flex flex-none flex-col overflow-visible">
      <KanbanPageToolbar>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>
              Acompanhamento de Obras
            </h1>
            <p className="section-label mt-1">
              Visualização diária da evolução das montagens
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <KanbanPageZoomControls />
            <div className="flex rounded-lg border border-[rgba(212,168,83,0.15)] bg-[#1a1412] p-1">
              {(['hoje', 'semana', 'mes'] as FiltroPeriodo[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    filtro === f
                      ? 'bg-[#d4a853] text-[#1a1412] shadow-lg'
                      : 'text-[#8a6a55] hover:text-[#d4a853]'
                  }`}
                >
                  {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Esta Semana' : 'Este Mês'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </KanbanPageToolbar>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <KanbanPageZoomShell
          showScrollArrows={false}
          showFloatingScrollbar={false}
          horizontalScrollbar={false}
          verticalScrollbar={false}
          contentLayout="fluid"
          contentSignal={`${filtro}-${grupos.length}-${totalFotos}`}
          className="flex-none"
        >
          {grupos.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center py-20 text-[#6b5544]">
              <Camera size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-display">Nenhuma foto registrada no período</p>
              <p className="text-sm">Os montadores ainda não enviaram atualizações.</p>
            </div>
          ) : (
            <div className="w-full space-y-4 pb-8 pr-1">
              {grupos.map((grupo) => (
                <div key={grupo.obra_id} className="glass-card border-[rgba(212,168,83,0.12)] p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-full bg-[#d4a853]/10 p-1.5 text-[#d4a853]">
                      <HardHat size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-bold leading-tight text-cream sm:text-base">
                        {grupo.obra_nome}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {grupo.dias.map((dia) => (
                      <div key={dia.data} className="relative border-l border-[rgba(212,168,83,0.2)] pl-4">
                        <div className="absolute -left-[4px] top-0 h-[7px] w-[7px] rounded-full bg-[#d4a853]" />

                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Calendar size={10} className="text-[#d4a853]" />
                          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-[#d4a853]">
                            {fmtDate(dia.data)}
                          </span>
                          <span className="text-[0.6rem] text-[#8a6a55]">
                            · {dia.fotos.length} {dia.fotos.length === 1 ? 'foto' : 'fotos'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {dia.fotos.map((foto) => (
                            <div key={foto.id} className="flex flex-col gap-0.5">
                              <EvolucaoThumb foto={foto} onOpen={() => openFoto(foto)} />

                              {foto.observacao?.trim() && (
                                <p
                                  className="max-w-[7.5rem] truncate text-[0.5rem] leading-tight text-[#c4a882] sm:max-w-[8.25rem]"
                                  title={foto.observacao}
                                >
                                  {foto.observacao}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </KanbanPageZoomShell>
      )}

      {lightbox && (
        <AnexoLightbox
          open
          imageUrl={lightbox.url}
          pages={lightbox.pages}
          title={lightbox.nome}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
