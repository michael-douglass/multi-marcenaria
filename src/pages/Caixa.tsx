import { useMemo, useState } from 'react'
import { Plus, Users, History, Receipt, ArrowUpRight, ArrowDownLeft, Search } from 'lucide-react'
import { CaixaProvider, useCaixaContext } from '@/context/CaixaContext'
import { isCaixaDestinatarioVirtual } from '@/hooks/useCaixa'
import { fmtCur, cn } from '@/lib/utils'
import { LoadingState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { GerenciarDestinatariosDialog } from '@/components/caixa/GerenciarDestinatariosDialog'
import { RegistrarMovimentacaoDialog } from '@/components/caixa/RegistrarMovimentacaoDialog'
import { PagarReservaDialog } from '@/components/caixa/PagarReservaDialog'
import { SaldoDisponivelDialog } from '@/components/caixa/SaldoDisponivelDialog'
import { CaixaMesFilterBar } from '@/components/caixa/CaixaMesFilterBar'
import type { ReservaConsolidada, CaixaMovimentacao } from '@/types'

const normBusca = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

function matchBusca(q: string, ...parts: (string | number | null | undefined)[]): boolean {
  if (!q) return true
  const nq = normBusca(q)
  return parts.some(p => p != null && normBusca(String(p)).includes(nq))
}

function calcValorRestante(valorReal: number, totalPago: number) {
  return Math.max(0, valorReal - totalPago)
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
  const { resumo, loading, reservasConsolidadas, movimentacoes } = useCaixaContext()
  const [tab, setTab] = useState<'reservas' | 'movimentacoes' | 'historico'>('reservas')
  const [busca, setBusca] = useState('')

  const reservasFiltradas = useMemo(() => {
    const q = busca.trim()
    if (!q) return reservasConsolidadas
    return reservasConsolidadas.filter(item =>
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
  }, [reservasConsolidadas, busca])

  const totaisReservas = useMemo(() => {
    return reservasFiltradas.reduce(
      (acc, item) => {
        const restante = calcValorRestante(item.valor_total_real, item.total_pago)
        return {
          valorReal: acc.valorReal + item.valor_total_real,
          reservado: acc.reservado + item.valor_em_reserva,
          pago: acc.pago + item.total_pago,
          restante: acc.restante + restante,
        }
      },
      { valorReal: 0, reservado: 0, pago: 0, restante: 0 },
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

  return (
    <div className={cn('animate-in fade-in duration-500', embedded ? 'space-y-4' : 'space-y-6')}>
      {/* Header & Resumo */}
      <div
        className={cn(
          'flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
          embedded ? 'gap-3' : 'gap-6',
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

        <CaixaMesFilterBar mes={mes} ano={ano} onChange={onPeriodoChange} />
      </div>

      <div className={cn('relative', embedded ? 'max-w-full' : 'max-w-md')}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#edd9c4]" />
        <input
          className="glass-input w-full pl-9"
          placeholder="Buscar destinatário, descrição ou valor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Cards de Resumo */}
      <div className={cn('grid gap-3 sm:gap-4', embedded ? 'grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-4')}>
        <div className="glass-card p-4 space-y-2">
          <p className="text-[0.7rem] uppercase tracking-wider text-[#edd9c4] font-bold">Total Reservado</p>
          <p className="text-xl font-bold text-cream">{fmtCur(resumo.total_reservado)}</p>
        </div>
        <div className="glass-card p-4 space-y-2 border-l-2 border-l-red-500/30">
          <p className="text-[0.7rem] uppercase tracking-wider text-[#edd9c4] font-bold">Total Pago</p>
          <p className="text-xl font-bold text-red-400">{fmtCur(resumo.total_pago)}</p>
        </div>
        <button
          type="button"
          onClick={() => setSaldoDialogOpen(true)}
          className="glass-card p-4 space-y-2 border-l-2 border-l-emerald-500/30 text-left w-full cursor-pointer transition-all hover:bg-emerald-500/5 hover:border-l-emerald-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/40"
          title="Clique para ver onde o saldo está guardado"
        >
          <p className="text-[0.7rem] uppercase tracking-wider text-[#edd9c4] font-bold">Saldo Disponível</p>
          <p className="text-xl font-bold text-emerald-400">{fmtCur(resumo.saldo_disponivel)}</p>
          <p className="text-[0.65rem] text-[#edd9c4]">Clique para justificar contas →</p>
        </button>
        <div className="glass-card p-4 space-y-2 bg-white/5">
          <p className="text-[0.7rem] uppercase tracking-wider text-[#edd9c4] font-bold">Anteriores</p>
          <p className={cn("text-xl font-bold", resumo.saldo_meses_anteriores >= 0 ? "text-cream" : "text-red-400")}>
            {fmtCur(resumo.saldo_meses_anteriores)}
          </p>
        </div>
      </div>

      {/* Tabs & Ações */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex p-1 gap-1 rounded-lg bg-black/20 w-fit border border-white/5">
          <button
            onClick={() => setTab('reservas')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all",
              tab === 'reservas' ? "bg-[#f2d892] text-[#2a1812]" : "text-[#edd9c4] hover:text-cream hover:bg-white/5"
            )}
          >
            <Receipt className="w-3.5 h-3.5" />
            Reservas
          </button>
          <button
            onClick={() => setTab('movimentacoes')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all",
              tab === 'movimentacoes' ? "bg-[#f2d892] text-[#2a1812]" : "text-[#edd9c4] hover:text-cream hover:bg-white/5"
            )}
          >
            <History className="w-3.5 h-3.5" />
            Pagamentos
          </button>
          <button
            onClick={() => setTab('historico')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all",
              tab === 'historico' ? "bg-[#f2d892] text-[#2a1812]" : "text-[#edd9c4] hover:text-cream hover:bg-white/5"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Histórico
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="text-xs h-9 border-white/10 hover:bg-white/5"
            onClick={() => setDestinatariosOpen(true)}
          >
            <Users className="w-3.5 h-3.5 mr-2 text-[#f2d892]" />
            Destinatários
          </Button>
          <Button 
            className="text-xs h-9 bg-[#f2d892] text-[#2a1812] hover:bg-[#b88f44]"
            onClick={() => setNovaMovOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={cn('glass-card', embedded ? 'min-h-[280px]' : 'min-h-[400px]')}>
        {loading ? (
          <LoadingState message="Carregando dados..." />
        ) : (
          <div className="overflow-x-auto">
            {tab === 'reservas' && (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
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
                      const restante = calcValorRestante(item.valor_total_real, item.total_pago)
                      const status = getStatusReserva(item.valor_total_real, item.total_pago)
                      const virtual = isCaixaDestinatarioVirtual(item.destinatario_id)

                      return (
                        <tr key={item.destinatario_id} className="group hover:bg-white/[0.02] transition-colors text-[0.85rem]">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-cream">{item.destinatario_nome}</div>
                            <div className="text-[0.7rem] text-[#edd9c4] uppercase tracking-tighter">
                              {item.tipo_destinatario}
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
                            {fmtCur(item.valor_total_real)}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-cream/60">
                            {fmtCur(item.valor_em_reserva)}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-red-400">
                            {item.total_pago > 0 ? fmtCur(item.total_pago) : '—'}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-[#f2d892]">
                            {fmtCur(restante)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {status ? <Badge status={status} /> : null}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {status !== 'pago' && !virtual ? (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 text-xs text-[#f2d892] hover:text-[#f2d892] hover:bg-[#f2d892]/10"
                                onClick={() => setPagarReserva(item)}
                              >
                                Pagar
                              </Button>
                            ) : null}
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
                      <td className="px-6 py-4" colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {tab === 'movimentacoes' && (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/5 text-[0.65rem] uppercase tracking-wider text-[#edd9c4] font-bold">
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Destinatário</th>
                    <th className="px-6 py-4">Descrição</th>
                    <th className="px-6 py-4 text-right">Valor</th>
                    <th className="px-6 py-4 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimentacoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-[#edd9c4] text-sm">
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

      <SaldoDisponivelDialog
        open={saldoDialogOpen}
        onOpenChange={setSaldoDialogOpen}
        mesInicial={mes}
        anoInicial={ano}
      />
    </div>
  )
}
