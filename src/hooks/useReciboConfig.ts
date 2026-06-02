import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthReady } from './useAuthReady'

export interface ReciboConfig {
  id: string
  cnpj: string
  template_texto: string
  ativo: boolean
}

export function useReciboConfig() {
  const { isReady } = useAuthReady()
  const [config, setConfig] = useState<ReciboConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('movelaria_recibo_config')
      .select('*')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    if (err) setError(err.message)
    else { setConfig(data ?? null); setError(null) }
    setLoading(false)
  }, [isReady])

  useEffect(() => { load() }, [load])

  const salvar = async (input: {
    cnpj: string
    template_texto: string
  }) => {
    setSaving(true)
    setError(null)
    try {
      if (config) {
        const { data: updated, error: err } = await supabase
          .from('movelaria_recibo_config')
          .update({ ...input, atualizado_em: new Date().toISOString() })
          .eq('id', config.id)
          .select()
          .single()
        if (err) throw new Error(err.message)
        setConfig(updated as ReciboConfig)
      } else {
        const { data: inserted, error: err } = await supabase
          .from('movelaria_recibo_config')
          .insert({ ...input, ativo: true })
          .select()
          .single()
        if (err) throw new Error(err.message)
        setConfig(inserted as ReciboConfig)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar.'
      setError(msg)
      throw e
    } finally {
      setSaving(false)
    }
  }

  return { config, loading, saving, error, salvar, reload: load }
}
