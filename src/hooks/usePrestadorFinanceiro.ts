import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAnterior, resumoFromItens, sumPrestadorItens } from '@/lib/prestador-financeiro'
import type { PrestadorFinanceiroItem } from '@/types'
import { useAuthReady } from './useAuthReady'

export interface PrestadorComparativoMes {
  recebidoMesPassado: number
  aReceberEsteMes: number
  mesPassadoLabel: string
  mesAtualLabel: string
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

async function fetchPrestadorMes(mes: number, ano: number): Promise<PrestadorFinanceiroItem[]> {
  const { data: rows, error } = await supabase.rpc('movelaria_prestador_financeiro', {
    p_mes: mes,
    p_ano: ano,
  })
  if (error) throw error
  return (rows ?? []) as PrestadorFinanceiroItem[]
}

export function usePrestadorFinanceiro(mes: number, ano: number) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<PrestadorFinanceiroItem[]>([])
  const [comparativo, setComparativo] = useState<PrestadorComparativoMes>({
    recebidoMesPassado: 0,
    aReceberEsteMes: 0,
    mesPassadoLabel: '',
    mesAtualLabel: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const hoje = new Date()
      const mesAtual = hoje.getMonth() + 1
      const anoAtual = hoje.getFullYear()
      const ant = mesAnterior(mesAtual, anoAtual)

      const [periodoRows, mesPassadoRows, mesAtualRows] = await Promise.all([
        fetchPrestadorMes(mes, ano),
        fetchPrestadorMes(ant.mes, ant.ano),
        fetchPrestadorMes(mesAtual, anoAtual),
      ])

      setData(periodoRows)
      setComparativo({
        recebidoMesPassado: sumPrestadorItens(
          mesPassadoRows,
          i => i.tipo === 'pagamento' && i.status === 'pago',
        ),
        aReceberEsteMes: sumPrestadorItens(
          mesAtualRows,
          i => i.tipo === 'previsto' || (i.tipo === 'pagamento' && i.status !== 'pago'),
        ),
        mesPassadoLabel: MONTHS_SHORT[ant.mes - 1] ?? '',
        mesAtualLabel: MONTHS_SHORT[mesAtual - 1] ?? '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar financeiro.')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isReady, mes, ano])

  useEffect(() => { void load() }, [load])

  const resumo = useMemo(() => resumoFromItens(data), [data])

  return { data, resumo, comparativo, loading, error, reload: load }
}
