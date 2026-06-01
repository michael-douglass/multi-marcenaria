import { useState } from 'react'
import { Plus, Users, History, Receipt, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useCaixa } from '@/hooks/useCaixa'
import { fmtCur, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { GerenciarDestinatariosDialog } from '@/components/caixa/GerenciarDestinatariosDialog'
import { RegistrarMovimentacaoDialog } from '@/components/caixa/RegistrarMovimentacaoDialog'
import { PagarReservaDialog } from '@/components/caixa/PagarReservaDialog'
import type { ReservaConsolidada } from '@/types'

export function Caixa() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const { resumo, loading, reservasConsolidadas, movimentacoes } = useCaixa(mes, ano)
  const [tab, setTab] = useState<'reservas' | 'movimentacoes' | 'historico'>('reservas')

  // Dialogs
  const [destinatariosOpen, setDestinatariosOpen] = useState(false)
  const [novaMovOpen, setNovaMovOpen] = useState(false)
  const [pagarReserva, setPagarReserva] = useState<ReservaConsolidada | null>(null)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Resumo */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-cream">Caixa de Pagamentos</h1>
          <p className="text-[0.9rem] text-[#8a6a55]">
            Controle de valores reservados e pagamentos efetuados.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="glass-input !h-9 !text-xs !w-32"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="glass-input !h-9 !text-xs !w-24"
          >
            {Array.from({ length: 10 }, (_, i) => {
              const year = new Date().getFullYear() - 2 + i
              return <option key={year} value={year}>{year}</option>
            })}
          </select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-4 space-y-2">
          <p className="text-[0.7rem] uppercase tracking-wider text-[#8a6a55] font-bold">Total Reservado</p>
          <p className="text-xl font-bold text-cream">{fmtCur(resumo.total_reservado)}</p>
        </div>
        <div className="glass-card p-4 space-y-2 border-l-2 border-l-red-500/30">
          <p className="text-[0.7rem] uppercase tracking-wider text-[#8a6a55] font-bold">Total Pago</p>
          <p className="text-xl font-bold text-red-400">{fmtCur(resumo.total_pago)}</p>
        </div>
        <div className="glass-card p-4 space-y-2 border-l-2 border-l-emerald-500/30">
          <p className="text-[0.7rem] uppercase tracking-wider text-[#8a6a55] font-bold">Saldo Disponível</p>
          <p className="text-xl font-bold text-emerald-400">{fmtCur(resumo.saldo_disponivel)}</p>
        </div>
        <div className="glass-card p-4 space-y-2 bg-white/5">
          <p className="text-[0.7rem] uppercase tracking-wider text-[#8a6a55] font-bold">Anteriores</p>
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
              tab === 'reservas' ? "bg-[#d4a853] text-[#150c09]" : "text-[#8a6a55] hover:text-cream hover:bg-white/5"
            )}
          >
            <Receipt className="w-3.5 h-3.5" />
            Reservas
          </button>
          <button
            onClick={() => setTab('movimentacoes')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all",
              tab === 'movimentacoes' ? "bg-[#d4a853] text-[#150c09]" : "text-[#8a6a55] hover:text-cream hover:bg-white/5"
            )}
          >
            <History className="w-3.5 h-3.5" />
            Pagamentos
          </button>
          <button
            onClick={() => setTab('historico')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all",
              tab === 'historico' ? "bg-[#d4a853] text-[#150c09]" : "text-[#8a6a55] hover:text-cream hover:bg-white/5"
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
            <Users className="w-3.5 h-3.5 mr-2 text-[#d4a853]" />
            Destinatários
          </Button>
          <Button 
            className="text-xs h-9 bg-[#d4a853] text-[#150c09] hover:bg-[#b88f44]"
            onClick={() => setNovaMovOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="glass-card min-h-[400px]">
        {loading ? (
          <div className="p-20 text-center text-[#8a6a55] animate-pulse">Carregando dados...</div>
        ) : (
          <div className="overflow-x-auto">
            {tab === 'reservas' && (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/5 text-[0.65rem] uppercase tracking-wider text-[#8a6a55] font-bold">
                    <th className="px-6 py-4">Destinatário</th>
                    <th className="px-6 py-4">Vencimento</th>
                    <th className="px-6 py-4 text-center">Lanç.</th>
                    <th className="px-6 py-4 text-right">Valor Real</th>
                    <th className="px-6 py-4 text-right">Reservado</th>
                    <th className="px-6 py-4 text-right">Restante</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reservasConsolidadas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center text-[#8a6a55] text-sm">
                        Nenhuma reserva ou faturamento operacional neste período.
                      </td>
                    </tr>
                  ) : (
                    reservasConsolidadas.map(item => {
                      const restante = Math.max(0, item.valor_total_real - item.total_pago)
                      const isFullyPaid = item.total_pago >= item.valor_total_real && item.valor_total_real > 0
                      const isPartiallyPaid = item.total_pago > 0 && !isFullyPaid

                      return (
                        <tr key={item.destinatario_id} className="group hover:bg-white/[0.02] transition-colors text-[0.85rem]">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-cream">{item.destinatario_nome}</div>
                            <div className="text-[0.7rem] text-[#8a6a55] uppercase tracking-tighter">{item.tipo_destinatario}</div>
                          </td>
                          <td className="px-6 py-4 text-[#a07c65]">
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
                          <td className="px-6 py-4 text-right font-bold text-[#d4a853]">
                            {fmtCur(restante)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isFullyPaid ? (
                              <Badge variant="success">PAGO</Badge>
                            ) : isPartiallyPaid ? (
                              <Badge variant="warning">FALTANDO</Badge>
                            ) : null}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 text-xs text-[#d4a853] hover:text-[#d4a853] hover:bg-[#d4a853]/10"
                              onClick={() => setPagarReserva(item)}
                            >
                              Pagar
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}

            {tab === 'movimentacoes' && (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/5 text-[0.65rem] uppercase tracking-wider text-[#8a6a55] font-bold">
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Destinatário</th>
                    <th className="px-6 py-4">Descrição</th>
                    <th className="px-6 py-4 text-right">Valor</th>
                    <th className="px-6 py-4 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimentacoes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-[#8a6a55] text-sm">
                        Nenhuma movimentação registrada neste período.
                      </td>
                    </tr>
                  ) : (
                    movimentacoes.map(mov => (
                      <tr key={mov.id} className="group hover:bg-white/[0.02] transition-colors text-[0.85rem]">
                        <td className="px-6 py-4 text-[#a07c65]">
                          {new Date(mov.data_movimentacao + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-cream">
                          {mov.movelaria_caixa_destinatarios?.nome || '—'}
                        </td>
                        <td className="px-6 py-4 text-[#8a6a55]">
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
              <div className="p-20 text-center text-[#8a6a55] text-sm">
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
    </div>
  )
}
