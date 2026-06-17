import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { CaixaSaldoAlocacao } from '@/types'
import { useAuthReady } from './useAuthReady'

export interface ContaSaldoAgrupada {
  descricao: string
  total: number
}

function normalizarNomeConta(descricao: string): string {
  return descricao.trim().toLowerCase()
}

/** Agrupa alocações de todos os meses por nome de conta (mesmo nome = soma dos valores). */
export function agruparContasSaldoPorNome(
  itens: Pick<CaixaSaldoAlocacao, 'descricao' | 'valor'>[],
): ContaSaldoAgrupada[] {
  const map = new Map<string, ContaSaldoAgrupada>()

  for (const item of itens) {
    const nome = item.descricao.trim()
    if (!nome) continue
    const key = normalizarNomeConta(nome)
    const valor = Number(item.valor) || 0
    const existente = map.get(key)
    if (existente) {
      existente.total = parseFloat((existente.total + valor).toFixed(2))
    } else {
      map.set(key, { descricao: nome, total: valor })
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.descricao.localeCompare(b.descricao, 'pt-BR'),
  )
}

export function useCaixaSaldoAlocacoes(mes: number, ano: number) {
  const { isReady } = useAuthReady()
  const [alocacoes, setAlocacoes] = useState<CaixaSaldoAlocacao[]>([])
  const [contasGlobais, setContasGlobais] = useState<ContaSaldoAgrupada[]>([])
  const [saldoDisponivel, setSaldoDisponivel] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingGlobal, setLoadingGlobal] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGlobal = useCallback(async () => {
    if (!isReady) return

    setLoadingGlobal(true)
    try {
      const { data, error: globalErr } = await supabase
        .from('movelaria_caixa_saldo_alocacoes')
        .select('descricao, valor')

      if (globalErr) throw globalErr
      setContasGlobais(agruparContasSaldoPorNome((data as CaixaSaldoAlocacao[]) ?? []))
    } catch (err) {
      console.error('[useCaixaSaldoAlocacoes] global', err)
    } finally {
      setLoadingGlobal(false)
    }
  }, [isReady])

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)

    try {
      const [alocRes, saldoRes] = await Promise.all([
        supabase
          .from('movelaria_caixa_saldo_alocacoes')
          .select('*')
          .eq('mes_referencia', mes)
          .eq('ano_referencia', ano)
          .order('criado_em', { ascending: true }),
        supabase
          .from('movelaria_caixa_saldo_acumulado')
          .select('saldo')
          .eq('mes_referencia', mes)
          .eq('ano_referencia', ano),
      ])

      if (alocRes.error) throw alocRes.error
      if (saldoRes.error) throw saldoRes.error

      setAlocacoes((alocRes.data as CaixaSaldoAlocacao[]) ?? [])
      setSaldoDisponivel(
        (saldoRes.data ?? []).reduce((acc, row) => acc + (Number(row.saldo) || 0), 0),
      )
    } catch (err) {
      console.error('[useCaixaSaldoAlocacoes]', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar alocações.')
    } finally {
      setLoading(false)
    }
  }, [isReady, mes, ano])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadGlobal()
  }, [loadGlobal])

  const totalGlobalContas = useMemo(
    () => contasGlobais.reduce((acc, c) => acc + c.total, 0),
    [contasGlobais],
  )

  const totalAlocado = useMemo(
    () => alocacoes.reduce((acc, a) => acc + (Number(a.valor) || 0), 0),
    [alocacoes],
  )

  const diferenca = useMemo(
    () => parseFloat((saldoDisponivel - totalAlocado).toFixed(2)),
    [saldoDisponivel, totalAlocado],
  )

  const adicionar = async (descricao: string, valor: number) => {
    const { data: userData } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('movelaria_caixa_saldo_alocacoes').insert({
      mes_referencia: mes,
      ano_referencia: ano,
      descricao: descricao.trim(),
      valor,
      criado_por: userData.user?.id ?? null,
    })
    if (err) throw err
    await Promise.all([load(), loadGlobal()])
  }

  const atualizar = async (id: string, descricao: string, valor: number) => {
    const { error: err } = await supabase
      .from('movelaria_caixa_saldo_alocacoes')
      .update({
        descricao: descricao.trim(),
        valor,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
    if (err) throw err
    await Promise.all([load(), loadGlobal()])
  }

  const remover = async (id: string) => {
    const { error: err } = await supabase
      .from('movelaria_caixa_saldo_alocacoes')
      .delete()
      .eq('id', id)
    if (err) throw err
    await Promise.all([load(), loadGlobal()])
  }

  return {
    alocacoes,
    contasGlobais,
    totalGlobalContas,
    saldoDisponivel,
    totalAlocado,
    diferenca,
    loading,
    loadingGlobal,
    error,
    adicionar,
    atualizar,
    remover,
    reload: load,
  }
}
