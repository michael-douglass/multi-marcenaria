import { useMemo, useState } from 'react'
import { useEvolucaoPainel, type FiltroPeriodo } from '@/hooks/useObraEvolucao'
import { useObras } from '@/hooks/useObras'
import { useApp } from '@/context/AppContext'
import { canViewMontadoresConclusaoObra } from '@/lib/obra-permissions'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { EvolucaoPainelGrupos } from '@/components/obras/EvolucaoPainelGrupos'
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
  const { roles } = useApp()
  const obrasHook = useObras()
  const [filtro, setFiltro] = useState<FiltroPeriodo>('hoje')
  const { grupos, loading, error } = useEvolucaoPainel(filtro)
  const canViewMontadoresConclusao = canViewMontadoresConclusaoObra(roles)

  const obrasById = useMemo(
    () => new Map(obrasHook.data.map(obra => [obra.id, obra])),
    [obrasHook.data],
  )

  const totalFotos = grupos.reduce(
    (acc, g) => acc + g.dias.reduce((d, dia) => d + dia.fotos.length, 0),
    0,
  )

  return (
    <div className="obra-page-shell obra-page-shell--acompanhamento fade-in flex flex-none flex-col overflow-visible">
      <KanbanPageToolbar>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>
              Acompanhamento de Obras
            </h1>
            <p className="section-label mt-1">
              Visualização diária da evolução das montagens
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <KanbanPageZoomControls />
            <div className="flex rounded-lg border border-[rgba(240,210,140,0.15)] bg-[#1a1412] p-1">
              {(['hoje', 'semana', 'mes'] as FiltroPeriodo[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    filtro === f
                      ? 'bg-[#f2d892] text-[#1a1412] shadow-lg'
                      : 'text-[#edd9c4] hover:text-[#f2d892]'
                  }`}
                >
                  {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Esta Semana' : 'Este Mês'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </KanbanPageToolbar>

      {loading && grupos.length === 0 && <LoadingState />}
      {(!loading || grupos.length > 0) && error && <ErrorState message={error} />}

      {(!loading || grupos.length > 0) && !error && (
        <KanbanPageZoomShell
          showScrollArrows={false}
          showFloatingScrollbar={false}
          horizontalScrollbar={false}
          verticalScrollbar={false}
          contentLayout="fluid"
          contentSignal={`${filtro}-${grupos.length}-${totalFotos}-${obrasHook.data.length}`}
          className="flex-none"
        >
          <div className="w-full pb-8 pr-1">
            <EvolucaoPainelGrupos
              grupos={grupos}
              obrasById={obrasById}
              showMontadoresConclusao={canViewMontadoresConclusao}
            />
          </div>
        </KanbanPageZoomShell>
      )}
    </div>
  )
}
