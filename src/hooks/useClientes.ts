import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Cliente, ClienteInput } from '../types'
import { useAutoRefresh } from './useAutoRefresh'
import { useAuthReady } from './useAuthReady'

export function useClientes() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return

    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('movelaria_clientes')
        .select('*')
        .order('data_cadastro', { ascending: false, nullsFirst: false })
        .order('criado_em', { ascending: false })
      if (err) throw err
      setData(rows ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(load)

  const create = async (input: ClienteInput): Promise<Cliente> => {
    const { data: row, error: err } = await supabase
      .from('movelaria_clientes')
      .insert(input)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setData(prev => [row, ...prev])
    return row
  }

  const update = async (id: string, input: Partial<ClienteInput>): Promise<Cliente> => {
    const { data: row, error: err } = await supabase
      .from('movelaria_clientes')
      .update({ ...input, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? row : x)))
    return row
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_clientes').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(x => x.id !== id))
  }

  return { data, loading, error, create, update, remove, reload: load }
}
