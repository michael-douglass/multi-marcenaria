import { useEffect, useMemo, useRef, useState } from 'react'
import { Monitor } from 'lucide-react'
import { useObras } from '@/hooks/useObras'
import { useContasReceber } from '@/hooks/useContasReceber'
import { useEvolucaoPainel } from '@/hooks/useObraEvolucao'
import { useVisualizacaoAutoScroll } from '@/hooks/useVisualizacaoAutoScroll'
import {
  readVizAutoScrollEnabled,
  writeVizAutoScrollEnabled,
} from '@/lib/visualizacao-autoscroll-storage'
import { VisualizacaoPanel } from '@/components/visualizacao/VisualizacaoPanel'
import { VisualizacaoChegadaSemPedidoAlert } from '@/components/visualizacao/VisualizacaoChegadaSemPedidoAlert'
import { VisualizacaoToolbar } from '@/components/visualizacao/VisualizacaoToolbar'
import {
  filterEvolucaoGruposPorObras,
  VisualizacaoAcompanhamentoHoje,
} from '@/components/visualizacao/VisualizacaoAcompanhamentoHoje'
import { ObraMontadorBadge } from '@/components/obras/ObraMontadorBadge'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import {
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '@/components/page-zoom'
import { obrasParaDiaCalendario } from '@/lib/obra-dias-trabalho'
import {
  getChegadaCardColor,
  obrasParaDiaChegada,
  todayISO,
} from '@/lib/obra-chegada-material'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import { countObrasSemPedidoMaterial } from '@/lib/obra-pedido-material'
import {
  formatVisualizacaoRangeLabel,
  getVisualizacaoRange,
  isoEstaNoRange,
} from '@/lib/visualizacao-range'
import { fmtCur, fmtDate, isOverdue, cn } from '@/lib/utils'
import type { ContaReceber, StatusKanbanObra } from '@/types'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_ATIVOS = [1, 2, 3, 4, 5]

const STATUS_COLORS: Record<StatusKanbanObra, string> = {
  datas_em_aberto: '#6b7280',
  datas_em_atraso: '#ef4444',
  datas_definidas: '#3b82f6',
  em_andamento: '#f59e0b',
  concluida: '#10b981',
  cancelada: '#9ca3af',
}

const STATUS_LABEL: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

function useRelogio() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

interface SemanaDiaProps {
  iso: string
  count: number
  children: React.ReactNode
}

function SemanaDia({ iso, count, children }: SemanaDiaProps) {
  const hoje = todayISO()
  const day = new Date(`${iso}T12:00:00`)
  const isToday = iso === hoje

  return (
    <div
      className={cn(
        'viz-week-day glass-card flex flex-col p-2',
        count === 0 && 'min-h-[120px]',
        isToday && 'ring-1 ring-[#f2d892]/65',
      )}
    >
      <div className="viz-week-day__header shrink-0">
        <div className={cn('viz-week-day__title', isToday && 'text-[#f2d892]')}>
          <span>{WEEKDAYS[day.getDay()]}</span>
          {count > 0 ? (
            <span className="viz-week-day__count">{count}</span>
          ) : null}
        </div>
        <span className="viz-week-day__date">
          {day.getDate()}/{MONTHS[day.getMonth()]}
          {isToday ? <span className="viz-week-day__hoje">hoje</span> : null}
        </span>
      </div>
      <div className="viz-week-day__cards min-h-0 flex-1">{children}</div>
    </div>
  )
}

export function Visualizacao() {
  return (
    <PageZoomProvider pageKey="visualizacao">
      <VisualizacaoContent />
    </PageZoomProvider>
  )
}

function VisualizacaoContent() {
  const obrasHook = useObras()
  const contasHook = useContasReceber()
  const evolucaoHook = useEvolucaoPainel('hoje')
  const relogio = useRelogio()
  const scrollHostRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(() => readVizAutoScrollEnabled())
  const range = useMemo(() => getVisualizacaoRange(), [])
  const rangeLabel = formatVisualizacaoRangeLabel(range.start, range.end)
  const hoje = todayISO()

  const loading = obrasHook.loading || contasHook.loading
  const error = obrasHook.error ?? contasHook.error
  const contentReady = !loading && !error

  useVisualizacaoAutoScroll(autoScroll, contentReady, scrollHostRef)

  useEffect(() => {
    const reloadContas = contasHook.reload
    const reloadEvolucao = evolucaoHook.reload
    const id = setInterval(() => {
      void reloadContas()
      void reloadEvolucao()
    }, 120_000)
    return () => clearInterval(id)
  }, [contasHook.reload, evolucaoHook.reload])

  const obrasCalendario = useMemo(
    () => obrasHook.data.filter(o => {
      const s = getStatusEfetivo(o)
      return s !== 'concluida' && s !== 'cancelada'
    }),
    [obrasHook.data],
  )

  const obrasDoDia = useMemo(
    () => obrasParaDiaCalendario(obrasCalendario, hoje, DIAS_ATIVOS),
    [obrasCalendario, hoje],
  )

  const evolucaoHoje = useMemo(
    () => filterEvolucaoGruposPorObras(evolucaoHook.grupos, obrasDoDia),
    [evolucaoHook.grupos, obrasDoDia],
  )

  const totalFotosHoje = useMemo(
    () => evolucaoHoje.reduce(
      (acc, grupo) => acc + grupo.dias.reduce((sum, dia) => sum + dia.fotos.length, 0),
      0,
    ),
    [evolucaoHoje],
  )

  const obrasChegada = useMemo(
    () => obrasHook.data.filter(o =>
      o.pedido_material_feito
      && o.data_entrega_pedido
      && isoEstaNoRange(o.data_entrega_pedido, range.start, range.end),
    ),
    [obrasHook.data, range],
  )

  const semPedidoMaterialCount = useMemo(
    () => countObrasSemPedidoMaterial(obrasHook.data),
    [obrasHook.data],
  )

  const obrasAtrasadas = useMemo(
    () => obrasHook.data
      .filter(o => getStatusEfetivo(o) === 'datas_em_atraso')
      .sort((a, b) => (a.data_prevista_fim ?? '').localeCompare(b.data_prevista_fim ?? '')),
    [obrasHook.data],
  )

  const cobrancasAtrasadas = useMemo(() => {
    return contasHook.data
      .filter(c => c.status !== 'recebido' && isOverdue(c.data_vencimento))
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [contasHook.data])

  const clientesAtrasados = useMemo(() => {
    const map = new Map<string, ContaReceber[]>()
    for (const c of cobrancasAtrasadas) {
      const list = map.get(c.cliente_nome) ?? []
      list.push(c)
      map.set(c.cliente_nome, list)
    }
    return [...map.entries()]
      .map(([cliente_nome, parcelas]) => ({
        cliente_nome,
        parcelas,
        total: parcelas.reduce((s, p) => s + p.valor_parcela, 0),
        vencimentoMaisAntigo: parcelas.map(p => p.data_vencimento).sort()[0]!,
      }))
      .sort((a, b) => a.vencimentoMaisAntigo.localeCompare(b.vencimentoMaisAntigo))
  }, [cobrancasAtrasadas])

  const horaLabel = relogio.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dataLabel = relogio.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  const contentSignal = `${obrasChegada.length}-${semPedidoMaterialCount}-${obrasCalendario.length}-${obrasDoDia.length}-${totalFotosHoje}-${obrasAtrasadas.length}-${clientesAtrasados.length}-${loading}-${evolucaoHook.loading}`

  const handleToggleAutoScroll = () => {
    setAutoScroll(prev => {
      const next = !prev
      writeVizAutoScrollEnabled(next)
      return next
    })
  }

  return (
    <div className="obra-page-shell obra-page-shell--visualizacao fade-in flex flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      {loading ? (
        <LoadingState variant="page" message="" />
      ) : (
        <>
          <KanbanPageToolbar className="shrink-0">
            <div className="viz-page__hero relative overflow-hidden">
              <div className="viz-page__hero-glow" aria-hidden />
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="viz-page__eyebrow">
                    <Monitor size={14} />
                    Painel operacional
                  </div>
                  <h1 className="viz-page__title">Visualização</h1>
                  <p className="viz-page__desc">
                    Acompanhamento em tempo real — janela de <strong>{rangeLabel}</strong>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="viz-page__clock text-right">
                    <p className="viz-page__clock-time">{horaLabel}</p>
                    <p className="viz-page__clock-date capitalize">{dataLabel}</p>
                  </div>
                  <VisualizacaoToolbar
                    autoScroll={autoScroll}
                    onToggleAutoScroll={handleToggleAutoScroll}
                  />
                </div>
              </div>
            </div>
          </KanbanPageToolbar>

          {error && <ErrorState message={error} />}

          {!error && (
            <KanbanPageZoomShell
          scrollHostRef={scrollHostRef}
          showScrollArrows={false}
          horizontalScrollbar={false}
          verticalScrollbar
          contentLayout="fluid"
          contentSignal={contentSignal}
          className="min-h-0 flex-1"
        >
          <div className="viz-page">
            <div className="viz-page__grid">
              <VisualizacaoPanel
                title="Chegada de Materiais"
                subtitle={rangeLabel}
                accent="#34d399"
                badge={obrasChegada.length}
                headerExtra={
                  semPedidoMaterialCount > 0
                    ? <VisualizacaoChegadaSemPedidoAlert obras={obrasHook.data} />
                    : undefined
                }
                className="viz-panel--span-2 viz-stagger-1"
              >
                <div className="viz-week-wrap">
                  <div className="viz-week-grid">
                    {range.days.map(iso => {
                      const dayObras = obrasParaDiaChegada(obrasHook.data, iso)
                      return (
                        <SemanaDia key={iso} iso={iso} count={dayObras.length}>
                          {dayObras.length === 0 ? (
                            <p className="viz-empty">—</p>
                          ) : (
                            dayObras.map(obra => {
                              const cor = getChegadaCardColor(obra, hoje)
                              return (
                                <div
                                  key={obra.id}
                                  className="viz-mini-card"
                                  style={{ borderLeftColor: cor, backgroundColor: `${cor}48` }}
                                >
                                  <p className="viz-mini-card__title">{obra.cliente_nome}</p>
                                  {obra.lousa ? (
                                    <p className="viz-mini-card__meta truncate">{obra.lousa}</p>
                                  ) : null}
                                </div>
                              )
                            })
                          )}
                        </SemanaDia>
                      )
                    })}
                  </div>
                </div>
              </VisualizacaoPanel>

              <VisualizacaoPanel
                title="Calendário de Obras"
                subtitle={rangeLabel}
                accent="#60a5fa"
                badge={obrasCalendario.length}
                className="viz-panel--span-2 viz-stagger-2"
              >
                <div className="viz-week-wrap">
                  <div className="viz-week-grid">
                    {range.days.map(iso => {
                      const dayObras = obrasParaDiaCalendario(obrasCalendario, iso, DIAS_ATIVOS)
                      return (
                        <SemanaDia key={iso} iso={iso} count={dayObras.length}>
                          {dayObras.length === 0 ? (
                            <p className="viz-empty">—</p>
                          ) : (
                            dayObras.map(obra => {
                              const status = getStatusEfetivo(obra)
                              const cor = STATUS_COLORS[status]
                              return (
                                <div
                                  key={obra.id}
                                  className="viz-mini-card"
                                  style={{ borderLeftColor: cor, backgroundColor: `${cor}48` }}
                                >
                                  <p className="viz-mini-card__title">{obra.cliente_nome}</p>
                                  <p className="viz-mini-card__meta">{STATUS_LABEL[status]}</p>
                                </div>
                              )
                            })
                          )}
                        </SemanaDia>
                      )
                    })}
                  </div>
                </div>
              </VisualizacaoPanel>

              <VisualizacaoPanel
                title="Acompanhamento de Obras"
                subtitle={`Hoje · ${fmtDate(hoje)} · obras do dia`}
                accent="#f2d892"
                badge={totalFotosHoje || obrasDoDia.length}
                className="viz-panel--span-2 viz-stagger-3"
              >
                <VisualizacaoAcompanhamentoHoje
                  grupos={evolucaoHoje}
                  loading={evolucaoHook.loading}
                  error={evolucaoHook.error}
                  obrasDoDiaCount={obrasDoDia.length}
                />
              </VisualizacaoPanel>

              <VisualizacaoPanel
                title="Obras Atrasadas"
                subtitle="Todas as obras com prazo vencido"
                accent="#ef4444"
                badge={obrasAtrasadas.length}
                className="viz-panel--span-2 viz-stagger-4"
              >
                {obrasAtrasadas.length === 0 ? (
                  <p className="viz-empty viz-empty--center">Nenhuma obra em atraso no momento.</p>
                ) : (
                  <ul className="viz-list">
                    {obrasAtrasadas.map(obra => (
                      <li key={obra.id} className="viz-list-item viz-list-item--alert">
                        <div className="min-w-0 flex-1">
                          <p className="viz-list-item__title">{obra.cliente_nome}</p>
                          {obra.lousa ? (
                            <p className="viz-list-item__meta truncate">{obra.lousa}</p>
                          ) : null}
                          <div className="mt-1.5">
                            <ObraMontadorBadge obra={obra} compact />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="viz-list-item__date text-red-200">
                            até {fmtDate(obra.data_prevista_fim)}
                          </p>
                          <p className="viz-list-item__meta">{STATUS_LABEL[getStatusEfetivo(obra)]}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </VisualizacaoPanel>

              <VisualizacaoPanel
                title="Cobranças Atrasadas"
                subtitle="Clientes com parcelas vencidas"
                accent="#f59e0b"
                badge={clientesAtrasados.length}
                className="viz-panel--span-2 viz-stagger-5"
              >
                {clientesAtrasados.length === 0 ? (
                  <p className="viz-empty viz-empty--center">Nenhum cliente em atraso.</p>
                ) : (
                  <ul className="viz-list">
                    {clientesAtrasados.map(grupo => (
                      <li key={grupo.cliente_nome} className="viz-list-item">
                        <div className="min-w-0 flex-1">
                          <p className="viz-list-item__title">{grupo.cliente_nome}</p>
                          <p className="viz-list-item__meta">
                            {grupo.parcelas.length} parcela{grupo.parcelas.length !== 1 ? 's' : ''} vencida{grupo.parcelas.length !== 1 ? 's' : ''}
                            {' · '}desde {fmtDate(grupo.vencimentoMaisAntigo)}
                          </p>
                        </div>
                        <p className="viz-list-item__value shrink-0">{fmtCur(grupo.total)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </VisualizacaoPanel>
            </div>
          </div>
        </KanbanPageZoomShell>
          )}
        </>
      )}
    </div>
  )
}

