import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Monitor } from 'lucide-react'
import { useObras } from '@/hooks/useObras'
import { useContasReceber } from '@/hooks/useContasReceber'
import { useEvolucaoPainel } from '@/hooks/useObraEvolucao'
import { useVisualizacaoAutoScroll } from '@/hooks/useVisualizacaoAutoScroll'
import { useVisualizacaoObrasDoDiaAutoFullscreen } from '@/hooks/useVisualizacaoObrasDoDiaAutoFullscreen'
import {
  readVizAutoScrollEnabled,
  writeVizAutoScrollEnabled,
} from '@/lib/visualizacao-autoscroll-storage'
import { VisualizacaoPanel } from '@/components/visualizacao/VisualizacaoPanel'
import { VisualizacaoChegadaSemPedidoAlert } from '@/components/visualizacao/VisualizacaoChegadaSemPedidoAlert'
import { VisualizacaoCalendarioStats } from '@/components/visualizacao/VisualizacaoCalendarioStats'
import { VisualizacaoCalendarioSemanaContent } from '@/components/visualizacao/VisualizacaoCalendarioSemanaContent'
import { VisualizacaoFullscreenOverlay } from '@/components/visualizacao/VisualizacaoFullscreenOverlay'
import { VisualizacaoObrasDoDiaContent } from '@/components/visualizacao/VisualizacaoObrasDoDiaContent'
import { VisualizacaoObrasDoDiaButton } from '@/components/visualizacao/VisualizacaoObrasDoDiaButton'
import { VisualizacaoSemanaDia } from '@/components/visualizacao/VisualizacaoSemanaDia'
import { VisualizacaoToolbar } from '@/components/visualizacao/VisualizacaoToolbar'
import { VisualizacaoPaineisConfigModal } from '@/components/visualizacao/VisualizacaoPaineisConfigModal'
import { VisualizacaoPontoDiario } from '@/components/visualizacao/VisualizacaoPontoDiario'
import {
  filterEvolucaoGruposPorObras,
  VisualizacaoAcompanhamentoHoje,
} from '@/components/visualizacao/VisualizacaoAcompanhamentoHoje'
import { useVisualizacaoConfig } from '@/hooks/useVisualizacaoConfig'
import { useControlePontoDiario } from '@/hooks/useControlePontoDiario'
import { pontoDataLocal } from '@/lib/funcionario-ponto'
import {
  canConfigurarVisualizacaoPaineis,
  canViewPainelVisualizacao,
  canViewPontoPainelVisualizacao,
  paineisPermitidosPorRoles,
  shouldFiltrarPaineisVisualizacao,
  VISUALIZACAO_PAINEL_GRID_IDS,
  painelApareceNoGrid,
  type VisualizacaoPainelId,
} from '@/lib/visualizacao-paineis'
import {
  VIZ_OBRAS_DIA_SHOW_MS,
} from '@/hooks/useVisualizacaoObrasDoDiaAutoFullscreen'
import { ObraMontadoresConclusao } from '@/components/obras/ObraMontadoresConclusao'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { useApp } from '@/context/AppContext'
import { canViewMontadoresConclusaoObra } from '@/lib/obra-permissions'
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
  addDaysISO,
} from '@/lib/obra-chegada-material'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import { countObrasSemPedidoMaterial } from '@/lib/obra-pedido-material'
import { getVisualizacaoObrasMesStats } from '@/lib/visualizacao-obras-stats'
import {
  formatVisualizacaoRangeLabel,
  getVisualizacaoRange,
  isoEstaNoRange,
} from '@/lib/visualizacao-range'
import { fmtCur, fmtDate, isOverdue } from '@/lib/utils'
import type { ContaReceber, StatusKanbanObra } from '@/types'

const DIAS_ATIVOS = [1, 2, 3, 4, 5]

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

type PainelId = VisualizacaoPainelId

export function Visualizacao() {
  return (
    <PageZoomProvider pageKey="visualizacao">
      <VisualizacaoContent />
    </PageZoomProvider>
  )
}

