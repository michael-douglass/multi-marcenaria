import { useMetricasObras } from '../hooks/useMetricasObras'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/EmptyState'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '../components/page-zoom'

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

function fmtH(h: number | null): string {
  if (h == null) return '—'
  return `${Number(h).toFixed(1)}h`
}

export function MetricasObras() {
  return (
    <PageZoomProvider pageKey="metricas_obras">
      <MetricasObrasContent />
    </PageZoomProvider>
  )
}

function MetricasObrasContent() {
  const { data, loading, error, reload } = useMetricasObras()

  const totalObras = data.reduce((acc, m) => acc + Number(m.total_obras), 0)
  const totalConcluidas = data.reduce((acc, m) => acc + Number(m.obras_concluidas), 0)
  const totalAtraso = data.reduce((acc, m) => acc + Number(m.obras_em_atraso), 0)

  return (
    <div className="obra-page-shell fade-in flex flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      <KanbanPageToolbar>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>Métricas de Obras</h1>
            <p className="section-label mt-1">Tempo médio de execução por tipo de obra</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <KanbanPageZoomControls />
            <button type="button" className="btn btn-outline btn-md" onClick={() => reload()}>
              Atualizar
            </button>
          </div>
        </div>
      </KanbanPageToolbar>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <KanbanPageZoomShell
          showScrollArrows={false}
          horizontalScrollbar={false}
          verticalScrollbar
          contentLayout="fluid"
          contentSignal={data.length}
          className="min-h-0 flex-1"
        >
          <>
          {/* Resumo geral */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total de Obras', value: totalObras, color: '#d4a853' },
              { label: 'Obras Concluídas', value: `${totalConcluidas} (${pct(totalConcluidas, totalObras)})`, color: '#10b981' },
              { label: 'Concluídas em Atraso', value: `${totalAtraso}`, color: '#ef4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-[#8a6a55] mb-1">{label}</p>
                <p className="text-3xl font-bold font-display" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tabela por tipo */}
          {data.length === 0 ? (
            <EmptyState message="Nenhum tipo de obra cadastrado ainda." />
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(212,168,83,0.12)]">
                    {['Tipo de Obra', 'Total', 'Concluídas', 'Em Atraso', 'Tempo Médio Real', 'Prazo Máx. Padrão', '% Conclusão'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#8a6a55]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((m, i) => {
                    const total = Number(m.total_obras)
                    const concluidas = Number(m.obras_concluidas)
                    const atraso = Number(m.obras_em_atraso)
                    const onTimeRate = concluidas > 0 ? ((concluidas - atraso) / concluidas) * 100 : null

                    return (
                      <tr key={m.tipo_obra_id} className={`border-b border-[rgba(212,168,83,0.06)] ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-cream">{m.tipo_obra_nome}</td>
                        <td className="px-4 py-3 text-[#8a6a55]">{total}</td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400">{concluidas}</span>
                          <span className="text-[#6b5544] ml-1">({pct(concluidas, total)})</span>
                        </td>
                        <td className="px-4 py-3">
                          {atraso > 0
                            ? <span className="text-red-400 font-semibold">{atraso}</span>
                            : <span className="text-[#8a6a55]">0</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-cream font-mono">{fmtH(m.tempo_medio_real_horas)}</td>
                        <td className="px-4 py-3 text-[#8a6a55] font-mono">{fmtH(m.tempo_maximo_horas_default)}</td>
                        <td className="px-4 py-3">
                          {onTimeRate != null ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)]">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.min(100, onTimeRate)}%`, backgroundColor: onTimeRate >= 80 ? '#10b981' : onTimeRate >= 50 ? '#f59e0b' : '#ef4444' }}
                                />
                              </div>
                              <span className="text-xs text-[#8a6a55] w-10 text-right">{Math.round(onTimeRate)}%</span>
                            </div>
                          ) : (
                            <span className="text-[#6b5544]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          </>
        </KanbanPageZoomShell>
      )}
    </div>
  )
}
