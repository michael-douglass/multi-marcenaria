import { useCallback, useEffect, useState } from 'react'
import {
  fetchMontadorComissaoObras,
  type MontadorComissaoObra,
} from '@/lib/metricas-montador-comissao'
import { useAuthReady } from './useAuthReady'

export function usePrestadorObrasFinalizando(mes: number, ano: number) {
  const { isReady, userProfile } = useAuthReady()
  const [obras, setObras] = useState<MontadorComissaoObra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !userProfile?.id) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchMontadorComissaoObras({ mes, ano }, userProfile.id)
      setObras(rows.filter(o => o.situacao === 'em_aberto'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar obras em finalização.')
      setObras([])
    } finally {
      setLoading(false)
    }
  }, [isReady, userProfile?.id, mes, ano])

  useEffect(() => { void load() }, [load])

  return { obras, loading, error, reload: load }
}
