import { useCallback, useEffect, useState } from 'react'
import { fetchControlePontoDiario } from '@/lib/funcionario-ponto'
import type { PontoControleFuncionarioRow } from '@/types'
import { useAuthReady } from './useAuthReady'

export function useControlePontoDiario(initialDate?: string) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState(initialDate ?? new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<PontoControleFuncionarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchControlePontoDiario(data)
      setRows(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar controle de ponto.')
    } finally {
      setLoading(false)
    }
  }, [isReady, data])

  useEffect(() => { void load() }, [load])

  return { data, setData, rows, loading, error, reload: load }
}
