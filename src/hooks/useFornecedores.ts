import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Fornecedor, FornecedorInput } from '../types'

export function useFornecedores() {
  const [data, setData] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('movelaria_fornecedores')
      .select('*')
      .order('criado_em', { ascending: false })
    if (err) setError(err.message)
    else setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: FornecedorInput): Promise<Fornecedor> => {
    const { data: row, error: err } = await supabase
      .from('movelaria_fornecedores')
      .insert(input)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setData(prev => [row, ...prev])
    return row
  }

  const update = async (id: string, input: Partial<FornecedorInput>): Promise<Fornecedor> => {
    const { data: row, error: err } = await supabase
      .from('movelaria_fornecedores')
      .update({ ...input, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? row : x)))
    return row
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_fornecedores').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(x => x.id !== id))
  }

  return { data, loading, error, create, update, remove, reload: load }
}
