import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMetricasObras } from '../hooks/useMetricasObras'
import { fmtDuracaoHoras, labelMesAno } from '../lib/obra-metricas'
import { addMonths, fmtCur } from '../lib/utils'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/EmptyState'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '../components/page-zoom'
import type { StatusKanbanObra } from '../types'

const STATUS_LABEL: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

function fmtH(h: number | null | undefined): string {
  if (h == null) return '—'
  return `${Number(h).toFixed(2).replace('.', ',')} h`
}

function fmtDateTime(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MetricasObras() {
  return (
    <PageZoomProvider pageKey="metricas_obras">
      <MetricasObrasContent />
    </PageZoomProvider>
  )
}

function MetricasObrasContent() {
  const hoje = new Date()
  const [periodo, setPeriodo] = useState({
    mes: hoje.getMonth() + 1,
    ano: hoje.getFullYear(),
  })

  const { data, resumo, porObra, loading, error, reload } = useMetricasObras(periodo)
  const periodoLabel = labelMesAno(periodo.mes, periodo.ano, MESES)
  const isMesAtual = periodo.mes === hoje.getMonth() + 1 && periodo.ano === hoje.getFullYear()

  const opcoesMesAno = useMemo(() => {
    const base = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const lista: { mes: number; ano: number; label: string }[] = []
    for (let i = -24; i <= 24; i++) {
      const iso = addMonths(base, i)
      const [ano, mes] = iso.split('-').map(Number)
      lista.push({ mes, ano, label: labelMesAno(mes, ano, MESES) })
    }
    return lista
  }, [hoje])

  const navegarMes = (dir: -1 | 1) => {
    const iso = `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-01`
    const next = addMonths(iso, dir)
    const [ano, mes] = next.split('-').map(Number)
    setPeriodo({ mes, ano })
  }

  const totalObras = data.reduce((acc, m) => acc + Number(m.total_obras), 0)
  const totalConcluidas = data.reduce((acc, m) => acc + Number(m.obras_concluidas), 0)
  const totalAtraso = data.reduce((acc, m) => acc + Number(m.obras_em_atraso), 0)
  return (
    <div className="obra-page-shell fade-in flex flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      <KanbanPageToolbar>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>
              Métricas de Obras
            </h1>
            <p className="section-label mt-1">
              Tempo de execução, histórico por obra e comissões
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-[rgba(212,168,83,0.25)] bg-[rgba(10,4,2,0.5)] px-1 py-1">
              <button
                type="button"
                onClick={() => navegarMes(-1)}
                className="rounded p-1.5 text-[#8a6a55] hover:bg-[rgba(212,168,83,0.1)] hover:text-[#d4a853]"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                className="glass-input !h-8 !min-w-[9rem] !border-0 !bg-transparent !text-xs font-semibold text-[#d4a853]"
                value={`${periodo.ano}-${periodo.mes}`}
                onChange={e => {
                  const [ano, mes] = e.target.value.split('-').map(Number)
                  setPeriodo({ mes, ano })
                }}
              >
                {opcoesMesAno.map(o => (
                  <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => navegarMes(1)}
                className="rounded p-1.5 text-[#8a6a55] hover:bg-[rgba(212,168,83,0.1)] hover:text-[#d4a853]"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isMesAtual && (
                <button
                  type="button"
                  onClick={() => setPeriodo({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() })}
                  className="ml-1 rounded px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[#d4a853] hover:bg-[rgba(212,168,83,0.12)]"
                >
                  Hoje
                </button>
              )}
            </div>
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
          contentSignal={`${periodo.mes}-${periodo.ano}-${data.length}-${porObra.length}`}
          className="min-h-0 flex-1"
        >
          <>
          {/* Comissões do mês */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="glass-card p-5 border border-emerald-500/20">
              <p className="text-xs uppercase tracking-wider text-[#8a6a55] mb-1">
                Comissão a pagar em {periodoLabel}
              </p>
              <p className="text-3xl font-bold font-display text-emerald-400">
                {fmtCur(resumo.comissao_a_pagar_mes)}
              </p>
              <p className="mt-2 text-xs text-[#8a6a55]">
                Obras já concluídas neste mês com comissão configurada
                {resumo.obras_concluidas_mes > 0 && (
                  <span className="text-emerald-400/80"> · {resumo.obras_concluidas_mes} obra(s)</span>
                )}
              </p>
            </div>

            <div className="glass-card p-5 border border-amber-500/20">
              <p className="text-xs uppercase tracking-wider text-[#8a6a55] mb-1">
                Comissão em aberto em {periodoLabel}
              </p>
              <p className="text-3xl font-bold font-display text-amber-400">
                {fmtCur(resumo.comissao_em_aberto)}
              </p>
              <p className="mt-2 text-xs text-[#8a6a55]">
                Obras previstas para {periodoLabel}, ainda não concluídas, com comissão definida
                {resumo.obras_abertas_comissao > 0 && (
                  <span className="text-amber-400/80"> · {resumo.obras_abertas_comissao} obra(s)</span>
                )}
              </p>
            </div>
          </div>

          {/* Resumo geral */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total de Obras', value: totalObras, color: '#d4a853' },
              { label: 'Obras Concluídas', value: `${totalConcluidas} (${pct(totalConcluidas, totalObras)})`, color: '#10b981' },
              { label: 'Concluídas em Atraso', value: `${totalAtraso}`, color: '#ef4444' },
              {
                label: `Comissões Geradas em ${periodoLabel}`,
                value: fmtCur(resumo.comissoes_geradas_mes),
                color: '#d4a853',
                hint: 'Lançamentos em Contas a Pagar',
              },
            ].map(({ label, value, color, hint }) => (
              <div key={label} className="glass-card p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-[#8a6a55] mb-1">{label}</p>
                <p className="text-3xl font-bold font-display" style={{ color }}>{value}</p>
                {hint && <p className="mt-1 text-[0.65rem] text-[#6b5544]">{hint}</p>}
              </div>
            ))}
          </div>

          {/* Tabela por tipo */}
          {data.length === 0 ? (
            <EmptyState message="Nenhum tipo de obra cadastrado ainda." />
          ) : (
            <div className="glass-card overflow-hidden mb-8">
              <div className="px-4 py-3 border-b border-[rgba(212,168,83,0.12)]">
                <h2 className="text-sm font-semibold text-[#d4a853] uppercase tracking-wider">
                  Tempo por tipo de obra — {periodoLabel}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b border-[rgba(212,168,83,0.12)]">
                      {[
                        'Tipo de Obra', 'Total', 'Concluídas', 'Em Atraso', 'Comissões',
                        'Tempo Médio', 'Tempo Total', 'Prazo Máx.', '% Conclusão',
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#8a6a55]">
                          {h}
                        </th>
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
                        <tr
                          key={m.tipo_obra_id}
                          className={`border-b border-[rgba(212,168,83,0.06)] ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}
                        >
                          <td className="px-4 py-3 font-semibold text-cream">{m.tipo_obra_nome}</td>
                          <td className="px-4 py-3 text-[#8a6a55]">{total}</td>
                          <td className="px-4 py-3">
                            <span className="text-emerald-400">{concluidas}</span>
                            <span className="text-[#6b5544] ml-1">({pct(concluidas, total)})</span>
                          </td>
                          <td className="px-4 py-3">
                            {atraso > 0
                              ? <span className="text-red-400 font-semibold">{atraso}</span>
                              : <span className="text-[#8a6a55]">0</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#d4a853]">
                            {fmtCur(Number(m.total_comissoes ?? 0))}
                          </td>
                          <td className="px-4 py-3 text-cream font-mono">{fmtH(m.tempo_medio_real_horas)}</td>
                          <td className="px-4 py-3 text-cream font-mono">{fmtH(m.tempo_total_real_horas)}</td>
                          <td className="px-4 py-3 text-[#8a6a55] font-mono">{fmtH(m.tempo_maximo_horas_default)}</td>
                          <td className="px-4 py-3">
                            {onTimeRate != null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)]">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, onTimeRate)}%`,
                                      backgroundColor: onTimeRate >= 80 ? '#10b981' : onTimeRate >= 50 ? '#f59e0b' : '#ef4444',
                                    }}
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
            </div>
          )}

          {/* Histórico por obra */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(212,168,83,0.12)]">
              <h2 className="text-sm font-semibold text-[#d4a853] uppercase tracking-wider">
                Histórico por obra
              </h2>
              <p className="text-xs text-[#8a6a55] mt-1">
                Obras de {periodoLabel} — início, fim e duração registrada em horas
              </p>
            </div>

            {porObra.length === 0 ? (
              <div className="p-8">
                <EmptyState message="Nenhuma obra registrada ainda." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-[rgba(212,168,83,0.12)]">
                      {[
                        'Cliente', 'Tipo', 'Status', 'Mês ref.', 'Início', 'Fim', 'Duração (horas)', 'Comissão',
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#8a6a55]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porObra.map((o, i) => (
                      <tr
                        key={o.obra_id}
                        className={`border-b border-[rgba(212,168,83,0.06)] ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}
                      >
                        <td className="px-4 py-3 font-semibold text-cream">{o.cliente_nome}</td>
                        <td className="px-4 py-3 text-[#8a6a55]">{o.tipo_obra_nome ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-[#d4a853]">
                            {STATUS_LABEL[o.status_kanban as StatusKanbanObra] ?? o.status_kanban}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#8a6a55] text-xs">
                          {o.mes_referencia
                            ? labelMesAno(
                                Number(o.mes_referencia.slice(5, 7)),
                                Number(o.mes_referencia.slice(0, 4)),
                                MESES,
                              )
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-cream font-mono text-xs">{fmtDateTime(o.iniciado_em)}</td>
                        <td className="px-4 py-3 text-cream font-mono text-xs">{fmtDateTime(o.finalizado_em)}</td>
                        <td className="px-4 py-3 text-cream text-xs">
                          {fmtDuracaoHoras(o.duracao_horas, o.duracao_em_andamento)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[#d4a853]">
                          {o.comissao_habilitada ? fmtCur(Number(o.comissao_valor)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
        </KanbanPageZoomShell>
      )}
    </div>
  )
}
