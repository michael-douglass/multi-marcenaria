import { useCallback, useEffect, useState } from 'react'
import { fetchBibliotecaItems, removeBibliotecaItemById } from '@/lib/biblioteca'
import type { BibliotecaItem } from '@/types'

export function useBiblioteca() {
  const [items, setItems] = useState<BibliotecaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchBibliotecaItems())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar biblioteca.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
