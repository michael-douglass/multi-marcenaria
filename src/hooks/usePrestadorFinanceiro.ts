import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchPrestadorMes,
  PRESTADOR_MONTHS_SHORT,
  resumoFromItens,
} from '@/lib/prestador-financeiro'
import type { PrestadorFinanceiroItem } from '@/types'
import { useAuthReady } from './useAuthReady'

export interface PrestadorComparativoMes {
  recebidoPeriodo: number
  aReceberPeriodo: number
  periodoLabel: string
}

export function usePrestadorFinanceiro(mes: number, ano: number) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<PrestadorFinanceiroItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const periodoRows = await fetchPrestadorMes(mes, ano)
      setData(periodoRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar financeiro.')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isReady, mes, ano])

  useEffect(() => { void load() }, [load])

  const resumo = useMemo(() => resumoFromItens(data), [data])

  const comparativo = useMemo<PrestadorComparativoMes>(() => ({
    recebidoPeriodo: resumo.totalPago,
    aReceberPeriodo: resumo.totalAReceber,
    periodoLabel: `${PRESTADOR_MONTHS_SHORT[mes - 1] ?? ''} ${ano}`,
  }), [resumo.totalPago, resumo.totalAReceber, mes, ano])

  return { data, resumo, comparativo, loading, error, reload: load }
}
