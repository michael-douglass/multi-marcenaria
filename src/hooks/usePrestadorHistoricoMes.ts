import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchPrestadorMes, resumoFromItens } from '@/lib/prestador-financeiro'
import { useAuthReady } from './useAuthReady'

/** Carrega itens de um mês para os cards de histórico (a receber / recebidas). */
export function usePrestadorHistoricoMes(mes: number, ano: number) {
  const { isReady } = useAuthReady()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPrestadorMes>>>([])

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchPrestadorMes(mes, ano)
      setData(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico.')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isReady, mes, ano])

  useEffect(() => { void load() }, [load])

  const resumo = useMemo(() => resumoFromItens(data), [data])

  return {
    aReceber: resumo.aReceber,
    recebidas: resumo.recebidas,
    loading,
    error,
    reload: load,
  }
}
