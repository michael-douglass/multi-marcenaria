import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FinanceiroStats, DadoGraficoMensal, DadoGraficoComparativo } from '@/types'
import { startOfMonth, endOfMonth, format, addMonths } from 'date-fns'

export function useFinanceiroStats() {
  return useQuery<FinanceiroStats>({
    queryKey: ['financeiro-stats', 'v2-saldo-mes'],
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const now = new Date()
      const firstDayMes = format(startOfMonth(now), 'yyyy-MM-dd')
      const lastDayMes = format(endOfMonth(now), 'yyyy-MM-dd')
      const todayStr = format(now, 'yyyy-MM-dd')

      const firstDayProxMes = format(startOfMonth(addMonths(now, 1)), 'yyyy-MM-dd')
      const lastDayProxMes = format(endOfMonth(addMonths(now, 1)), 'yyyy-MM-dd')

      // 1. Clientes Ativos
      const { count: clientesAtivos } = await supabase
        .from('movelaria_clientes')
        .select('*', { count: 'exact', head: true })

      // 2. A Receber Este Mês (pendentes com vencimento no mês)
      const { data: aReceberData } = await supabase
        .from('movelaria_contas_receber')
        .select('valor_parcela')
        .eq('status', 'pendente')
        .gte('data_vencimento', firstDayMes)
        .lte('data_vencimento', lastDayMes)
      
      const totalAReceber = (aReceberData ?? []).reduce((acc, curr) => acc + Number(curr.valor_parcela), 0)

      // 2b. A Pagar Este Mês (pendentes / parcial com vencimento no mês)
      const { data: aPagarData } = await supabase
        .from('movelaria_contas_pagar')
        .select('valor_parcela, valor_pago, status')
        .in('status', ['pendente', 'parcialmente_pago'])
        .gte('data_vencimento', firstDayMes)
        .lte('data_vencimento', lastDayMes)

      const totalAPagarMes = (aPagarData ?? []).reduce((acc, curr) => {
        const parcela = Number(curr.valor_parcela)
        const pago = Number(curr.valor_pago ?? 0)
        return acc + Math.max(0, parcela - pago)
      }, 0)

      const saldoMes = totalAReceber - totalAPagarMes

      // 3. Recebido Este Mês (status recebido com data_recebimento no mês)
      const { data: recebidoData } = await supabase
        .from('movelaria_contas_receber')
        .select('valor_parcela')
        .eq('status', 'recebido')
        .gte('data_recebimento', firstDayMes)
        .lte('data_recebimento', lastDayMes)

      const totalRecebidoMes = (recebidoData ?? []).reduce((acc, curr) => acc + Number(curr.valor_parcela), 0)

      // 4. Atrasado (pendentes com vencimento < hoje)
      const { data: atrasadoData } = await supabase
        .from('movelaria_contas_receber')
        .select('valor_parcela')
        .eq('status', 'pendente')
        .lt('data_vencimento', todayStr)

      const totalAtrasado = (atrasadoData ?? []).reduce((acc, curr) => acc + Number(curr.valor_parcela), 0)

      // 5. Previsão Próximo Mês (contas a receber pendentes no próx mês)
      const { data: proxMesData } = await supabase
        .from('movelaria_contas_receber')
        .select('valor_parcela')
        .eq('status', 'pendente')
        .gte('data_vencimento', firstDayProxMes)
        .lte('data_vencimento', lastDayProxMes)

      const previsaoProximoMes = (proxMesData ?? []).reduce((acc, curr) => acc + Number(curr.valor_parcela), 0)

      // 6. Novos Clientes Mês
      const { data: novosClientesData, count: novosClientesMes } = await supabase
        .from('movelaria_orcamentos_fechados')
        .select('valor_total', { count: 'exact' })
        .gte('criado_em', firstDayMes + 'T00:00:00')
        .lte('criado_em', lastDayMes + 'T23:59:59')

      const ticketMedio = novosClientesMes && novosClientesMes > 0
        ? (novosClientesData ?? []).reduce((acc, curr) => acc + Number(curr.valor_total), 0) / novosClientesMes
        : 0

      // 7. Ticket Médio Geral (todas as parcelas do mês / qtd)
      const { data: todasParcelasMes } = await supabase
        .from('movelaria_contas_receber')
        .select('valor_parcela')
        .gte('data_vencimento', firstDayMes)
        .lte('data_vencimento', lastDayMes)
      
      const ticketMedioGeral = todasParcelasMes && todasParcelasMes.length > 0
        ? todasParcelasMes.reduce((acc, curr) => acc + Number(curr.valor_parcela), 0) / todasParcelasMes.length
        : 0

      // 8. Despesas Próximo Mês (pendentes / parcial com vencimento no próx mês)
      const { data: despesasProxData } = await supabase
        .from('movelaria_contas_pagar')
        .select('valor_parcela, valor_pago, status')
        .in('status', ['pendente', 'parcialmente_pago'])
        .gte('data_vencimento', firstDayProxMes)
        .lte('data_vencimento', lastDayProxMes)

      const despesasProximoMes = (despesasProxData ?? []).reduce((acc, curr) => {
        const parcela = Number(curr.valor_parcela)
        const pago = Number(curr.valor_pago ?? 0)
        return acc + Math.max(0, parcela - pago)
      }, 0)

      const saldoProximoMes = previsaoProximoMes - despesasProximoMes

      // 9. Previsão Ano (Simplificada: soma pagos no ano / meses passados * 12)
      const startOfYear = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd')
      const { data: pagosNoAno } = await supabase
        .from('movelaria_contas_receber')
        .select('valor_parcela, data_recebimento')
        .eq('status', 'recebido')
        .gte('data_recebimento', startOfYear)
        .lte('data_recebimento', todayStr)

      const totalPagosAno = (pagosNoAno ?? []).reduce((acc, curr) => acc + Number(curr.valor_parcela), 0)
      const mesesPassados = now.getMonth() + 1
      const previsaoAno = (totalPagosAno / mesesPassados) * 12

      // 10. Receita Líquida Ano (Recebido - Pago no ano)
      const { data: pagosDespesasAno } = await supabase
        .from('movelaria_contas_pagar')
        .select('valor_parcela')
        .eq('status', 'pago')
        .gte('data_pagamento', startOfYear)
        .lte('data_pagamento', todayStr)
      
      const totalDespesasPagasAno = (pagosDespesasAno ?? []).reduce((acc, curr) => acc + Number(curr.valor_parcela), 0)
      const receitaLiquidaAno = totalPagosAno - totalDespesasPagasAno

      return {
        clientesAtivos: clientesAtivos ?? 0,
        clientesPendentesContrato: 0, // Placeholder
        totalAReceber,
        totalAPagarMes,
        saldoMes,
        totalRecebidoMes,
        totalAtrasado,
        previsaoProximoMes,
        saldoProximoMes,
        previsaoAno,
        despesasProximoMes,
        ticketMedio,
        ticketMedioGeral,
        receitaLiquidaAno,
        novosClientesMes: novosClientesMes ?? 0
      }
    }
  })
}

