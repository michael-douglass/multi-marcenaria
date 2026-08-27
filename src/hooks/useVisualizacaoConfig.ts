import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  isCacheKeyFresh,
  readCache,
  VISUALIZACAO_CONFIG_CACHE_KEY,
  writeCache,
} from '@/lib/data-cache'
import { VISUALIZACAO_CONFIG_CACHE_FRESH_MS } from '@/lib/refresh-policy'
import {
  DEFAULT_VISUALIZACAO_PAINEL_IDS,
  getVisualizacaoPaineisVisiveis,
  normalizeVisualizacaoPaineisSalvos,
  type VisualizacaoPainelId,
} from '@/lib/visualizacao-paineis'
import { useAuthReady } from './useAuthReady'

const CONFIG_CHAVE = 'default'

function readCachedPaineis(): VisualizacaoPainelId[] | null {
  const cached = readCache<VisualizacaoPainelId[] | null>(VISUALIZACAO_CONFIG_CACHE_KEY)
  if (!cached) return null
  return normalizeVisualizacaoPaineisSalvos(cached.value)
}

export function useVisualizacaoConfig() {
  const { isReady } = useAuthReady()
  const [salvos, setSalvos] = useState<VisualizacaoPainelId[] | null>(() => readCachedPaineis())
  const [loading, setLoading] = useState(() => readCache(VISUALIZACAO_CONFIG_CACHE_KEY) == null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { force?: boolean }) => {
    if (!isReady) return
    if (
      !opts?.force
      && isCacheKeyFresh(VISUALIZACAO_CONFIG_CACHE_KEY, Date.now(), VISUALIZACAO_CONFIG_CACHE_FRESH_MS)
    ) {
      setLoading(false)
      return
    }
    const hasCache = readCache(VISUALIZACAO_CONFIG_CACHE_KEY) != null
    if (!hasCache) setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('movelaria_visualizacao_config')
        .select('paineis_visiveis')
        .eq('chave', CONFIG_CHAVE)
        .maybeSingle()

      if (err) throw err
      const next = normalizeVisualizacaoPaineisSalvos(data?.paineis_visiveis)
      writeCache(VISUALIZACAO_CONFIG_CACHE_KEY, next)
      setSalvos(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar painéis da visualização.')
      if (!hasCache) setSalvos(null)
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const paineisVisiveis = useMemo(
    () => getVisualizacaoPaineisVisiveis(salvos),
    [salvos],
  )

  const save = useCallback(async (paineis: VisualizacaoPainelId[]) => {
    setSaving(true)
    setError(null)
    try {
      const payload = paineis.length > 0 ? paineis : DEFAULT_VISUALIZACAO_PAINEL_IDS
      const { error: err } = await supabase
        .from('movelaria_visualizacao_config')
        .upsert(
          {
            chave: CONFIG_CHAVE,
            paineis_visiveis: payload,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'chave' },
        )

      if (err) throw err
      writeCache(VISUALIZACAO_CONFIG_CACHE_KEY, payload)
      setSalvos(payload)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar painéis da visualização.'
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    salvos,
    paineisVisiveis,
    loading,
    saving,
    error,
    reload: load,
    save,
  }
}
