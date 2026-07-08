import { useCallback, useEffect, useState } from 'react'
import { fetchMeuFuncionario } from '@/lib/meu-perfil-api'
import type { MeuFuncionarioPayload } from '@/types'

export function useMeuFuncionario() {
  const [data, setData] = useState<MeuFuncionarioPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const row = await fetchMeuFuncionario()
      setData(row)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar seus dados.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