export function useGraficoReceitasMensal(ano: number = new Date().getFullYear()) {
  return useQuery<DadoGraficoMensal[]>({
    queryKey: ['grafico-receitas-mensal', ano, 'v2'],
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const data: DadoGraficoMensal[] = meses.map(m => ({ mes: m, valor: 0 }))

      const start = `${ano}-01-01`
      const end = `${ano}-12-31`

      const { data: receitas } = await supabase
        .from('movelaria_contas_receber')
        .select('valor_parcela, data_recebimento')
        .eq('status', 'recebido')
        .gte('data_recebimento', start)
        .lte('data_recebimento', end)

      if (receitas) {
        for (const r of receitas) {
          const mesIdx = monthIndexFromIso(r.data_recebimento)
          if (mesIdx == null) continue
          data[mesIdx].valor += Number(r.valor_parcela) || 0
        }
      }

      return data
    }
  })
}

/**
 * Despesas mensais alinhadas ao KPI "Pago (mês)" de Contas a Pagar:
 * soma o valor efetivamente pago das contas com vencimento naquele mês.
 */
export function useGraficoDespesasMensal(ano: number = new Date().getFullYear()) {
  return useQuery<DadoGraficoMensal[]>({
    queryKey: ['grafico-despesas-mensal', ano, 'v3-vencimento-pago'],
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const data: DadoGraficoMensal[] = meses.map(m => ({ mes: m, valor: 0 }))

      const start = `${ano}-01-01`
      const end = `${ano}-12-31`

      const { data: despesas } = await supabase
        .from('movelaria_contas_pagar')
        .select('valor_parcela, valor_pago, status, data_vencimento, data_pagamento')
        .in('status', ['pago', 'parcialmente_pago'])
        .gte('data_vencimento', start)
        .lte('data_vencimento', end)

      if (despesas) {
        for (const d of despesas) {
          const mesIdx = monthIndexFromIso(d.data_vencimento)
          if (mesIdx == null) continue
          data[mesIdx].valor += valorPagoEfetivo(d)
        }
      }

      return data
    }
  })
}

