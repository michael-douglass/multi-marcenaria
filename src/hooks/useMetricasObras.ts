import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MetricaObra } from '../types'
import { useAuthReady } from './useAuthReady'

export function useMetricasObras() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<MetricaObra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase.rpc('movelaria_metricas_obras')
      if (err) throw err
      setData((rows ?? []) as MetricaObra[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar métricas.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  return { data, loading, error, reload: load }
}
