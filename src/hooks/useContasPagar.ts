import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ContaPagar } from '../types'
import { addMonths, createId, todayISO } from '../lib/utils'

interface GerarParcelasInput {
  pedido_id?: string
  fornecedor_id?: string
  fornecedor_nome?: string
  descricao?: string
  observacao?: string
  forma_pagamento_id?: string
  valor_total: number
  num_parcelas: number
  primeiro_vencimento: string
}

type ContaPagarScope = 'single' | 'group'

interface UpdateContaPagarInput {
  fornecedor_id?: string | null
  fornecedor_nome?: string | null
  descricao?: string | null
  observacao?: string | null
  forma_pagamento_id?: string | null
  valor_parcela?: number
  data_vencimento?: string
  status?: 'pendente' | 'pago'
  data_pagamento?: string | null
}

export function useContasPagar() {
  const [data, setData] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const withForma = await supabase
      .from('movelaria_contas_pagar')
      .select('*, movelaria_formas_pagamento_pagar!forma_pagamento_id ( id, nome )')
      .order('data_vencimento', { ascending: true })

    let rows = withForma.data
    let err = withForma.error

    if (err) {
      const fallback = await supabase
        .from('movelaria_contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: true })
      rows = fallback.data
      err = fallback.error
      if (!err && withForma.error) {
        console.warn(
          '[contas a pagar] Consulta com forma de pagamento indisponível. Execute: pnpm migrate',
          withForma.error.message,
        )
      }
    }

    if (err) setError(err.message)
    else setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const gerarParcelas = async (
    input: GerarParcelasInput,
    grupoLancamentoId?: string,
  ): Promise<{ rows: ContaPagar[]; grupo_lancamento_id: string | null }> => {
    const n = input.num_parcelas
    const valorUnitario = input.valor_total / n
    const grupoId = grupoLancamentoId ?? (input.pedido_id ? null : createId())

    const parcelas = Array.from({ length: n }, (_, i) => ({
      pedido_id: input.pedido_id ?? null,
      fornecedor_id: input.fornecedor_id ?? null,
      fornecedor_nome: input.fornecedor_nome ?? null,
      descricao: input.descricao ?? null,
      observacao: input.observacao?.trim() || null,
      forma_pagamento_id: input.forma_pagamento_id ?? null,
      valor_total: input.valor_total,
      numero_parcela: i + 1,
      total_parcelas: n,
      valor_parcela:
        i === n - 1
          ? parseFloat((input.valor_total - valorUnitario * (n - 1)).toFixed(2))
          : parseFloat(valorUnitario.toFixed(2)),
      data_vencimento: addMonths(input.primeiro_vencimento, i),
      status: 'pendente' as const,
      grupo_lancamento_id: grupoId,
    }))

    const { data: rows, error: err } = await supabase
      .from('movelaria_contas_pagar')
      .insert(parcelas)
      .select()
    if (err) throw new Error(err.message)
    setData(prev => [...prev, ...(rows ?? [])])
    return { rows: rows ?? [], grupo_lancamento_id: grupoId }
  }

  const marcarPago = async (id: string) => {
    const { data: row, error: err } = await supabase
      .from('movelaria_contas_pagar')
      .update({ status: 'pago', data_pagamento: todayISO(), atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? row : x)))
  }

  const vincularGrupoLancamento = async (id: string, grupoLancamentoId: string) => {
    const { error: err } = await supabase
      .from('movelaria_contas_pagar')
      .update({ grupo_lancamento_id: grupoLancamentoId, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  const editarContaPagar = async (
    conta: ContaPagar,
    payload: UpdateContaPagarInput,
    scope: ContaPagarScope,
  ) => {
    const updatedAt = new Date().toISOString()

    if (scope === 'group' && conta.grupo_lancamento_id) {
      const { data: groupRows, error: fetchErr } = await supabase
        .from('movelaria_contas_pagar')
        .select('id, numero_parcela')
        .eq('grupo_lancamento_id', conta.grupo_lancamento_id)
        .order('numero_parcela', { ascending: true })

      if (fetchErr) throw new Error(fetchErr.message)

      const anchorParcela = conta.numero_parcela || 1
      for (const row of groupRows ?? []) {
        const monthOffset = row.numero_parcela - anchorParcela
        const scopedPayload = {
          ...payload,
          data_vencimento: payload.data_vencimento
            ? addMonths(payload.data_vencimento, monthOffset)
            : undefined,
          atualizado_em: updatedAt,
        }

        const { error: rowErr } = await supabase
          .from('movelaria_contas_pagar')
          .update(scopedPayload)
          .eq('id', row.id)

        if (rowErr) throw new Error(rowErr.message)
      }
    } else {
      const singlePayload = { ...payload, atualizado_em: updatedAt }
      const { error: err } = await supabase
        .from('movelaria_contas_pagar')
        .update(singlePayload)
        .eq('id', conta.id)
      if (err) throw new Error(err.message)
    }

    await load()
  }

  const excluirContaPagar = async (conta: ContaPagar, scope: ContaPagarScope) => {
    let query = supabase.from('movelaria_contas_pagar').delete()

    if (scope === 'group' && conta.grupo_lancamento_id) {
      query = query.eq('grupo_lancamento_id', conta.grupo_lancamento_id)
    } else {
      query = query.eq('id', conta.id)
    }

    const { error: err } = await query
    if (err) throw new Error(err.message)
    await load()
  }

  return {
    data,
    loading,
    error,
    gerarParcelas,
    marcarPago,
    vincularGrupoLancamento,
    editarContaPagar,
    excluirContaPagar,
    reload: load,
  }
}
