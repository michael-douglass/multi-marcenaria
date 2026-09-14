import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { GrupoObra, GrupoObraInput, UsuarioMontador } from '../types'
import { useAuthReady } from './useAuthReady'

export function useGruposObra() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<GrupoObra[]>([])
  const [montadores, setMontadores] = useState<UsuarioMontador[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isReady) return
    const [gruposResult, montadoresResult] = await Promise.all([
      supabase.from('movelaria_grupos_obra').select('*').order('nome'),
      supabase.rpc('movelaria_listar_montadores'),
    ])
    setData((gruposResult.data ?? []) as GrupoObra[])
    setMontadores((montadoresResult.data ?? []) as UsuarioMontador[])
    setLoading(false)
  }, [isReady])

  useEffect(() => { void load() }, [load])

  // Recarrega montadores ao voltar para a aba — quem acabou de ser
  // cadastrado em Funcionários/Configurações aparece sem precisar dar F5.
  useEffect(() => {
    if (!isReady) return

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }

    const onFocus = () => { void load() }

    document.addEventListener('visibilitychange', refreshIfVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [isReady, load])

  const create = async (input: GrupoObraInput) => {
    const { error: err } = await supabase.from('movelaria_grupos_obra').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const update = async (id: string, input: Partial<GrupoObraInput>) => {
    const { error: err } = await supabase
      .from('movelaria_grupos_obra')
      .update(input)
      .eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_grupos_obra').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(g => g.id !== id))
  }

  return { data, montadores, loading, create, update, remove, reload: load }
}
