import { useCallback, useEffect, useState } from 'react'
import { dispensarFuncionario } from '@/lib/funcionario-dispensar'
import { supabase } from '@/lib/supabase'
import type { Funcionario, FuncionarioInput } from '@/types'
import { useAuthReady } from './useAuthReady'
import { useAutoRefresh } from './useAutoRefresh'

export type FuncionarioListagem = 'ativos' | 'dispensados'

interface UseFuncionariosOptions {
  listagem?: FuncionarioListagem
}

export function useFuncionarios(options?: UseFuncionariosOptions) {
  const listagem = options?.listagem ?? 'ativos'
  const { isReady } = useAuthReady()
  const [data, setData] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('movelaria_funcionarios')
        .select('*')
        .eq('ativo', listagem === 'ativos')
        .order('nome', { ascending: true })

      const { data: rows, error: err } = await q
      if (err) throw err

      const funcionarios = (rows ?? []) as Funcionario[]

      let countMap = new Map<string, number>()
      if (listagem === 'ativos') {
        try {
          const { data: recibosPendentes, error: recErr } = await supabase
            .from('movelaria_funcionario_recibos')
            .select('funcionario_id, conta_pagar:movelaria_contas_pagar!inner(status)')
            .in('status', ['gerado', 'aguardando_assinatura'])
            .eq('conta_pagar.status', 'pago')

          if (recErr) throw recErr

          for (const r of recibosPendentes ?? []) {
            countMap.set(r.funcionario_id, (countMap.get(r.funcionario_id) ?? 0) + 1)
          }
        } catch {
          countMap = new Map()
        }
      }

      let pontoMap = new Map<string, { hora_entrada?: string | null; hora_saida?: string | null; jornada_ativa?: boolean | null; status_hoje?: string | null; batidas_mes?: number | null }>()
      if (listagem === 'ativos') {
        try {
          const { data: pontoResumo } = await supabase
            .from('movelaria_funcionario_ponto_resumo')
            .select('funcionario_id, hora_entrada, hora_saida, jornada_ativa, status_hoje, batidas_mes')
          for (const r of pontoResumo ?? []) {
            pontoMap.set(r.funcionario_id, r)
          }
        } catch {
          pontoMap = new Map()
        }
      }

      setData(
        funcionarios
          .filter(f => f.tipo !== 'marceneiro')
          .map(f => ({
            ...f,
            admissao_dados: (f.admissao_dados ?? {}) as Funcionario['admissao_dados'],
            recibos_pendentes: listagem === 'ativos' ? (countMap.get(f.id) ?? 0) : 0,
            ponto_resumo: listagem === 'ativos' ? (pontoMap.get(f.id) ?? undefined) : undefined,
          })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar funcionários.')
    } finally {
      setLoading(false)
    }
  }, [isReady, listagem])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(load)

  const create = async (input: FuncionarioInput): Promise<Funcionario> => {
    const { data: row, error: err } = await supabase
      .from('movelaria_funcionarios')
      .insert({
        nome: input.nome.trim(),
        tipo: input.tipo,
        cpf: input.cpf?.trim() || null,
        telefone: input.telefone?.trim() || null,
        email: input.email?.trim() || null,
        usuario_id: input.usuario_id ?? null,
        admissao_dados: input.admissao_dados ?? {},
      })
      .select()
      .single()
    if (err) throw new Error(err.message)
    const created = { ...(row as Funcionario), recibos_pendentes: 0 }
    if (listagem === 'ativos') {
      setData(prev => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)))
    }
    return created
  }

  const update = async (id: string, input: Partial<FuncionarioInput>): Promise<Funcionario> => {
    const payload: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
    if (input.nome !== undefined) payload.nome = input.nome.trim()
    if (input.tipo !== undefined) payload.tipo = input.tipo
    if (input.cpf !== undefined) payload.cpf = input.cpf?.trim() || null
    if (input.telefone !== undefined) payload.telefone = input.telefone?.trim() || null
    if (input.email !== undefined) payload.email = input.email?.trim() || null
    if (input.usuario_id !== undefined) payload.usuario_id = input.usuario_id || null
    if (input.ativo !== undefined) payload.ativo = input.ativo
    if (input.admissao_dados !== undefined) payload.admissao_dados = input.admissao_dados
    if (input.admissao_status !== undefined) payload.admissao_status = input.admissao_status

    const { data: row, error: err } = await supabase
      .from('movelaria_funcionarios')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    const updated = row as Funcionario
    setData(prev => prev.map(x => (x.id === id ? { ...x, ...updated } : x)))
    return updated
  }

  const dispensar = async (id: string): Promise<Funcionario> => {
    const updated = await dispensarFuncionario(id)
    setData(prev => prev.filter(x => x.id !== id))
    return updated
  }

  return { data, loading, error, create, update, dispensar, reload: load }
}
