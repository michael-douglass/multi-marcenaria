import { useCallback, useEffect, useState } from 'react'
import { fetchResumoPontoPeriodo, pontoDataLocal } from '@/lib/funcionario-ponto'
import type { PontoResumoPeriodo, PontoResumoPeriodoPayload } from '@/types'
import { useAuthReady } from './useAuthReady'

function mesAtualLocal(): string {
  return pontoDataLocal().slice(0, 7)
}

export function useResumoPonto(initialPeriodo: PontoResumoPeriodo = 'mes') {
  const { isReady } = useAuthReady()
  const [periodo, setPeriodo] = useState<PontoResumoPeriodo>(initialPeriodo)
  const [mesRef, setMesRef] = useState(mesAtualLocal)
  const [resumo, setResumo] = useState<PontoResumoPeriodoPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchResumoPontoPeriodo(
        periodo,
        periodo === 'mes' ? mesRef : null,
      )
      setResumo(result)
      if (result.referencia && periodo === 'mes') {
        setMesRef(result.referencia)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar resumo de ponto.')
      setResumo(null)
    } finally {
      setLoading(false)
    }
  }, [isReady, periodo, mesRef])

  useEffect(() => {
    void load()
  }, [load])

  const escolherPeriodo = useCallback((proximo: PontoResumoPeriodo) => {
    setPeriodo(proximo)
    if (proximo === 'mes') {
      setMesRef((atual) => atual || mesAtualLocal())
    }
  }, [])

  const escolherMes = useCallback((yyyyMm: string) => {
    setPeriodo('mes')
    setMesRef(yyyyMm)
  }, [])

  return {
    periodo,
    setPeriodo: escolherPeriodo,
    mesRef,
    setMesRef: escolherMes,
    resumo,
    loading,
    error,
    reload: load,
  }
}
