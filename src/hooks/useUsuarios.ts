import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseCrmRoles, type CrmRole, type CrmTipoUsuario } from '../lib/crm-identity'
import { useAuthReady } from './useAuthReady'

export interface UsuarioAdmin {
  id: string
  email: string
  nome: string | null
  perfil: string
  perfis_extras: string[]
  ativo: boolean
  criado_em: string
  tem_movelaria: boolean
  crm_tipo_usuario: CrmTipoUsuario | null
  crm_status_convite: string | null
  crm_roles: CrmRole[]
  crm_horario_inicio: string | null
  crm_horario_fim: string | null
}

export interface FichaCrmInput {
  tipo_usuario: 'nenhum' | CrmTipoUsuario
  roles: CrmRole[]
  horario_inicio: string
  horario_fim: string
  status_convite: string
}

function mapIdentidade(row: Record<string, unknown>): UsuarioAdmin {
  const tipo = row.crm_tipo_usuario ? String(row.crm_tipo_usuario) : null
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    nome: row.nome ? String(row.nome) : null,
    perfil: row.perfil ? String(row.perfil) : '',
    perfis_extras: Array.isArray(row.perfis_extras) ? row.perfis_extras.map(String) : [],
    ativo: row.ativo === true,
    criado_em: String(row.criado_em ?? ''),
    tem_movelaria: row.tem_movelaria === true,
    crm_tipo_usuario:
      tipo === 'colaborador' || tipo === 'prestador_servico' || tipo === 'lead'
        ? tipo
        : null,
    crm_status_convite: row.crm_status_convite ? String(row.crm_status_convite) : null,
    crm_roles: parseCrmRoles(row.crm_roles),
    crm_horario_inicio: row.crm_horario_inicio ? String(row.crm_horario_inicio).slice(0, 5) : null,
    crm_horario_fim: row.crm_horario_fim ? String(row.crm_horario_fim).slice(0, 5) : null,
  }
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
      const { data: rows, error: err } = await supabase.rpc('movelaria_listar_identidades')
      if (err) throw err
      setData((rows ?? []).map(row => mapIdentidade(row as Record<string, unknown>)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const salvarFichaCrm = async (id: string, ficha: FichaCrmInput) => {
    const { error: err } = await supabase.rpc('movelaria_atualizar_ficha_crm', {
      p_id: id,
      p_tipo_usuario: ficha.tipo_usuario,
      p_roles: ficha.roles,
      p_horario_inicio: ficha.horario_inicio || null,
      p_horario_fim: ficha.horario_fim || null,
      p_status_convite: ficha.status_convite || 'ATIVO',
    })
    if (err) throw new Error(err.message)
  }

  const criar = async (
    email: string,
    senha: string,
    nome: string,
    perfil: string,
    fichaCrm?: FichaCrmInput,
  ) => {
    const { data: id, error: err } = await supabase.rpc('movelaria_criar_usuario', {
      p_email: email.trim().toLowerCase(),
      p_senha: senha,
      p_nome: nome.trim() || null,
      p_perfil: perfil,
    })
    if (err) throw new Error(err.message)
    if (id && fichaCrm && fichaCrm.tipo_usuario !== 'nenhum') {
      await salvarFichaCrm(String(id), fichaCrm)
    }
    await load()
  }

  const registrarExistente = async (
    email: string,
    nome: string,
    perfil: string,
    senha?: string,
    fichaCrm?: FichaCrmInput,
  ) => {
    const { data: id, error: err } = await supabase.rpc('movelaria_registrar_usuario_existente', {
      p_email: email.trim().toLowerCase(),
      p_nome: nome.trim() || null,
      p_perfil: perfil,
      p_senha: senha || null,
    })
    if (err) throw new Error(err.message)
    if (id && fichaCrm && fichaCrm.tipo_usuario !== 'nenhum') {
      await salvarFichaCrm(String(id), fichaCrm)
    }
    await load()
  }

  const atualizar = async (
    id: string,
    perfil: string,
    nome: string | null,
    ativo: boolean,
    perfis_extras?: string[],
    fichaCrm?: FichaCrmInput,
  ) => {
    const target = data.find(u => u.id === id)
    if (target?.tem_movelaria && perfil) {
      const { error: err } = await supabase.rpc('movelaria_atualizar_perfil_usuario', {
        p_id: id,
        p_perfil: perfil,
        p_nome: nome,
        p_ativo: ativo,
        p_perfis_extras: perfis_extras !== undefined ? perfis_extras : null,
      })
      if (err) throw new Error(err.message)
    }
    if (fichaCrm) {
      await salvarFichaCrm(id, fichaCrm)
    }
    await load()
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

  return { data, loading, error, criar, registrarExistente, atualizar, redefinirSenha, excluir, reload: load }
}
