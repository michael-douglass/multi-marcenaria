import { useCallback, useEffect, useState } from 'react'
import { fetchControlePontoDiario, pontoDataLocal } from '@/lib/funcionario-ponto'
import type { PontoControleFuncionarioRow } from '@/types'
import { useAuthReady } from './useAuthReady'

interface UseControlePontoDiarioOptions {
  /** Quando false, não busca dados (evita RPC sem permissão). */
  enabled?: boolean
}

export function useControlePontoDiario(
  initialDate?: string,
  options?: UseControlePontoDiarioOptions,
) {
  const enabled = options?.enabled ?? true
  const { isReady } = useAuthReady()
  const [data, setData] = useState(initialDate ?? pontoDataLocal())
  const [rows, setRows] = useState<PontoControleFuncionarioRow[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !enabled) return
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
  }, [isReady, enabled, data])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setRows([])
      setError(null)
      return
    }
    void load()
  }, [load, enabled])

  return { data, setData, rows, loading, error, reload: load }
}
