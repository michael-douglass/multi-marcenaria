import { useCallback, useEffect, useState } from 'react'
import { fetchRepConfig, salvarRepConfig, uploadRepCertificado } from '@/lib/rep-config'
import { useAuthReady } from './useAuthReady'
import type { RepConfig, RepConfigInput } from '@/types'

export function useRepConfig() {
  const { isReady } = useAuthReady()
  const [config, setConfig] = useState<RepConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const row = await fetchRepConfig()
      setConfig(row)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar configuração REP-P.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const salvar = async (
    input: RepConfigInput,
    options?: { certificadoArquivo?: File | null; atualizarSenha?: boolean },
  ) => {
    setSaving(true)
    setError(null)
    try {
      let certificadoPath = input.certificado_path ?? config?.certificado_path ?? null
      if (options?.certificadoArquivo) {
        certificadoPath = await uploadRepCertificado(options.certificadoArquivo)
      }

      const saved = await salvarRepConfig(
        { ...input, certificado_path: certificadoPath },
        {
          atualizarSenha:
            (options?.atualizarSenha && !!input.certificado_senha?.trim()) ||
            !!options?.certificadoArquivo,
        },
      )
      setConfig(saved)
      return saved
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar configuração.'
      setError(msg)
      throw e
    } finally {
      setSaving(false)
    }
  }

  return { config, loading, saving, error, salvar, reload: load }
}