export interface MesSimuladorCaixa {
  mes: string
  /** Contas a receber ainda pendentes com vencimento no mês. */
  receitas: number
  /** Valor em aberto de contas a pagar (pendente/parcial) com vencimento no mês. */
  despesas: number
  /** Há contas ainda em aberto (receber ou pagar) neste mês. */
  temPrevisao: boolean
}

/**
 * Base do Simulador de Caixa: mês a mês só o que ainda tem
 * a receber e a pagar (contas em aberto por data de vencimento).
 */
export function useSimuladorCaixaMensal(ano: number = new Date().getFullYear()) {
  return useQuery<MesSimuladorCaixa[]>({
    queryKey: ['simulador-caixa-mensal', ano, 'v2-so-em-aberto'],
    // Mantém a previsão alinhada ao que o sistema tem a receber / a pagar.
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const data: MesSimuladorCaixa[] = meses.map(m => ({
        mes: m,
        receitas: 0,
        despesas: 0,
        temPrevisao: false,
      }))

      const start = `${ano}-01-01`
      const end = `${ano}-12-31`

      const [{ data: aReceberPendentes }, { data: aPagarAbertos }] = await Promise.all([
        supabase
          .from('movelaria_contas_receber')
          .select('valor_parcela, data_vencimento')
          .eq('status', 'pendente')
          .gte('data_vencimento', start)
          .lte('data_vencimento', end),
        supabase
          .from('movelaria_contas_pagar')
          .select('valor_parcela, valor_pago, status, data_vencimento')
          .in('status', ['pendente', 'parcialmente_pago'])
          .gte('data_vencimento', start)
          .lte('data_vencimento', end),
      ])

      for (const r of aReceberPendentes ?? []) {
        const mesIdx = monthIndexFromIso(r.data_vencimento)
        if (mesIdx == null) continue
        data[mesIdx].receitas += Number(r.valor_parcela) || 0
        data[mesIdx].temPrevisao = true
      }

      for (const d of aPagarAbertos ?? []) {
        const mesIdx = monthIndexFromIso(d.data_vencimento)
        if (mesIdx == null) continue
        const parcela = Number(d.valor_parcela) || 0
        const emAberto = Math.max(0, parcela - Number(d.valor_pago ?? 0))
        if (emAberto <= 0) continue
        data[mesIdx].despesas += emAberto
        data[mesIdx].temPrevisao = true
      }

      return data.map(m => ({
        ...m,
        receitas: roundMoney(m.receitas),
        despesas: roundMoney(m.despesas),
      }))
    },
  })
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/** Índice do mês (0–11) a partir de YYYY-MM-DD, sem efeito de fuso. */
function monthIndexFromIso(iso: string | null | undefined): number | null {
  if (!iso || iso.length < 7) return null
  const month = Number(iso.slice(5, 7))
  if (!Number.isFinite(month) || month < 1 || month > 12) return null
  return month - 1
}

function valorPagoEfetivo(conta: {
  valor_parcela?: number | null
  valor_pago?: number | null
  status?: string | null
}): number {
  const pago = Number(conta.valor_pago ?? 0)
  if (pago > 0) return pago
  if (conta.status === 'pago') return Number(conta.valor_parcela ?? 0) || 0
  return 0
}
