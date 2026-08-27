import { useCallback, useEffect, useState } from 'react'
import { fetchControlePontoDiario, pontoDataLocal } from '@/lib/funcionario-ponto'
import {
  isCacheKeyFresh,
  pontoDiarioCacheKey,
  readCache,
  writeCache,
} from '@/lib/data-cache'
import { VISUALIZACAO_CACHE_FRESH_MS, VISUALIZACAO_POLL_MS } from '@/lib/refresh-policy'
import type { PontoControleFuncionarioRow } from '@/types'
import { useAuthReady } from './useAuthReady'
import { useAutoRefresh } from './useAutoRefresh'

interface UseControlePontoDiarioOptions {
  /** Quando false, não busca dados (evita RPC sem permissão). */
  enabled?: boolean
  /** Cache mais longo (página Visualização / TV). */
  longCache?: boolean
}

export function useControlePontoDiario(
  initialDate?: string,
  options?: UseControlePontoDiarioOptions,
) {
  const enabled = options?.enabled ?? true
  const longCache = options?.longCache ?? false
  const { isReady } = useAuthReady()
  const [data, setData] = useState(initialDate ?? pontoDataLocal())
  const cacheKey = pontoDiarioCacheKey(data)
  const [rows, setRows] = useState<PontoControleFuncionarioRow[]>(() =>
    enabled ? (readCache<PontoControleFuncionarioRow[]>(cacheKey)?.value ?? []) : [],
  )
  const [loading, setLoading] = useState(() => enabled && readCache(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (!isReady || !enabled) return
    if (
      !opts?.force
      && longCache
      && isCacheKeyFresh(cacheKey, Date.now(), VISUALIZACAO_CACHE_FRESH_MS)
    ) {
      const cached = readCache<PontoControleFuncionarioRow[]>(cacheKey)?.value
      if (cached) setRows(cached)
      setLoading(false)
      return
    }
    const hasCache = readCache(cacheKey) != null
    if (!opts?.silent && !hasCache) setLoading(true)
    setError(null)
    try {
      const result = await fetchControlePontoDiario(data)
      writeCache(cacheKey, result)
      setRows(result)
    } catch (e) {
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar controle de ponto.')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, enabled, data, cacheKey, longCache])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setRows([])
      setError(null)
      return
    }
    void load({ silent: readCache(cacheKey) != null })
  }, [load, enabled, cacheKey])

  useAutoRefresh(
    () => { void load({ silent: true }) },
    enabled && longCache ? VISUALIZACAO_POLL_MS : 0,
  )

  const reload = useCallback(
    (opts?: { silent?: boolean }) => load({ silent: opts?.silent, force: true }),
    [load],
  )

  return { data, setData, rows, loading, error, reload }
}
