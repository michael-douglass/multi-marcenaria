import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthReady } from './useAuthReady'

export interface UsuarioAdmin {
  id: string
  email: string
  nome: string | null
  perfil: string
  ativo: boolean
  criado_em: string
}

export function useUsuarios() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase.rpc('movelaria_listar_usuarios')
      if (err) throw err
      setData((rows ?? []) as UsuarioAdmin[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const criar = async (email: string, senha: string, nome: string, perfil: string) => {
    const { error: err } = await supabase.rpc('movelaria_criar_usuario', {
      p_email: email.trim().toLowerCase(),
      p_senha: senha,
      p_nome: nome.trim() || null,
      p_perfil: perfil,
    })
    if (err) throw new Error(err.message)
    await load()
  }

  const atualizar = async (id: string, perfil: string, nome: string | null, ativo: boolean) => {
    const { error: err } = await supabase.rpc('movelaria_atualizar_perfil_usuario', {
      p_id: id,
      p_perfil: perfil,
      p_nome: nome,
      p_ativo: ativo,
    })
    if (err) throw new Error(err.message)
    setData(prev => prev.map(u =>
      u.id === id ? { ...u, perfil, nome, ativo } : u
    ))
  }

  const redefinirSenha = async (id: string, novaSenha: string) => {
    const { error: err } = await supabase.rpc('movelaria_redefinir_senha', {
      p_id: id,
      p_senha: novaSenha,
    })
    if (err) throw new Error(err.message)
  }

  const excluir = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_excluir_usuario', { p_id: id })
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(u => u.id !== id))
  }

  return { data, loading, error, criar, atualizar, redefinirSenha, excluir, reload: load }
}