function VisualizacaoContent() {
  const { roles } = useApp()
  const obrasHook = useObras()
  const evolucaoHook = useEvolucaoPainel('hoje')
  const configHook = useVisualizacaoConfig()
  const relogio = useRelogio()
  const scrollHostRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(() => readVizAutoScrollEnabled())
  const [paineisConfigOpen, setPaineisConfigOpen] = useState(false)
  const [manualObrasDoDiaOpen, setManualObrasDoDiaOpen] = useState(false)
  const range = useMemo(() => getVisualizacaoRange(), [])
  const rangeLabel = formatVisualizacaoRangeLabel(range.start, range.end)
  const hoje = todayISO()
  const canViewMontadoresConclusao = canViewMontadoresConclusaoObra(roles)
  const canConfigPaineis = canConfigurarVisualizacaoPaineis(roles)
  const canViewPontoPainel = canViewPontoPainelVisualizacao(roles)
  const canViewCobrancasPainel = canViewPainelVisualizacao(roles, 'cobrancas_atrasadas')
  const recorteEquipe = paineisPermitidosPorRoles(roles) != null
  const filtrarPaineis = shouldFiltrarPaineisVisualizacao(roles)
  const contasHook = useContasReceber({ enabled: canViewCobrancasPainel })
  const pontoHook = useControlePontoDiario(pontoDataLocal(), {
    enabled: canViewPontoPainel,
    longCache: true,
  })

  const painelVisivel = (id: VisualizacaoPainelId) => {
    if (!canViewPainelVisualizacao(roles, id)) return false
    if (!filtrarPaineis) return true
    if (configHook.loading) return false
    return configHook.paineisVisiveis.has(id)
  }


  const error = obrasHook.error ?? (canViewCobrancasPainel ? contasHook.error : null)
  const isInitialLoading =
    (obrasHook.loading && obrasHook.data.length === 0)
    || (canViewCobrancasPainel && contasHook.loading && contasHook.data.length === 0)
    || (filtrarPaineis && configHook.loading && configHook.salvos === null)
  const contentReady = !isInitialLoading && !error

  const obrasDoDiaAutoEnabled =
    autoScroll && contentReady && painelVisivel('obras_do_dia') && !manualObrasDoDiaOpen
  const obrasDoDiaAuto = useVisualizacaoObrasDoDiaAutoFullscreen(obrasDoDiaAutoEnabled)
  const overlayAutoOpen = obrasDoDiaAuto.open
  const overlayOpen = overlayAutoOpen || manualObrasDoDiaOpen

  useVisualizacaoAutoScroll(
    autoScroll && !overlayOpen,
    contentReady,
    scrollHostRef,
    obrasDoDiaAutoEnabled ? obrasDoDiaAuto.trigger : undefined,
  )

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

  const obrasHojeAmanhaCount = useMemo(() => {
    const amanha = addDaysISO(hoje, 1)
    return obrasParaDiaCalendario(obrasCalendario, hoje, DIAS_ATIVOS).length
      + obrasParaDiaCalendario(obrasCalendario, amanha, DIAS_ATIVOS).length
  }, [obrasCalendario, hoje])

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

  const mesAtual = relogio.getMonth() + 1
  const anoAtual = relogio.getFullYear()

  const calendarioMesStats = useMemo(
    () => getVisualizacaoObrasMesStats(obrasHook.data, mesAtual, anoAtual),
    [obrasHook.data, mesAtual, anoAtual],
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

  const pontoResumo = useMemo(() => {
    let presentes = 0
    let atrasados = 0
    let faltas = 0
    for (const r of pontoHook.rows) {
      if (r.status_dia === 'falta') faltas++
      else if (r.status_dia === 'atraso') atrasados++
      else if (r.entrada) presentes++
    }
    return { presentes, atrasados, faltas, total: pontoHook.rows.length }
  }, [pontoHook.rows])

  const contentSignal = `${obrasChegada.length}-${semPedidoMaterialCount}-${obrasCalendario.length}-${calendarioMesStats.total}-${calendarioMesStats.aFinalizarMes}-${calendarioMesStats.concluidasMes}-${obrasDoDia.length}-${obrasHojeAmanhaCount}-${totalFotosHoje}-${obrasAtrasadas.length}-${clientesAtrasados.length}-${pontoResumo.presentes}-${pontoResumo.atrasados}-${pontoResumo.faltas}-${pontoResumo.total}`

  const handleToggleAutoScroll = () => {
    setAutoScroll(prev => {
      const next = !prev
      writeVizAutoScrollEnabled(next)
      return next
    })
  }

  const obrasDoDiaSubtitle = `${fmtDate(hoje)} · amanhã ${fmtDate(addDaysISO(hoje, 1))}`

  const renderPainelContent = (id: PainelId) => {
    switch (id) {
      case 'chegada_materiais':
        return (
          <div className="viz-week-wrap">
            <div className="viz-week-grid">
              {range.days.map(iso => {
                const dayObras = obrasParaDiaChegada(obrasHook.data, iso)
                return (
                  <VisualizacaoSemanaDia
                    key={iso}
                    iso={iso}
                    count={dayObras.length}
                  >
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
                  </VisualizacaoSemanaDia>
                )
              })}
            </div>
          </div>
        )

      case 'calendario_obras':
        return (
          <VisualizacaoCalendarioSemanaContent
            rangeDays={range.days}
            obrasCalendario={obrasCalendario}
            diasAtivos={DIAS_ATIVOS}
          />
        )
      case 'acompanhamento_obras':
        return (
          <VisualizacaoAcompanhamentoHoje
            grupos={evolucaoHoje}
            loading={evolucaoHook.loading}
            error={evolucaoHook.error}
            obrasDoDiaCount={obrasDoDia.length}
          />
        )

      case 'obras_atrasadas':        if (obrasAtrasadas.length === 0) {
          return (
            <p className="viz-empty viz-empty--center">
              Nenhuma obra em atraso no momento.
            </p>
          )
        }
        return (
          <ul className="viz-list">            {obrasAtrasadas.map(obra => (
              <li key={obra.id} className="viz-list-item viz-list-item--alert flex-col items-stretch">
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="viz-list-item__title">{obra.cliente_nome}</p>
                    {obra.lousa ? (
                      <p className="viz-list-item__meta truncate">{obra.lousa}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="viz-list-item__date text-red-200">
                      até {fmtDate(obra.data_prevista_fim)}
                    </p>
                    <p className="viz-list-item__meta">{STATUS_LABEL[getStatusEfetivo(obra)]}</p>
                  </div>
                </div>
                <ObraMontadoresConclusao
                  obra={obra}
                  compact
                  visible={canViewMontadoresConclusao}
                />
              </li>
            ))}
          </ul>
        )

      case 'cobrancas_atrasadas':
        if (clientesAtrasados.length === 0) {
          return <p className="viz-empty viz-empty--center">Nenhum cliente em atraso.</p>
        }
        return (
          <ul className="viz-list">
            {clientesAtrasados.map(grupo => (              <li key={grupo.cliente_nome} className="viz-list-item">
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
        )

      default:
        return null
    }
  }

  return (
    <div className="obra-page-shell obra-page-shell--visualizacao fade-in flex flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      {isInitialLoading ? (
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
                    canConfigPaineis={canConfigPaineis}
                    onOpenPaineisConfig={() => setPaineisConfigOpen(true)}
                  />                </div>
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
              {painelVisivel('chegada_materiais') && painelApareceNoGrid('chegada_materiais') && (
              <VisualizacaoPanel
                title="Chegada de Materiais"
                subtitle={rangeLabel}
                accent="#059669"
                badge={obrasChegada.length}
                headerExtra={
                  semPedidoMaterialCount > 0
                    ? <VisualizacaoChegadaSemPedidoAlert obras={obrasHook.data} />
                    : undefined
                }
                className="viz-panel--span-2 viz-stagger-1"
              >
                {renderPainelContent('chegada_materiais')}
              </VisualizacaoPanel>
              )}

              {painelVisivel('calendario_obras') && painelApareceNoGrid('calendario_obras') && (
              <VisualizacaoPanel
                title="Calendário de Obras"
                subtitle={rangeLabel}
                accent="#2563eb"
                headerEnd={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {painelVisivel('obras_do_dia') ? (
                      <VisualizacaoObrasDoDiaButton
                        count={obrasHojeAmanhaCount}
                        onClick={() => setManualObrasDoDiaOpen(true)}
                      />
                    ) : null}
                    <VisualizacaoCalendarioStats
                      stats={calendarioMesStats}
                      mes={mesAtual}
                      ano={anoAtual}
                    />
                  </div>
                }
                className="viz-panel--span-2 viz-stagger-2"
              >
                {renderPainelContent('calendario_obras')}
              </VisualizacaoPanel>
              )}

              {painelVisivel('acompanhamento_obras') && painelApareceNoGrid('acompanhamento_obras') && (
              <VisualizacaoPanel
                title="Acompanhamento de Obras"
                subtitle={`Hoje · ${fmtDate(hoje)} · obras do dia`}
                accent="#c4963a"
                badge={totalFotosHoje || obrasDoDia.length}
                className="viz-panel--span-2 viz-stagger-3"
              >
                {renderPainelContent('acompanhamento_obras')}
              </VisualizacaoPanel>
              )}

              {painelVisivel('obras_atrasadas') && painelApareceNoGrid('obras_atrasadas') && (
              <VisualizacaoPanel
                title="Obras Atrasadas"
                subtitle={
                  recorteEquipe
                    ? 'Obras da sua equipe com prazo vencido'
                    : 'Todas as obras com prazo vencido'
                }
                accent="#dc2626"
                badge={obrasAtrasadas.length}
                className="viz-panel--span-2 viz-stagger-5"
              >
                {renderPainelContent('obras_atrasadas')}
              </VisualizacaoPanel>
              )}

              {painelVisivel('cobrancas_atrasadas') && painelApareceNoGrid('cobrancas_atrasadas') && (
              <VisualizacaoPanel
                title="Cobranças Atrasadas"
                subtitle="Clientes com parcelas vencidas"
                accent="#d97706"
                badge={clientesAtrasados.length}
                className="viz-panel--span-2 viz-stagger-6"
              >
                {renderPainelContent('cobrancas_atrasadas')}
              </VisualizacaoPanel>
              )}

              {canViewPontoPainel && (
              <VisualizacaoPanel
                title="Ponto"
                subtitle={`Hoje · ${fmtDate(hoje)} · registros diários da equipe`}
                accent="#7c3aed"
                badge={pontoResumo.total}
                headerEnd={
                  <Link
                    to="/bater-ponto"
                    className="viz-panel__fs-btn inline-flex items-center gap-1.5 no-underline"
                  >
                    <Clock size={14} />
                    Abrir Ponto
                  </Link>
                }
                className="viz-panel--span-2 viz-stagger-7"
              >
                <VisualizacaoPontoDiario
                  rows={pontoHook.rows}
                  loading={pontoHook.loading}
                  error={pontoHook.error}
                  onRetry={() => void pontoHook.reload()}
                />
              </VisualizacaoPanel>
              )}

              {filtrarPaineis && !configHook.loading && VISUALIZACAO_PAINEL_GRID_IDS.every(id => !painelVisivel(id)) && (
                <div className="viz-panel--span-2 glass-card p-10 text-center">
                  <p className="text-sm text-[#edd9c4]">
                    {painelVisivel('obras_do_dia') && !painelApareceNoGrid('obras_do_dia')
                      ? 'Nenhum painel fixo disponível. Use o botão Obras do dia no Calendário de Obras ou ative a rolagem automática.'
                      : 'Nenhum painel está disponível para visualização no momento.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </KanbanPageZoomShell>
          )}

      <VisualizacaoPaineisConfigModal
        open={paineisConfigOpen}
        onClose={() => setPaineisConfigOpen(false)}
        salvos={configHook.salvos}
        saving={configHook.saving}
        onSave={configHook.save}
      />

      <VisualizacaoFullscreenOverlay
        open={overlayOpen}
        panelId="obras_do_dia"
        subtitle={obrasDoDiaSubtitle}
        showProgress={overlayAutoOpen}
        autoCloseMs={VIZ_OBRAS_DIA_SHOW_MS}
        onClose={manualObrasDoDiaOpen ? () => setManualObrasDoDiaOpen(false) : undefined}
      >
        <VisualizacaoObrasDoDiaContent
          obrasCalendario={obrasCalendario}
          hoje={hoje}
          diasAtivos={DIAS_ATIVOS}
        />
      </VisualizacaoFullscreenOverlay>
        </>
      )}
    </div>
  )
}

