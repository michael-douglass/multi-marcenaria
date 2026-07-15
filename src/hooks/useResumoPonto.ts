import { useCallback, useEffect, useState } from 'react'
import { fetchResumoPontoPeriodo } from '@/lib/funcionario-ponto'
import type { PontoResumoPeriodo, PontoResumoPeriodoPayload } from '@/types'
import { useAuthReady } from './useAuthReady'

export function useResumoPonto(initialPeriodo: PontoResumoPeriodo = 'mes') {
  const { isReady } = useAuthReady()
  const [periodo, setPeriodo] = useState<PontoResumoPeriodo>(initialPeriodo)
  const [resumo, setResumo] = useState<PontoResumoPeriodoPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchResumoPontoPeriodo(periodo)
      setResumo(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar resumo de ponto.')
      setResumo(null)
    } finally {
      setLoading(false)
    }
  }, [isReady, periodo])

  useEffect(() => {
    void load()
  }, [load])

  return { periodo, setPeriodo, resumo, loading, error, reload: load }
}
