import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FinanceiroStats, DadoGraficoMensal, DadoGraficoComparativo } from '@/types'
import { startOfMonth, endOfMonth, format, subMonths, addMonths, isAfter, isBefore, parseISO } from 'date-fns'

export function useFinanceiroStats() {
  return useQuery<FinanceiroStats>({
    queryKey: ['financeiro-stats'],
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

      // 8. Despesas Próximo Mês
      const { data: despesasProxData } = await supabase
        .from('movelaria_contas_pagar')
        .select('valor_parcela')
        .eq('status', 'pendente')
        .gte('data_vencimento', firstDayProxMes)
        .lte('data_vencimento', lastDayProxMes)

      const despesasProximoMes = (despesasProxData ?? []).reduce((acc, curr) => acc + Number(curr.valor_parcela), 0)

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
        totalRecebidoMes,
        totalAtrasado,
        previsaoProximoMes,
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
    queryKey: ['grafico-receitas-mensal', ano],
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
        receitas.forEach(r => {
          const date = parseISO(r.data_recebimento!)
          const mesIdx = date.getMonth()
          data[mesIdx].valor += Number(r.valor_parcela)
        })
      }

      return data
    }
  })
}

export function useGraficoDespesasMensal(ano: number = new Date().getFullYear()) {
  return useQuery<DadoGraficoMensal[]>({
    queryKey: ['grafico-despesas-mensal', ano],
    queryFn: async () => {
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const data: DadoGraficoMensal[] = meses.map(m => ({ mes: m, valor: 0 }))

      const start = `${ano}-01-01`
      const end = `${ano}-12-31`

      const { data: despesas } = await supabase
        .from('movelaria_contas_pagar')
        .select('valor_parcela, data_pagamento')
        .eq('status', 'pago')
        .gte('data_pagamento', start)
        .lte('data_pagamento', end)

      if (despesas) {
        despesas.forEach(d => {
          const date = parseISO(d.data_pagamento!)
          const mesIdx = date.getMonth()
          data[mesIdx].valor += Number(d.valor_parcela)
        })
      }

      return data
    }
  })
}
