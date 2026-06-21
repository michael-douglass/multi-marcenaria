import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_VISUALIZACAO_PAINEL_IDS,
  getVisualizacaoPaineisVisiveis,
  normalizeVisualizacaoPaineisSalvos,
  type VisualizacaoPainelId,
} from '@/lib/visualizacao-paineis'
import { useAuthReady } from './useAuthReady'

const CONFIG_CHAVE = 'default'

export function useVisualizacaoConfig() {
  const { isReady } = useAuthReady()
  const [salvos, setSalvos] = useState<VisualizacaoPainelId[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('movelaria_visualizacao_config')
        .select('paineis_visiveis')
        .eq('chave', CONFIG_CHAVE)
        .maybeSingle()

      if (err) throw err
      setSalvos(normalizeVisualizacaoPaineisSalvos(data?.paineis_visiveis))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar painéis da visualização.')
      setSalvos(null)
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
