import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { TipoObra, TipoObraInput } from '../types'
import { useAuthReady } from './useAuthReady'

export function useTiposObra() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<TipoObra[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isReady) return
    const { data: rows } = await supabase
      .from('movelaria_tipos_obra')
      .select('*')
      .order('nome')
    setData((rows ?? []) as TipoObra[])
    setLoading(false)
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const create = async (input: TipoObraInput) => {
    const { error: err } = await supabase.from('movelaria_tipos_obra').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const update = async (id: string, input: Partial<TipoObraInput>) => {
    const { error: err } = await supabase
      .from('movelaria_tipos_obra')
      .update(input)
      .eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_tipos_obra').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(t => t.id !== id))
  }

  return { data, loading, create, update, remove, reload: load }
}
