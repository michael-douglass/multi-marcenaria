import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CaixaFornecedor, FormaPagamentoCaixa, TransacaoCaixaFornecedor } from '../types'

export function useCaixaFornecedor() {
  const [caixas, setCaixas] = useState<CaixaFornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('movelaria_caixa_fornecedor')
      .select('*, movelaria_fornecedores(id, nome)')
      .order('criado_em', { ascending: false })
    if (err) setError(err.message)
    else setCaixas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const getSaldoFornecedor = useCallback(
    (fornecedorId: string): number =>
      caixas.find(c => c.fornecedor_id === fornecedorId)?.saldo_atual ?? 0,
    [caixas],
  )

  const adicionarCredito = async (
    fornecedorId: string,
    valor: number,
    formaPagamento: FormaPagamentoCaixa,
    descricao?: string,
  ): Promise<void> => {
    const saldoAnterior = getSaldoFornecedor(fornecedorId)
    const saldoPosterior = saldoAnterior + valor

    const { data: caixaRow, error: caixaErr } = await supabase
      .from('movelaria_caixa_fornecedor')
      .upsert(
        {
          fornecedor_id: fornecedorId,
          saldo_atual: saldoPosterior,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'fornecedor_id' },
      )
      .select()
      .single()
    if (caixaErr) throw new Error(caixaErr.message)

    const { error: txErr } = await supabase
      .from('movelaria_transacoes_caixa_fornecedor')
      .insert({
        fornecedor_id: fornecedorId,
        tipo: 'credito',
        valor,
        forma_pagamento: formaPagamento,
        descricao: descricao || null,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
      })
    if (txErr) throw new Error(txErr.message)

    setCaixas(prev => {
      const exists = prev.some(c => c.fornecedor_id === fornecedorId)
      if (exists) return prev.map(c => c.fornecedor_id === fornecedorId ? { ...c, saldo_atual: saldoPosterior } : c)
      return [caixaRow, ...prev]
    })
  }

  const debitarSaldo = async (
    fornecedorId: string,
    valor: number,
    contaPagarId?: string,
    descricao?: string,
  ): Promise<void> => {
    const saldoAnterior = getSaldoFornecedor(fornecedorId)
    if (saldoAnterior < valor) throw new Error('Saldo insuficiente com este fornecedor.')
    const saldoPosterior = saldoAnterior - valor

    const { error: caixaErr } = await supabase
      .from('movelaria_caixa_fornecedor')
      .update({ saldo_atual: saldoPosterior, atualizado_em: new Date().toISOString() })
      .eq('fornecedor_id', fornecedorId)
    if (caixaErr) throw new Error(caixaErr.message)

    const { error: txErr } = await supabase
      .from('movelaria_transacoes_caixa_fornecedor')
      .insert({
        fornecedor_id: fornecedorId,
        tipo: 'debito',
        valor,
        conta_pagar_id: contaPagarId || null,
        descricao: descricao || null,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
      })
    if (txErr) throw new Error(txErr.message)

    setCaixas(prev => prev.map(c =>
      c.fornecedor_id === fornecedorId ? { ...c, saldo_atual: saldoPosterior } : c,
    ))
  }

  const loadTransacoes = async (fornecedorId: string): Promise<TransacaoCaixaFornecedor[]> => {
    const { data, error: err } = await supabase
      .from('movelaria_transacoes_caixa_fornecedor')
      .select('*')
      .eq('fornecedor_id', fornecedorId)
      .order('criado_em', { ascending: false })
    if (err) throw new Error(err.message)
    return data ?? []
  }

  // Percorre todas as transações em ordem cronológica e reescreve
  // saldo_anterior / saldo_posterior de cada uma, depois atualiza saldo_atual.
  const recalcularHistoricoSaldos = async (fornecedorId: string): Promise<number> => {
    const { data: txs, error: fetchErr } = await supabase
      .from('movelaria_transacoes_caixa_fornecedor')
      .select('id, tipo, valor')
      .eq('fornecedor_id', fornecedorId)
      .order('criado_em', { ascending: true })
    if (fetchErr) throw new Error(fetchErr.message)

    let corrente = 0
    for (const tx of txs ?? []) {
      const anterior = corrente
      const posterior = parseFloat(
        (tx.tipo === 'credito' ? corrente + tx.valor : Math.max(0, corrente - tx.valor)).toFixed(2),
      )
      const { error: upErr } = await supabase
        .from('movelaria_transacoes_caixa_fornecedor')
        .update({ saldo_anterior: anterior, saldo_posterior: posterior })
        .eq('id', tx.id)
      if (upErr) throw new Error(upErr.message)
      corrente = posterior
    }

    const novoSaldo = parseFloat(corrente.toFixed(2))

    const { error: caixaErr } = await supabase
      .from('movelaria_caixa_fornecedor')
      .upsert(
        { fornecedor_id: fornecedorId, saldo_atual: novoSaldo, atualizado_em: new Date().toISOString() },
        { onConflict: 'fornecedor_id' },
      )
    if (caixaErr) throw new Error(caixaErr.message)

    setCaixas(prev => prev.map(c =>
      c.fornecedor_id === fornecedorId ? { ...c, saldo_atual: novoSaldo } : c,
    ))
    return novoSaldo
  }

  const editarTransacao = async (
    tx: TransacaoCaixaFornecedor,
    payload: { valor: number; forma_pagamento?: FormaPagamentoCaixa; descricao?: string },
  ): Promise<void> => {
    const { error: err } = await supabase
      .from('movelaria_transacoes_caixa_fornecedor')
      .update({
        valor: payload.valor,
        forma_pagamento: payload.forma_pagamento ?? tx.forma_pagamento ?? null,
        descricao: payload.descricao ?? null,
      })
      .eq('id', tx.id)
    if (err) throw new Error(err.message)
    await recalcularHistoricoSaldos(tx.fornecedor_id)
  }

  const excluirTransacao = async (tx: TransacaoCaixaFornecedor): Promise<void> => {
    const { error: err } = await supabase
      .from('movelaria_transacoes_caixa_fornecedor')
      .delete()
      .eq('id', tx.id)
    if (err) throw new Error(err.message)
    await recalcularHistoricoSaldos(tx.fornecedor_id)
  }

  return {
    caixas,
    loading,
    error,
    reload: load,
    getSaldoFornecedor,
    adicionarCredito,
    debitarSaldo,
    loadTransacoes,
    editarTransacao,
    excluirTransacao,
  }
}
