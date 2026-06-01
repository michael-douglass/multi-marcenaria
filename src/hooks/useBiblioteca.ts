import { useCallback, useEffect, useState } from 'react'
import { fetchBibliotecaItems, removeBibliotecaItemById } from '@/lib/biblioteca'
import type { BibliotecaItem } from '@/types'
import { useAutoRefresh } from './useAutoRefresh'
import { useAuthReady } from './useAuthReady'

export function useBiblioteca() {
  const { isReady } = useAuthReady()
  const [items, setItems] = useState<BibliotecaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return

    setLoading(true)
    setError(null)
    try {
      setItems(await fetchBibliotecaItems())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar biblioteca.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => {
    load()
  }, [load])
  useAutoRefresh(load)

  const remove = async (anexoId: string) => {
    try {
      await removeBibliotecaItemById(anexoId)
      setItems(prev => prev.filter(i => i.anexoId !== anexoId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir arquivo.')
    }
  }

  return { items, loading, error, reload: load, remove }
}
