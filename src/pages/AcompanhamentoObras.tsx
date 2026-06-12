import { useState } from 'react'
import { Camera, Calendar, HardHat, Loader2, Maximize2, X } from 'lucide-react'
import { useEvolucaoPainel, type FiltroPeriodo } from '@/hooks/useObraEvolucao'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { fmtDate } from '@/lib/utils'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
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

function AcompanhamentoObrasContent() {
  const [filtro, setFiltro] = useState<FiltroPeriodo>('hoje')
  const { grupos, loading, error } = useEvolucaoPainel(filtro)
  const [lightbox, setLightbox] = useState<{ url: string; nome: string; kind: 'image' | 'pdf' | 'video' } | null>(null)

  return (
    <div className="obra-page-shell fade-in flex flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      <KanbanPageToolbar>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>
              Acompanhamento de Obras
            </h1>
            <p className="section-label mt-1">
              Visualização diária da evolução das montagens
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <KanbanPageZoomControls />
            <div className="flex bg-[#1a1412] p-1 rounded-lg border border-[rgba(212,168,83,0.15)]">
            {(['hoje', 'semana', 'mes'] as FiltroPeriodo[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
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
          contentSignal={`${filtro}-${grupos.length}`}
          className="min-h-0 flex-1"
        >
          {grupos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#6b5544] w-full min-w-full">
              <Camera size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-display">Nenhuma foto registrada no período</p>
              <p className="text-sm">Os montadores ainda não enviaram atualizações.</p>
            </div>
          ) : (
          <div className="space-y-8 pr-2 w-max min-w-full">
          {grupos.map((grupo) => (
            <div key={grupo.obra_id} className="glass-card p-5 border-[rgba(212,168,83,0.12)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-[#d4a853]/10 text-[#d4a853]">
                  <HardHat size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cream font-display leading-tight">
                    {grupo.obra_nome}
                  </h3>
                  <p className="text-[0.7rem] text-[#8a6a55] uppercase tracking-widest font-semibold">
                    Obra em andamento
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {grupo.dias.map((dia) => (
                  <div key={dia.data} className="relative pl-6 border-l border-[rgba(212,168,83,0.2)]">
                    <div className="absolute -left-[5px] top-0 w-[9px] h-[9px] rounded-full bg-[#d4a853] shadow-[0_0_8px_rgba(212,168,83,0.5)]" />
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={12} className="text-[#d4a853]" />
                      <span className="text-xs font-bold text-[#d4a853] uppercase tracking-wider">
                        {fmtDate(dia.data)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {dia.fotos.map((foto) => (
                        <div key={foto.id} className="flex flex-col gap-2">
                          <div
                            className="group relative aspect-square rounded-lg overflow-hidden border border-[rgba(212,168,83,0.15)] bg-black/40 cursor-pointer"
                            onClick={() => setLightbox({ url: foto.signedUrl ?? '', nome: foto.nome_arquivo, kind: foto.kind })}
                          >
                            {foto.previewSignedUrl ? (
                              <img
                                src={foto.previewSignedUrl}
                                alt={foto.nome_arquivo}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#8a6a55]">
                                <Camera size={20} />
                              </div>
                            )}
                            {foto.kind === 'video' && (
                              <span className="absolute left-1 top-1 rounded bg-[rgba(59,130,246,0.9)] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-white">
                                VÍD
                              </span>
                            )}

                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                              <Maximize2 size={16} className="text-white mb-1" />
                              <span className="text-[0.6rem] text-white/80 leading-tight">
                                {foto.criador_nome?.split(' ')[0] || 'Sistema'}
                              </span>
                              <span className="text-[0.5rem] text-white/60">
                                {new Date(foto.tirado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {foto.observacao?.trim() && (
                            <p className="rounded-lg border border-[rgba(212,168,83,0.12)] bg-black/25 px-2.5 py-2 text-xs leading-relaxed text-[#e8d5c0]">
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
          title={lightbox.nome}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
