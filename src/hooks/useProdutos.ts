import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Produto, ProdutoInput } from '../types'
import { useAutoRefresh } from './useAutoRefresh'
import { useAuthReady } from './useAuthReady'

export function useProdutos() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return

    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('movelaria_produtos')
      .select('*, movelaria_fornecedores(id, nome)')
      .order('criado_em', { ascending: false })
    if (err) setError(err.message)
    else setData(rows ?? [])
    setLoading(false)
  }, [isReady])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  const create = async (input: ProdutoInput): Promise<Produto> => {
    const { data: row, error: err } = await supabase
      .from('movelaria_produtos')
      .insert(input)
      .select('*, movelaria_fornecedores(id, nome)')
      .single()
    if (err) throw new Error(err.message)
    setData(prev => [row, ...prev])
    return row
  }

  const update = async (id: string, input: Partial<ProdutoInput>): Promise<Produto> => {
    const { data: row, error: err } = await supabase
      .from('movelaria_produtos')
      .update({ ...input, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select('*, movelaria_fornecedores(id, nome)')
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? row : x)))
    return row
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_produtos').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(x => x.id !== id))
  }

  return { data, loading, error, create, update, remove, reload: load }
}
