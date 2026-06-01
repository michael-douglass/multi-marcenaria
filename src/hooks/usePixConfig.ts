import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthReady } from './useAuthReady'

export interface PixConfig {
  id: string
  chave_pix: string
  tipo_chave: string
  nome_beneficiario: string | null
  ativo: boolean
}

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export const TIPOS_CHAVE_PIX: { value: TipoChavePix; label: string; placeholder: string }[] = [
  { value: 'cpf',       label: 'CPF',            placeholder: '000.000.000-00' },
  { value: 'cnpj',      label: 'CNPJ',           placeholder: '00.000.000/0000-00' },
  { value: 'email',     label: 'E-mail',         placeholder: 'exemplo@email.com' },
  { value: 'telefone',  label: 'Telefone',       placeholder: '+55 11 99999-9999' },
  { value: 'aleatoria', label: 'Chave aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
]

export function usePixConfig() {
  const { isReady } = useAuthReady()
  const [config, setConfig] = useState<PixConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('movelaria_pix_config')
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
    chave_pix: string
    tipo_chave: string
    nome_beneficiario?: string
  }) => {
    setSaving(true)
    setError(null)
    try {
      if (config) {
        const { data: updated, error: err } = await supabase
          .from('movelaria_pix_config')
          .update({ ...input, atualizado_em: new Date().toISOString() })
          .eq('id', config.id)
          .select()
          .single()
        if (err) throw new Error(err.message)
        setConfig(updated as PixConfig)
      } else {
        const { data: inserted, error: err } = await supabase
          .from('movelaria_pix_config')
          .insert({ ...input, ativo: true })
          .select()
          .single()
        if (err) throw new Error(err.message)
        setConfig(inserted as PixConfig)
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
