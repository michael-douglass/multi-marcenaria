import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MetricasMontadorComissaoModal } from '../components/metricas/MetricasMontadorComissaoModal'
import { MetricasMontadorTempoChart } from '../components/metricas/MetricasMontadorTempoChart'
import { FixoMontadorSection } from '../components/metricas/FixoMontadorSection'
import { ObraMontadoresConclusao } from '../components/obras/ObraMontadoresConclusao'
import { useMetricasObras } from '../hooks/useMetricasObras'
import { useObras } from '../hooks/useObras'
import { useApp } from '../context/AppContext'
import { getObraMontadoresConclusao } from '../lib/obra-montadores'
import { canViewMontadoresConclusaoObra, canEditFixoMontador, canEditComissao } from '../lib/obra-permissions'
import { fmtDuracaoHoras, labelMesAno } from '../lib/obra-metricas'
import { addMonths, fmtCur } from '../lib/utils'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/EmptyState'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '../components/page-zoom'
import type { MetricaObraMontador, StatusKanbanObra } from '../types'
import type { ObraMontadorConclusaoStatus } from '../lib/obra-montadores'

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
    second: '2-digit',
    hour12: false,
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
  const { roles } = useApp()
  const obrasHook = useObras()
  const hoje = new Date()
  const [periodo, setPeriodo] = useState({
    mes: hoje.getMonth() + 1,
    ano: hoje.getFullYear(),
  })
  const [montadorComissao, setMontadorComissao] = useState<MetricaObraMontador | null>(null)

  const { data, resumo, porObra, porMontador, loading, error, reload } = useMetricasObras(periodo)
  const periodoLabel = labelMesAno(periodo.mes, periodo.ano, MESES)
  const isMesAtual = periodo.mes === hoje.getMonth() + 1 && periodo.ano === hoje.getFullYear()
  const isMontadorAdmin = roles.includes('MontadorAdmin')
  const canViewMontadoresConclusao = canViewMontadoresConclusaoObra(roles)
  const canEditFixo = canEditFixoMontador(roles)
  const canManageComissao = canEditComissao(roles)

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

  const conclusaoPorObra = useMemo(() => {
    const map = new Map<string, {
      cliente_nome: string
      status_kanban: string
      montadores: ObraMontadorConclusaoStatus[]
    }>()

    for (const row of porObra) {
      const atual = map.get(row.obra_id) ?? {
        cliente_nome: row.cliente_nome,
        status_kanban: row.status_kanban,
        montadores: [] as ObraMontadorConclusaoStatus[],
      }

      atual.montadores.push({
        montador_id: row.montador_id,
        nome: row.montador_nome ?? 'Montador',
        concluiu: !!row.finalizado_em,
        finalizado_em: row.finalizado_em,
      })

      map.set(row.obra_id, atual)
    }

    return [...map.entries()]
      .map(([obra_id, item]) => ({ obra_id, ...item }))
      .filter(item =>
        item.montadores.length > 1
        || item.montadores.some(m => m.concluiu && item.montadores.some(x => !x.concluiu)),
      )
  }, [porObra])

  const obrasConclusaoGestao = useMemo(() => {
    if (!canViewMontadoresConclusao || !isMontadorAdmin) return []

    return obrasHook.data.filter(obra => {
      if (obra.status_kanban === 'cancelada') return false
      return getObraMontadoresConclusao(obra).length > 0
    })
  }, [obrasHook.data, canViewMontadoresConclusao, isMontadorAdmin])

  return (
    <div className="obra-page-shell fade-in flex flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      <KanbanPageToolbar>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>
              Métricas de Obras
            </h1>
            <p className="section-label mt-1">
              Tempo de execução, histórico por obra e comissões
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-[rgba(240,210,140,0.25)] bg-[rgba(10,4,2,0.5)] px-1 py-1">
              <button
                type="button"
                onClick={() => navegarMes(-1)}
                className="rounded p-1.5 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f2d892]"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                className="glass-input !h-8 !min-w-[9rem] !border-0 !bg-transparent !text-xs font-semibold text-[#f2d892]"
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
                className="rounded p-1.5 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f2d892]"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isMesAtual && (
                <button
                  type="button"
                  onClick={() => setPeriodo({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() })}
                  className="ml-1 rounded px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[#f2d892] hover:bg-[rgba(240,210,140,0.12)]"
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
          contentSignal={`${periodo.mes}-${periodo.ano}-${data.length}-${porObra.length}-${porMontador.length}`}
          className="min-h-0 flex-1"
        >
          <>
          {/* Comissões do mês */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="glass-card p-5 border border-emerald-500/20">
              <p className="text-xs uppercase tracking-wider text-[#edd9c4] mb-1">
                Comissão a pagar em {periodoLabel}
              </p>
              <p className="text-3xl font-bold font-display text-emerald-400">
                {fmtCur(resumo.comissao_a_pagar_mes)}
              </p>
              <p className="mt-2 text-xs text-[#edd9c4]">
                Obras já concluídas neste mês com comissão configurada
                {resumo.obras_concluidas_mes > 0 && (
                  <span className="text-emerald-400/80"> · {resumo.obras_concluidas_mes} obra(s)</span>
                )}
              </p>
            </div>

            <div className="glass-card p-5 border border-amber-500/20">
              <p className="text-xs uppercase tracking-wider text-[#edd9c4] mb-1">
                Comissão em aberto em {periodoLabel}
              </p>
              <p className="text-3xl font-bold font-display text-amber-400">
                {fmtCur(resumo.comissao_em_aberto)}
              </p>
              <p className="mt-2 text-xs text-[#edd9c4]">
                Obras previstas para {periodoLabel}, ainda não concluídas, com comissão definida
                {resumo.obras_abertas_comissao > 0 && (
                  <span className="text-amber-400/80"> · {resumo.obras_abertas_comissao} obra(s)</span>
                )}
              </p>
            </div>
          </div>

          <FixoMontadorSection
            mes={periodo.mes}
            ano={periodo.ano}
            periodoLabel={periodoLabel}
            canEdit={canEditFixo}
          />

          {/* Comissão por montador */}
          <div className="glass-card overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-[rgba(240,210,140,0.12)]">
              <h2 className="text-sm font-semibold text-[#f2d892] uppercase tracking-wider">
                Comissão por montador — {periodoLabel}
              </h2>
              <p className="text-xs text-[#edd9c4] mt-1">
                Valores individuais de cada montador no mês selecionado
              </p>
            </div>

            {porMontador.length === 0 ? (
              <div className="p-8">
                <EmptyState message={`Nenhuma comissão registrada para ${periodoLabel}.`} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[rgba(240,210,140,0.12)]">
                      {[
                        'Montador', 'Concluída (a pagar)', 'Em aberto', 'Total previsto',
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#edd9c4]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porMontador.map((m, i) => {
                      const totalPrevisto = m.comissao_concluida + m.comissao_em_aberto
                      return (
                        <tr
                          key={m.montador_id}
                          className={`border-b border-[rgba(240,210,140,0.06)] ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setMontadorComissao(m)}
                              className="metricas-montador-link text-left"
                              title={`Ver obras com comissão de ${m.montador_nome}`}
                            >
                              <p className="font-semibold text-cream">{m.montador_nome}</p>
                            </button>
                            {(m.obras_concluidas > 0 || m.obras_em_aberto > 0) && (
                              <p className="text-[0.65rem] text-[#d4bc9f] mt-0.5">
                                {m.obras_concluidas > 0 && `${m.obras_concluidas} concluída(s)`}
                                {m.obras_concluidas > 0 && m.obras_em_aberto > 0 && ' · '}
                                {m.obras_em_aberto > 0 && `${m.obras_em_aberto} em aberto`}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400">
                            {m.comissao_concluida > 0 ? fmtCur(m.comissao_concluida) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-amber-400">
                            {m.comissao_em_aberto > 0 ? fmtCur(m.comissao_em_aberto) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-cream">
                            {totalPrevisto > 0 ? fmtCur(totalPrevisto) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[rgba(240,210,140,0.2)] bg-[rgba(240,210,140,0.04)]">
                      <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f2d892]">
                        Total do mês
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                        {fmtCur(porMontador.reduce((s, m) => s + m.comissao_concluida, 0))}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-amber-400">
                        {fmtCur(porMontador.reduce((s, m) => s + m.comissao_em_aberto, 0))}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-cream">
                        {fmtCur(porMontador.reduce(
                          (s, m) => s + m.comissao_concluida + m.comissao_em_aberto,
                          0,
                        ))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Resumo geral */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: `Obras a finalizar em ${periodoLabel}`,
                value: totalObras,
                color: '#f2d892',
                hint: 'Previstas para entrega neste mês (abertas, concluídas e em atraso)',
              },
              {
                label: 'Obras concluídas',
                value: `${totalConcluidas} (${pct(totalConcluidas, totalObras)})`,
                color: '#10b981',
                hint: 'Concluídas em relação ao total previsto para entrega no mês',
              },
              {
                label: 'Concluídas em atraso',
                value: `${totalAtraso}${totalConcluidas > 0 ? ` (${pct(totalAtraso, totalConcluidas)})` : ''}`,
                color: '#ef4444',
                hint: 'Entre as concluídas do mês, as que passaram do prazo máximo de execução',
              },
              {
                label: `Comissões geradas em ${periodoLabel}`,
                value: fmtCur(resumo.comissoes_geradas_mes),
                color: '#f2d892',
                hint: 'Lançamentos em Contas a Pagar',
              },
            ].map(({ label, value, color, hint }) => (
              <div key={label} className="glass-card p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-[#edd9c4] mb-1">{label}</p>
                <p className="text-3xl font-bold font-display" style={{ color }}>{value}</p>
                {hint && <p className="mt-1 text-[0.65rem] text-[#d4bc9f]">{hint}</p>}
              </div>
            ))}
          </div>

          <MetricasMontadorTempoChart porObra={porObra} periodo={periodo} periodoLabel={periodoLabel} />

          {/* Tabela por tipo */}
          {data.length === 0 ? (
            <EmptyState message="Nenhum tipo de obra cadastrado ainda." />
          ) : (
            <div className="glass-card overflow-hidden mb-8">
              <div className="px-4 py-3 border-b border-[rgba(240,210,140,0.12)]">
                <h2 className="text-sm font-semibold text-[#f2d892] uppercase tracking-wider">
                  Tempo por tipo de obra — entrega em {periodoLabel}
                </h2>
                <p className="text-xs text-[#edd9c4] mt-1">
                  Total e conclusão consideram obras com prazo de entrega neste mês
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b border-[rgba(240,210,140,0.12)]">
                      {[
                        'Tipo de Obra', 'A finalizar', 'Concluídas', 'Em atraso', 'Comissões',
                        'Tempo Médio', 'Tempo Total', 'Prazo Máx.', '% Conclusão',
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#edd9c4]">
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
                          className={`border-b border-[rgba(240,210,140,0.06)] ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}
                        >
                          <td className="px-4 py-3 font-semibold text-cream">{m.tipo_obra_nome}</td>
                          <td className="px-4 py-3 text-[#edd9c4]">{total}</td>
                          <td className="px-4 py-3">
                            <span className="text-emerald-400">{concluidas}</span>
                            <span className="text-[#d4bc9f] ml-1">({pct(concluidas, total)})</span>
                          </td>
                          <td className="px-4 py-3">
                            {atraso > 0
                              ? <span className="text-red-400 font-semibold">{atraso}</span>
                              : <span className="text-[#edd9c4]">0</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#f2d892]">
                            {fmtCur(Number(m.total_comissoes ?? 0))}
                          </td>
                          <td className="px-4 py-3 text-cream font-mono">{fmtH(m.tempo_medio_real_horas)}</td>
                          <td className="px-4 py-3 text-cream font-mono">{fmtH(m.tempo_total_real_horas)}</td>
                          <td className="px-4 py-3 text-[#edd9c4] font-mono">{fmtH(m.tempo_maximo_horas_default)}</td>
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
                                <span className="text-xs text-[#edd9c4] w-10 text-right">{Math.round(onTimeRate)}%</span>
                              </div>
                            ) : (
                              <span className="text-[#d4bc9f]">—</span>
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

          {obrasConclusaoGestao.length > 0 && (
            <div className="glass-card overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-[rgba(240,210,140,0.12)]">
                <h2 className="text-sm font-semibold text-[#f2d892] uppercase tracking-wider">
                  Conclusão das suas obras
                </h2>
                <p className="text-xs text-[#edd9c4] mt-1">
                  Acompanhe quem já marcou conclusão e quem ainda está pendente nas obras do seu grupo
                </p>
              </div>
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {obrasConclusaoGestao.map(obra => (
                  <div key={obra.id} className="min-w-0">
                    <p className="mb-1.5 text-sm font-semibold text-cream truncate">{obra.cliente_nome}</p>
                    <ObraMontadoresConclusao obra={obra} compact visible />
                  </div>
                ))}
              </div>
            </div>
          )}

          {canViewMontadoresConclusao && conclusaoPorObra.length > 0 && (
            <div className="glass-card overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-[rgba(240,210,140,0.12)]">
                <h2 className="text-sm font-semibold text-[#f2d892] uppercase tracking-wider">
                  Marcações de conclusão por obra
                </h2>
                <p className="text-xs text-[#edd9c4] mt-1">
                  Quem já marcou conclusão individual e quem ainda está pendente em {periodoLabel}
                </p>
              </div>
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {conclusaoPorObra.map(item => (
                  <div key={item.obra_id} className="min-w-0">
                    <p className="mb-1.5 text-sm font-semibold text-cream truncate">{item.cliente_nome}</p>
                    <ObraMontadoresConclusao
                      montadores={item.montadores}
                      fechadaPeloAdmin={
                        item.status_kanban === 'concluida'
                        && item.montadores.some(m => !m.concluiu)
                      }
                      compact
                      visible
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico por obra */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(240,210,140,0.12)]">
              <h2 className="text-sm font-semibold text-[#f2d892] uppercase tracking-wider">
                Histórico por obra
              </h2>
              <p className="text-xs text-[#edd9c4] mt-1">
                Obras de {periodoLabel} — início, fim e duração de cada montador
              </p>
            </div>

            {porObra.length === 0 ? (
              <div className="p-8">
                <EmptyState message="Nenhuma obra registrada ainda." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1180px]">
                  <thead>
                    <tr className="border-b border-[rgba(240,210,140,0.12)]">
                      {[
                        'Cliente', 'Montador', 'Tipo', 'Status', 'Marcação', 'Mês ref.', 'Início', 'Fim', 'Duração (horas)', 'Comissão',
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#edd9c4]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porObra.map((o, i) => (
                      <tr
                        key={`${o.obra_id}-${o.montador_id}`}
                        className={`border-b border-[rgba(240,210,140,0.06)] ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}
                      >
                        <td className="px-4 py-3 font-semibold text-cream">{o.cliente_nome}</td>
                        <td className="px-4 py-3 text-[#edd9c4]">{o.montador_nome ?? '—'}</td>
                        <td className="px-4 py-3 text-[#edd9c4]">{o.tipo_obra_nome ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-[#f2d892]">
                            {STATUS_LABEL[o.status_kanban as StatusKanbanObra] ?? o.status_kanban}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {o.finalizado_em ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-300">
                              Concluiu
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-300">
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#edd9c4] text-xs">
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
                        <td className="px-4 py-3 font-mono text-[#f2d892]">
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

      <MetricasMontadorComissaoModal
        open={!!montadorComissao}
        montador={montadorComissao}
        periodo={periodo}
        periodoLabel={periodoLabel}
        canManageComissao={canManageComissao}
        onClose={() => setMontadorComissao(null)}
      />
    </div>
  )
}
