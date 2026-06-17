import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { CaixaSaldoAlocacao } from '@/types'
import { useAuthReady } from './useAuthReady'

export function useCaixaSaldoAlocacoes(mes: number, ano: number) {
  const { isReady } = useAuthReady()
  const [alocacoes, setAlocacoes] = useState<CaixaSaldoAlocacao[]>([])
  const [saldoDisponivel, setSaldoDisponivel] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    await load()
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
    await load()
  }

  const remover = async (id: string) => {
    const { error: err } = await supabase
      .from('movelaria_caixa_saldo_alocacoes')
      .delete()
      .eq('id', id)
    if (err) throw err
    await load()
  }

  return {
    alocacoes,
    saldoDisponivel,
    totalAlocado,
    diferenca,
    loading,
    error,
    adicionar,
    atualizar,
    remover,
    reload: load,
  }
}
