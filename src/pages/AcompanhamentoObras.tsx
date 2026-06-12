import { useMemo, useState } from 'react'
import { Camera, Calendar, HardHat, Maximize2 } from 'lucide-react'
import { useEvolucaoPainel, type FiltroPeriodo } from '@/hooks/useObraEvolucao'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { fmtDate } from '@/lib/utils'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import { evolucaoThumbUrl } from '@/lib/obra-evolucao'
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
  nome: string
  kind: 'image' | 'pdf' | 'video'
}

function EvolucaoThumb({
  foto,
  onOpen,
  compact = false,
}: {
  foto: EvolucaoPainelItemComUrl
  onOpen: () => void
  compact?: boolean
}) {
  const thumbUrl = evolucaoThumbUrl(foto)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-lg border border-[rgba(212,168,83,0.15)] bg-black/40 text-left ${
        compact ? 'h-[88px] w-[88px] shrink-0' : 'aspect-square w-full'
      }`}
      aria-label={`Ver foto de ${foto.obra_nome}`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={foto.nome_arquivo}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#8a6a55]">
          <Camera size={20} />
        </div>
      )}

      {foto.kind === 'video' && (
        <span className="absolute left-1 top-1 rounded bg-[rgba(59,130,246,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-white">
          VÍD
        </span>
      )}
      {foto.kind === 'pdf' && (
        <span className="absolute left-1 top-1 rounded bg-[rgba(212,168,83,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-[#150c09]">
          PDF
        </span>
      )}

      {compact && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 pb-1.5 pt-6">
          <p className="truncate text-[0.58rem] font-semibold text-white/95">{foto.obra_nome}</p>
          <p className="text-[0.5rem] text-white/70">
            {new Date(foto.tirado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
        <Maximize2 size={16} className="text-white" />
      </div>
    </button>
  )
}

function AcompanhamentoObrasContent() {
  const [filtro, setFiltro] = useState<FiltroPeriodo>('hoje')
  const { grupos, loading, error } = useEvolucaoPainel(filtro)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const todasFotos = useMemo(
    () =>
      grupos
        .flatMap(grupo => grupo.dias.flatMap(dia => dia.fotos))
        .sort((a, b) => b.tirado_em.localeCompare(a.tirado_em)),
    [grupos],
  )

  const filtroLabel =
    filtro === 'hoje' ? 'Hoje' : filtro === 'semana' ? 'Esta Semana' : 'Este Mês'

  const openFoto = (foto: EvolucaoPainelItemComUrl) => {
    const url = foto.signedUrl ?? evolucaoThumbUrl(foto) ?? ''
    if (!url) return
    setLightbox({ url, nome: foto.nome_arquivo, kind: foto.kind })
  }

  return (
    <div className="obra-page-shell fade-in flex flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
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
          showScrollArrows
          horizontalScrollbar
          verticalScrollbar
          contentLayout="kanban"
          contentSignal={`${filtro}-${grupos.length}-${todasFotos.length}`}
          className="min-h-0 flex-1"
        >
          {grupos.length === 0 ? (
            <div className="flex min-w-full w-full flex-col items-center justify-center py-20 text-[#6b5544]">
              <Camera size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-display">Nenhuma foto registrada no período</p>
              <p className="text-sm">Os montadores ainda não enviaram atualizações.</p>
            </div>
          ) : (
            <div className="w-max min-w-full space-y-8 pr-2">
              <section className="glass-card border-[rgba(212,168,83,0.12)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[#d4a853]">
                      Visão rápida — {filtroLabel}
                    </h2>
                    <p className="text-xs text-[#8a6a55]">
                      {todasFotos.length} {todasFotos.length === 1 ? 'foto' : 'fotos'} de {grupos.length}{' '}
                      {grupos.length === 1 ? 'obra' : 'obras'}
                    </p>
                  </div>
                </div>

                <div className="obra-scroll-x-mobile -mx-1 flex gap-2 px-1 pb-1">
                  {todasFotos.map(foto => (
                    <EvolucaoThumb
                      key={`rapida-${foto.id}`}
                      foto={foto}
                      compact
                      onOpen={() => openFoto(foto)}
                    />
                  ))}
                </div>
              </section>

              {grupos.map((grupo) => (
                <div key={grupo.obra_id} className="glass-card border-[rgba(212,168,83,0.12)] p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-full bg-[#d4a853]/10 p-2 text-[#d4a853]">
                      <HardHat size={20} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold leading-tight text-cream">
                        {grupo.obra_nome}
                      </h3>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[#8a6a55]">
                        Obra em andamento
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {grupo.dias.map((dia) => (
                      <div key={dia.data} className="relative border-l border-[rgba(212,168,83,0.2)] pl-6">
                        <div className="absolute -left-[5px] top-0 h-[9px] w-[9px] rounded-full bg-[#d4a853] shadow-[0_0_8px_rgba(212,168,83,0.5)]" />

                        <div className="mb-3 flex items-center gap-2">
                          <Calendar size={12} className="text-[#d4a853]" />
                          <span className="text-xs font-bold uppercase tracking-wider text-[#d4a853]">
                            {fmtDate(dia.data)}
                          </span>
                          <span className="text-[0.65rem] text-[#8a6a55]">
                            ({dia.fotos.length} {dia.fotos.length === 1 ? 'foto' : 'fotos'})
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {dia.fotos.map((foto) => (
                            <div key={foto.id} className="flex flex-col gap-2">
                              <EvolucaoThumb foto={foto} onOpen={() => openFoto(foto)} />

                              {foto.observacao?.trim() && (
                                <p className="rounded-lg border border-[rgba(212,168,83,0.12)] bg-black/25 px-2.5 py-2 text-xs leading-relaxed text-[#e8d5c0]">
                                  {foto.observacao}
                                </p>
                              )}

                              <p className="truncate text-center text-[0.6rem] text-[#8a6a55]">
                                {foto.criador_nome?.split(' ')[0] || 'Sistema'}
                                {' · '}
                                {new Date(foto.tirado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
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
          title={lightbox.nome}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
