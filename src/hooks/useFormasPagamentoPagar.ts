import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormaPagamentoPagar } from '@/types'
import { useAutoRefresh } from './useAutoRefresh'

export function useFormasPagamentoPagar() {
  const [formas, setFormas] = useState<FormaPagamentoPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('movelaria_formas_pagamento_pagar')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true })

    if (err) setError(err.message)
    else setFormas(data ?? [])
    setLoading(false)
  }, [])

  const loadAll = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('movelaria_formas_pagamento_pagar')
      .select('*')
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true })

    if (err) throw new Error(err.message)
    return data ?? []
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useAutoRefresh(load)

  const add = async (nome: string): Promise<FormaPagamentoPagar> => {
    const trimmed = nome.trim()
    if (!trimmed) throw new Error('Informe o nome da forma de pagamento.')

    const maxOrdem = formas.reduce((m, f) => Math.max(m, f.ordem), 0)
    const { data, error: err } = await supabase
      .from('movelaria_formas_pagamento_pagar')
      .insert({ nome: trimmed, ordem: maxOrdem + 1, ativo: true })
      .select()
      .single()

    if (err) {
      if (err.code === '23505') throw new Error('Esta forma de pagamento já existe.')
      throw new Error(err.message)
    }
    setFormas(prev => [...prev, data].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)))
    return data
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase
      .from('movelaria_formas_pagamento_pagar')
      .update({ ativo: false })
      .eq('id', id)

    if (err) throw new Error(err.message)
    setFormas(prev => prev.filter(f => f.id !== id))
  }

  return { formas, loading, error, reload: load, loadAll, add, remove }
}
