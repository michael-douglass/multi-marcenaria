import { useMemo, useState } from 'react'
import { Plus, Users, History, Receipt, ArrowUpRight, ArrowDownLeft, Search, Undo2, FileText, Trash2 } from 'lucide-react'
import { CaixaProvider, useCaixaContext } from '@/context/CaixaContext'
import { isCaixaDestinatarioVirtual } from '@/hooks/useCaixa'
import { useReciboConfig } from '@/hooks/useReciboConfig'
import { fmtCur, cn } from '@/lib/utils'
import { ordenarReservasCaixa } from '@/lib/caixa-ordenar-reservas'
import { calcValorAPagarDaReserva } from '@/lib/caixa-valor-a-pagar'
import { LoadingState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GerenciarDestinatariosDialog } from '@/components/caixa/GerenciarDestinatariosDialog'
import { RegistrarMovimentacaoDialog } from '@/components/caixa/RegistrarMovimentacaoDialog'
import { PagarReservaDialog } from '@/components/caixa/PagarReservaDialog'
import { CaixaComprovantePrintModal } from '@/components/caixa/CaixaComprovantePrintModal'
import { SaldoDisponivelDialog } from '@/components/caixa/SaldoDisponivelDialog'
import { CaixaMesFilterBar } from '@/components/caixa/CaixaMesFilterBar'
import { CaixaValorEditavel } from '@/components/caixa/CaixaValorEditavel'
import { AjustarValorRealDialog } from '@/components/caixa/AjustarValorRealDialog'
import { QrCodeToolkit } from '@/components/qr/QrCodeToolkit'
import type { ContaPagarResumoCaixa } from '@/hooks/useCaixa'
import type { ReservaConsolidada, CaixaMovimentacao } from '@/types'

/** Normaliza busca: ignora maiúsculas/minúsculas, acentos e espaços. */
const normBusca = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '')

function matchBusca(q: string, ...parts: (string | number | null | undefined)[]): boolean {
  if (!q) return true
  const nq = normBusca(q)
  if (!nq) return true
  return parts.some(p => p != null && normBusca(String(p)).includes(nq))
}

function calcValorRestante(valorReal: number, valorReservado: number) {
  return Math.max(0, valorReal - valorReservado)
}

function getStatusReserva(valorReal: number, totalPago: number): 'pago' | 'parcialmente_pago' | 'aberto' | null {
  if (valorReal <= 0) return null
  if (totalPago >= valorReal - 0.009) return 'pago'
  if (totalPago > 0) return 'parcialmente_pago'
  return 'aberto'
}

interface CaixaProps {
  /** Quando true, renderiza dentro do popup flutuante (sem título de página). */
  embedded?: boolean
}

export function Caixa({ embedded = false }: CaixaProps) {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())

  return (
    <CaixaProvider mes={mes} ano={ano}>
      <CaixaContent
        embedded={embedded}
        mes={mes}
        ano={ano}
        onPeriodoChange={(m, a) => {
          setMes(m)
          setAno(a)
        }}
      />
    </CaixaProvider>
  )
}

