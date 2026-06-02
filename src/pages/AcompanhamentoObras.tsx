import { useState } from 'react'
import { Camera, Calendar, HardHat, Loader2, Maximize2, X } from 'lucide-react'
import { useEvolucaoPainel, type FiltroPeriodo } from '@/hooks/useObraEvolucao'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { fmtDate } from '@/lib/utils'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
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
  const [lightbox, setLightbox] = useState<{ url: string; nome: string } | null>(null)

  return (
    <div className="fade-in flex min-h-[calc(100dvh-11rem)] flex-col">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>
            Acompanhamento de Obras
          </h1>
          <p className="section-label mt-1">
            Visualização diária da evolução das montagens
          </p>
        </div>

        {/* Filtros + zoom */}
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

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <KanbanPageZoomShell
          showScrollArrows
          horizontalScrollbar
          verticalScrollbar
          contentSignal={`${filtro}-${grupos.length}`}
          className="min-h-[420px] flex-1"
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                      {dia.fotos.map((foto) => (
                        <div
                          key={foto.id}
                          className="group relative aspect-square rounded-lg overflow-hidden border border-[rgba(212,168,83,0.15)] bg-black/40 cursor-pointer"
                          onClick={() => setLightbox({ url: foto.signedUrl ?? '', nome: foto.nome_arquivo })}
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
                          
                          {/* Overlay */}
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
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