function CaixaContent({
  embedded,
  mes,
  ano,
  onPeriodoChange,
}: {
  embedded: boolean
  mes: number
  ano: number
  onPeriodoChange: (mes: number, ano: number) => void
}) {
  const {
    resumo,
    loading,
    reservasConsolidadas,
    movimentacoes,
    desfazerReserva,
    excluirLinhaCaixa,
    excluirMovimentacao,
    ajustarTotalConsolidado,
    listarContasValorReal,
    ajustarValorReal,
  } = useCaixaContext()
  const reciboHook = useReciboConfig()
  const [tab, setTab] = useState<'reservas' | 'movimentacoes' | 'historico'>('reservas')
  const [busca, setBusca] = useState('')
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const reservasFiltradas = useMemo(() => {
    const q = busca.trim()
    const filtradas = !q
      ? reservasConsolidadas
      : reservasConsolidadas.filter(item =>
          matchBusca(
            q,
            item.destinatario_nome,
            item.tipo_destinatario,
            item.data_vencimento,
            item.valor_total_real,
            item.valor_em_reserva,
            item.total_pago,
          ),
        )
    // 1 aberto sem reserva · 1.5 parcial · 2 aberto com reserva · 3 pago
    return ordenarReservasCaixa(filtradas)
  }, [reservasConsolidadas, busca])

  const totaisReservas = useMemo(() => {
    return reservasFiltradas.reduce(
      (acc, item) => {
        const restante = calcValorRestante(item.valor_total_real, item.valor_em_reserva)
        const aPagar = calcValorAPagarDaReserva(item.valor_em_reserva, item.total_pago)
        return {
          valorReal: acc.valorReal + item.valor_total_real,
          reservado: acc.reservado + item.valor_em_reserva,
          pago: acc.pago + item.total_pago,
          restante: acc.restante + restante,
          aPagar: acc.aPagar + aPagar,
        }
      },
      { valorReal: 0, reservado: 0, pago: 0, restante: 0, aPagar: 0 },
    )
  }, [reservasFiltradas])

  const movimentacoesFiltradas = useMemo(() => {
    const q = busca.trim()
    if (!q) return movimentacoes
    return movimentacoes.filter((mov: CaixaMovimentacao) =>
      matchBusca(
        q,
        mov.movelaria_caixa_destinatarios?.nome,
        mov.descricao,
        mov.tipo_movimentacao,
        mov.data_movimentacao,
        mov.valor,
      ),
    )
  }, [movimentacoes, busca])

  // Dialogs
  const [destinatariosOpen, setDestinatariosOpen] = useState(false)
  const [novaMovOpen, setNovaMovOpen] = useState(false)
  const [saldoDialogOpen, setSaldoDialogOpen] = useState(false)
  const [pagarReserva, setPagarReserva] = useState<ReservaConsolidada | null>(null)
  const [comprovanteReserva, setComprovanteReserva] = useState<ReservaConsolidada | null>(null)
  const [valorRealReserva, setValorRealReserva] = useState<ReservaConsolidada | null>(null)
  const [contasValorReal, setContasValorReal] = useState<ContaPagarResumoCaixa[]>([])
  const [loadingContasValorReal, setLoadingContasValorReal] = useState(false)

  const abrirComprovante = (item: ReservaConsolidada) => {
    setComprovanteReserva(item)
  }

  const abrirAjusteValorReal = async (item: ReservaConsolidada) => {
    setValorRealReserva(item)
    setContasValorReal([])
    setLoadingContasValorReal(true)
    try {
      const contas = await listarContasValorReal(
        item.destinatario_nome,
        item.mes_referencia,
        item.ano_referencia,
      )
      setContasValorReal(contas)
    } catch (err) {
      setValorRealReserva(null)
      alert(err instanceof Error ? err.message : 'Não foi possível carregar Contas a Pagar.')
    } finally {
      setLoadingContasValorReal(false)
    }
  }

  const handleDesfazerReserva = async (item: ReservaConsolidada) => {
    const ok = confirm(
      `Desfazer a reserva de ${fmtCur(item.valor_em_reserva)} para ${item.destinatario_nome}?\n\n` +
        'O valor sai do caixa e do saldo disponível. Contas vinculadas voltam para "a pagar".',
    )
    if (!ok) return

    setDesfazendoId(item.destinatario_id)
    try {
      await desfazerReserva(item)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível desfazer a reserva.')
    } finally {
      setDesfazendoId(null)
    }
  }

  const handleExcluirLinha = async (item: ReservaConsolidada) => {
    const ok = confirm(
      `Excluir a conta de ${item.destinatario_nome} neste mês?\n\n` +
        'Isso apaga as movimentações do Caixa e as Contas a Pagar deste destinatário no mês selecionado.\n' +
        'Essa ação não pode ser desfeita.',
    )
    if (!ok) return

    setExcluindoId(item.destinatario_id)
    try {
      await excluirLinhaCaixa(item)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível excluir a conta.')
    } finally {
      setExcluindoId(null)
    }
  }

  const handleExcluirMovimentacao = async (mov: CaixaMovimentacao) => {
    const nome = mov.movelaria_caixa_destinatarios?.nome || 'esta movimentação'
    const ok = confirm(
      `Excluir ${mov.tipo_movimentacao === 'pagamento' ? 'pagamento' : 'reserva'} de ${fmtCur(mov.valor)} (${nome})?\n\n` +
        'Essa ação não pode ser desfeita.',
    )
    if (!ok) return

    setExcluindoId(mov.id)
    try {
      await excluirMovimentacao(mov.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível excluir a movimentação.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div
      className={cn(
        'animate-in fade-in duration-500',
        embedded ? 'flex h-full min-h-0 flex-col gap-1.5 sm:gap-2' : 'space-y-6',
      )}
      data-caixa-root={embedded ? 'embedded' : 'page'}
    >
      {/* Header & filtros */}
      <div
        className={cn(
          'flex flex-col md:flex-row md:items-end md:justify-between',
          embedded ? 'shrink-0 gap-1.5' : 'gap-6',
        )}
      >
        {!embedded && (
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-cream">Caixa de Pagamentos</h1>
            <p className="text-[0.9rem] text-[#edd9c4]">
              Controle de valores reservados e pagamentos efetuados.
            </p>
          </div>
        )}

        <div
          className={cn(
            'flex min-w-0 items-center',
            embedded ? 'w-full flex-nowrap gap-1.5 overflow-x-auto' : 'flex-wrap gap-2',
          )}
        >
          <CaixaMesFilterBar
            mes={mes}
            ano={ano}
            onChange={onPeriodoChange}
            compact={embedded}
          />
          <div className="shrink-0">
            <QrCodeToolkit />
          </div>
        </div>
      </div>

      <div className={cn('relative', embedded ? 'max-w-full shrink-0' : 'max-w-md')}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#edd9c4]" />
        <input
          className={cn('glass-input w-full pl-9', embedded && '!h-9 text-sm')}
          placeholder="Buscar destinatário, descrição ou valor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Cards de Resumo */}
      <div
        className={cn(
          'grid',
          embedded ? 'shrink-0 grid-cols-3 gap-1.5 sm:gap-2' : 'gap-3 sm:gap-4 md:grid-cols-3',
        )}
      >
        <div className={cn('glass-card space-y-1', embedded ? 'p-2' : 'p-4 space-y-2')}>
          <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4] font-bold sm:text-[0.7rem]">
            Total Reservado
          </p>
          <p className={cn('font-bold text-cream', embedded ? 'text-sm sm:text-base' : 'text-xl')}>
            {fmtCur(resumo.total_reservado)}
          </p>
        </div>
        <div
          className={cn(
            'glass-card border-l-2 border-l-red-500/30 space-y-1',
            embedded ? 'p-2' : 'p-4 space-y-2',
          )}
        >
          <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4] font-bold sm:text-[0.7rem]">
            Total Pago
          </p>
          <p className={cn('font-bold text-red-400', embedded ? 'text-sm sm:text-base' : 'text-xl')}>
            {fmtCur(resumo.total_pago)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSaldoDialogOpen(true)}
          className={cn(
            'glass-card border-l-2 border-l-emerald-500/30 text-left w-full cursor-pointer transition-all hover:bg-emerald-500/5 hover:border-l-emerald-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/40 space-y-1',
            embedded ? 'p-2' : 'p-4 space-y-2',
          )}
          title="Clique para ver onde o saldo está guardado"
        >
          <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4] font-bold sm:text-[0.7rem]">
            Saldo Disponível
          </p>
          <p className={cn('font-bold text-emerald-400', embedded ? 'text-sm sm:text-base' : 'text-xl')}>
            {fmtCur(resumo.saldo_disponivel)}
          </p>
          {!embedded && (
            <p className="text-[0.65rem] text-[#edd9c4]">Clique para justificar contas →</p>
          )}
        </button>
      </div>

      {/* Tabs & Ações */}
      <div
        className={cn(
          'flex flex-col md:flex-row md:items-center md:justify-between',
          embedded ? 'shrink-0 gap-1.5' : 'gap-4',
        )}
      >
        <div className="flex w-fit gap-1 rounded-lg border border-white/5 bg-black/20 p-1">
          <button
            onClick={() => setTab('reservas')}
            className={cn(
              'flex items-center gap-1.5 rounded-md text-xs font-semibold transition-all',
              embedded ? 'px-3 py-1.5' : 'gap-2 px-4 py-2',
              tab === 'reservas'
                ? 'bg-[#f2d892] text-[#2a1812]'
                : 'text-[#edd9c4] hover:bg-white/5 hover:text-cream',
            )}
          >
            <Receipt className="h-3.5 w-3.5" />
            Reservas
          </button>
          <button
            onClick={() => setTab('movimentacoes')}
            className={cn(
              'flex items-center gap-1.5 rounded-md text-xs font-semibold transition-all',
              embedded ? 'px-3 py-1.5' : 'gap-2 px-4 py-2',
              tab === 'movimentacoes'
                ? 'bg-[#f2d892] text-[#2a1812]'
                : 'text-[#edd9c4] hover:bg-white/5 hover:text-cream',
            )}
          >
            <History className="h-3.5 w-3.5" />
            Pagamentos
          </button>
          <button
            onClick={() => setTab('historico')}
            className={cn(
              'flex items-center gap-1.5 rounded-md text-xs font-semibold transition-all',
              embedded ? 'px-3 py-1.5' : 'gap-2 px-4 py-2',
              tab === 'historico'
                ? 'bg-[#f2d892] text-[#2a1812]'
                : 'text-[#edd9c4] hover:bg-white/5 hover:text-cream',
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Histórico
          </button>
        </div>

        <div className={cn('flex items-center', embedded ? 'gap-2' : 'gap-3')}>
          <Button
            variant="outline"
            className={cn('border-white/10 text-xs hover:bg-white/5', embedded ? 'h-8' : 'h-9')}
            onClick={() => setDestinatariosOpen(true)}
          >
            <Users className="mr-2 h-3.5 w-3.5 text-[#f2d892]" />
            Destinatários
          </Button>
          <Button
            className={cn('bg-[#f2d892] text-xs text-[#2a1812] hover:bg-[#b88f44]', embedded ? 'h-8' : 'h-9')}
            onClick={() => setNovaMovOpen(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {/* Content — no popup: ocupa o restante e rola por dentro */}
      <div
        className={cn(
          'glass-card',
          embedded
            ? 'min-h-0 flex-1 overflow-auto [&_th]:px-3 [&_th]:py-2.5 [&_td]:px-3 [&_td]:py-2.5'
            : 'min-h-[400px]',
        )}
        data-caixa-table-panel={embedded ? 'scroll' : 'page'}
      >
        {loading ? (
          <LoadingState message="Carregando dados..." />
        ) : (
          <div className={cn(embedded ? 'min-h-0 overflow-x-auto' : 'overflow-x-auto')}>
            {tab === 'reservas' && (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead
                  className={
                    embedded
                      ? 'sticky top-0 z-10 bg-[rgba(28,16,10,0.96)] backdrop-blur-sm'
                      : undefined
                  }
                >
                  <tr className="border-b border-white/5 text-[0.65rem] uppercase tracking-wider text-[#edd9c4] font-bold">
                    <th className="px-6 py-4">Destinatário</th>
                    <th className="px-6 py-4">Vencimento</th>
                    <th className="px-6 py-4 text-center">Lanç.</th>
                    <th className="px-6 py-4 text-right">Valor Real</th>
                    <th className="px-6 py-4 text-right">Reservado</th>
                    <th className="px-6 py-4 text-right">Já Pago</th>
                    <th className="px-6 py-4 text-right">Restante</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reservasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center text-[#edd9c4] text-sm">
                        {busca.trim()
                          ? 'Nenhum resultado para essa busca neste mês.'
                          : 'Nenhuma reserva ou faturamento operacional neste período.'}
                      </td>
                    </tr>
                  ) : (
                    reservasFiltradas.map(item => {
                      const restante = calcValorRestante(item.valor_total_real, item.valor_em_reserva)
                      const aPagar = calcValorAPagarDaReserva(item.valor_em_reserva, item.total_pago)
                      const status = getStatusReserva(item.valor_total_real, item.total_pago)
                      const virtual = isCaixaDestinatarioVirtual(item.destinatario_id)

                      return (
                        <tr key={item.destinatario_id} className="group hover:bg-white/[0.02] transition-colors text-[0.85rem]">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-cream">{item.destinatario_nome}</div>
                            <div className="text-[0.7rem] text-[#edd9c4] uppercase tracking-tighter">
                              {item.destinatario_nome?.toLowerCase().startsWith('comissão:')
                                ? 'Comissão'
                                : item.tipo_destinatario === 'marceneiro'
                                  ? 'Prestador'
                                  : item.tipo_destinatario}
                              {virtual && (
                                <span className="ml-1 normal-case text-amber-400/90">· cadastre em Destinatários</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#d4bc9f]">
                            {item.data_vencimento ? new Date(item.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td className="px-6 py-4 text-center text-cream/70 font-mono">
                            {item.totalLancamentosMes}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-cream/90">
                            <button
                              type="button"
                              title="Clique para ajustar o valor real (Contas a Pagar)"
                              onClick={() => void abrirAjusteValorReal(item)}
                              className="ml-auto block w-full cursor-pointer rounded px-1 py-0.5 text-right transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f2d892]/40"
                            >
                              {fmtCur(item.valor_total_real)}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-cream/60">
                            <CaixaValorEditavel
                              valor={item.valor_em_reserva}
                              editavel={!virtual}
                              className="text-cream/60"
                              title="Clique para ajustar o valor reservado"
                              onSave={async novoValor => {
                                await ajustarTotalConsolidado({
                                  destinatarioId: item.destinatario_id,
                                  mes: item.mes_referencia,
                                  ano: item.ano_referencia,
                                  tipo: 'reserva',
                                  novoTotal: novoValor,
                                })
                              }}
                            />
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-red-400">
                            <CaixaValorEditavel
                              valor={item.total_pago}
                              editavel={!virtual}
                              emptyLabel="—"
                              className="text-red-400"
                              title="Clique para ajustar o valor já pago"
                              onSave={async novoValor => {
                                await ajustarTotalConsolidado({
                                  destinatarioId: item.destinatario_id,
                                  mes: item.mes_referencia,
                                  ano: item.ano_referencia,
                                  tipo: 'pagamento',
                                  novoTotal: novoValor,
                                })
                              }}
                            />
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-[#f2d892]">
                            {fmtCur(restante)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {status ? <Badge status={status} /> : null}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {item.valor_em_reserva > 0 && !virtual ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs text-[#edd9c4] hover:text-cream hover:bg-white/5"
                                  disabled={desfazendoId === item.destinatario_id}
                                  title="Remove a reserva do caixa e devolve a conta para a pagar"
                                  onClick={() => void handleDesfazerReserva(item)}
                                >
                                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                                  {desfazendoId === item.destinatario_id ? 'Desfazendo…' : 'Desfazer'}
                                </Button>
                              ) : null}
                              {status !== 'pago' && !virtual ? (
                                <button
                                  type="button"
                                  title={
                                    aPagar > 0
                                      ? `Pagar ${fmtCur(aPagar)} (reservado − já pago)`
                                      : 'Registrar pagamento'
                                  }
                                  onClick={() => setPagarReserva(item)}
                                  className={cn(
                                    'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-all',
                                    'border-[#f2d892]/35 bg-[#f2d892]/10 text-[#f2d892]',
                                    'hover:border-[#f2d892]/55 hover:bg-[#f2d892]/18 hover:text-[#f8e6b0]',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d892]/40',
                                    'active:scale-[0.98]',
                                  )}
                                >
                                  <span className="shrink-0 tracking-wide">Pagar</span>
                                  {aPagar > 0 ? (
                                    <span className="inline-flex min-w-0 items-center rounded-full bg-[#2a1812]/55 px-2 py-0.5 font-mono text-[0.7rem] font-bold tabular-nums text-[#f2d892] ring-1 ring-[#f2d892]/25">
                                      {fmtCur(aPagar)}
                                    </span>
                                  ) : null}
                                </button>
                              ) : null}
                              {!virtual ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs text-[#edd9c4] hover:text-cream hover:bg-white/5"
                                  title="Comprovante de que pagamos ao destinatário"
                                  onClick={() => abrirComprovante(item)}
                                >
                                  <FileText className="mr-1 h-3.5 w-3.5" />
                                  Comprovante
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-400/10"
                                disabled={excluindoId === item.destinatario_id}
                                title="Excluir esta conta do Caixa e de Contas a Pagar neste mês"
                                onClick={() => void handleExcluirLinha(item)}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                {excluindoId === item.destinatario_id ? 'Excluindo…' : 'Excluir'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {reservasFiltradas.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-[rgba(240,210,140,.25)] bg-[rgba(240,210,140,.06)] text-[0.85rem]">
                      <td className="px-6 py-4 font-bold text-[#f2d892]" colSpan={3}>
                        Total
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-cream">
                        {fmtCur(totaisReservas.valorReal)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-cream">
                        {fmtCur(totaisReservas.reservado)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-400">
                        {fmtCur(totaisReservas.pago)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-[#f2d892]">
                        {fmtCur(totaisReservas.restante)}
                      </td>
                      <td className="px-6 py-4" />
                      <td className="px-6 py-4 text-right">
                        <div
                          className="ml-auto inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[#f2d892]/35 bg-[#f2d892]/10 px-2.5 text-xs font-semibold text-[#f2d892]"
                          title="Soma de todos os saldos a pagar (reservado − já pago)"
                        >
                          <span className="shrink-0 tracking-wide">A pagar</span>
                          <span className="inline-flex min-w-0 items-center rounded-full bg-[#2a1812]/55 px-2 py-0.5 font-mono text-[0.7rem] font-bold tabular-nums text-[#f2d892] ring-1 ring-[#f2d892]/25">
                            {fmtCur(totaisReservas.aPagar)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {tab === 'movimentacoes' && (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead
                  className={
                    embedded
                      ? 'sticky top-0 z-10 bg-[rgba(28,16,10,0.96)] backdrop-blur-sm'
                      : undefined
                  }
                >
                  <tr className="border-b border-white/5 text-[0.65rem] uppercase tracking-wider text-[#edd9c4] font-bold">
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Destinatário</th>
                    <th className="px-6 py-4">Descrição</th>
                    <th className="px-6 py-4 text-right">Valor</th>
                    <th className="px-6 py-4 text-center">Tipo</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimentacoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-[#edd9c4] text-sm">
                        {busca.trim()
                          ? 'Nenhum resultado para essa busca neste mês.'
                          : 'Nenhuma movimentação registrada neste período.'}
                      </td>
                    </tr>
                  ) : (
                    movimentacoesFiltradas.map(mov => (
                      <tr key={mov.id} className="group hover:bg-white/[0.02] transition-colors text-[0.85rem]">
                        <td className="px-6 py-4 text-[#d4bc9f]">
                          {new Date(mov.data_movimentacao + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-cream">
                          {mov.movelaria_caixa_destinatarios?.nome || '—'}
                        </td>
                        <td className="px-6 py-4 text-[#edd9c4]">
                          {mov.descricao || '—'}
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-right font-bold",
                          mov.tipo_movimentacao === 'reserva' ? "text-cream" : "text-red-400"
                        )}>
                          {mov.tipo_movimentacao === 'pagamento' ? '-' : ''}{fmtCur(mov.valor)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {mov.tipo_movimentacao === 'reserva' ? (
                            <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <ArrowUpRight className="w-2.5 h-2.5" />
                              RESERVA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                              <ArrowDownLeft className="w-2.5 h-2.5" />
                              PAGAMENTO
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-400/10"
                            disabled={excluindoId === mov.id}
                            title="Excluir esta movimentação"
                            onClick={() => void handleExcluirMovimentacao(mov)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            {excluindoId === mov.id ? 'Excluindo…' : 'Excluir'}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {tab === 'historico' && (
              <div className="p-20 text-center text-[#edd9c4] text-sm">
                Aba de Histórico em implementação...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <GerenciarDestinatariosDialog
        open={destinatariosOpen}
        onOpenChange={setDestinatariosOpen}
      />
      
      <RegistrarMovimentacaoDialog
        open={novaMovOpen}
        onOpenChange={setNovaMovOpen}
        mesInicial={mes}
        anoInicial={ano}
      />

      <PagarReservaDialog
        open={!!pagarReserva}
        onOpenChange={open => !open && setPagarReserva(null)}
        reserva={pagarReserva}
      />

      <AjustarValorRealDialog
        open={!!valorRealReserva}
        reserva={valorRealReserva}
        contas={contasValorReal}
        loadingContas={loadingContasValorReal}
        onClose={() => {
          setValorRealReserva(null)
          setContasValorReal([])
        }}
        onConfirm={async novoTotal => {
          if (!valorRealReserva) return
          await ajustarValorReal({
            destinatarioNome: valorRealReserva.destinatario_nome,
            mes: valorRealReserva.mes_referencia,
            ano: valorRealReserva.ano_referencia,
            novoTotal,
          })
        }}
      />

      <SaldoDisponivelDialog
        open={saldoDialogOpen}
        onOpenChange={setSaldoDialogOpen}
        mesInicial={mes}
        anoInicial={ano}
      />

      <CaixaComprovantePrintModal
        open={!!comprovanteReserva}
        reserva={comprovanteReserva}
        reciboConfig={reciboHook.config}
        onClose={() => setComprovanteReserva(null)}
      />
    </div>
  )
}
