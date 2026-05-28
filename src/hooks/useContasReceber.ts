import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ContaReceber, FormaPagamento } from '../types'
import { addDays, todayISO } from '../lib/utils'

interface GerarCobrancaInput {
  cliente_id: string
  cliente_nome: string
  valor_total: number
  num_parcelas: number
  primeiro_vencimento: string
  forma_pagamento: FormaPagamento
}

export interface AtualizarTransacaoInput {
  valor_parcela: number
  data_vencimento: string
  forma_pagamento: FormaPagamento
  status: 'pendente' | 'recebido'
  data_recebimento?: string | null
}

export function useContasReceber() {
  const [data, setData] = useState<ContaReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('movelaria_contas_receber')
      .select('*')
      .order('data_vencimento', { ascending: true })
    if (err) setError(err.message)
    else setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const gerarCobranca = async (input: GerarCobrancaInput): Promise<ContaReceber[]> => {
    const n = input.num_parcelas
    const valorUnitario = input.valor_total / n

    const parcelas = Array.from({ length: n }, (_, i) => ({
      cliente_id: input.cliente_id,
      cliente_nome: input.cliente_nome,
      valor_total: input.valor_total,
      numero_parcela: i + 1,
      total_parcelas: n,
      valor_parcela:
        i === n - 1
          ? parseFloat((input.valor_total - valorUnitario * (n - 1)).toFixed(2))
          : parseFloat(valorUnitario.toFixed(2)),
      data_vencimento: addDays(input.primeiro_vencimento, i * 30),
      forma_pagamento: input.forma_pagamento,
      status: 'pendente' as const,
      origem_tipo: 'manual' as const,
      origem_lead_id: null,
    }))

    const { data: rows, error: err } = await supabase
      .from('movelaria_contas_receber')
      .insert(parcelas)
      .select()
    if (err) throw new Error(err.message)
    setData(prev => [...prev, ...(rows ?? [])])
    return rows ?? []
  }

  const marcarRecebido = async (id: string) => {
    const { data: row, error: err } = await supabase
      .from('movelaria_contas_receber')
      .update({ status: 'recebido', data_recebimento: todayISO(), atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? row : x)))
  }

  const atualizarTransacao = async (id: string, input: AtualizarTransacaoInput) => {
    const payload = {
      valor_parcela: input.valor_parcela,
      data_vencimento: input.data_vencimento,
      forma_pagamento: input.forma_pagamento,
      status: input.status,
      data_recebimento: input.status === 'recebido' ? (input.data_recebimento ?? todayISO()) : null,
      atualizado_em: new Date().toISOString(),
    }
    const { data: row, error: err } = await supabase
      .from('movelaria_contas_receber')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? row : x)))
    return row
  }

  const removerTransacao = async (id: string) => {
    const conta = data.find(x => x.id === id)
    if (!conta) return

    let leadIdRelacionado = conta.origem_lead_id ?? null

    // Fallback para registros antigos sem origem salva.
    if (!leadIdRelacionado) {
      let query = supabase
        .from('movelaria_orcamentos_fechados')
        .select('lead_id')
        .order('criado_em', { ascending: false })
        .limit(1)

      if (conta.cliente_id) query = query.eq('cliente_id', conta.cliente_id)
      else if (conta.cliente_nome) query = query.eq('cliente_nome', conta.cliente_nome)

      if (typeof conta.valor_total === 'number') {
        query = query.eq('valor_total', conta.valor_total)
      }

      const { data: orcRow } = await query.maybeSingle()
      leadIdRelacionado = orcRow?.lead_id ?? null
    }

    if (conta.origem_tipo === 'orcamento_fechado' || !!leadIdRelacionado) {
      if (leadIdRelacionado) {
        const { error: delParcelasPorLeadErr } = await supabase
          .from('movelaria_contas_receber')
          .delete()
          .eq('origem_tipo', 'orcamento_fechado')
          .eq('origem_lead_id', leadIdRelacionado)
        if (delParcelasPorLeadErr) throw new Error(delParcelasPorLeadErr.message)
      }

      // Fallback extra para registros antigos sem origem_lead_id: remove o pacote completo da venda.
      let fallbackDelete = supabase
        .from('movelaria_contas_receber')
        .delete()
        .eq('cliente_nome', conta.cliente_nome ?? '')
      if (typeof conta.valor_total === 'number') {
        fallbackDelete = fallbackDelete.eq('valor_total', conta.valor_total)
      }

      const { error: delParcelasFallbackErr } = await fallbackDelete
      if (delParcelasFallbackErr) throw new Error(delParcelasFallbackErr.message)

      if (leadIdRelacionado) {
        const { error: delOrcamentoErr } = await supabase
          .from('movelaria_orcamentos_fechados')
          .delete()
          .eq('lead_id', leadIdRelacionado)
        if (delOrcamentoErr) throw new Error(delOrcamentoErr.message)
      } else {
        let delOrcamentoFallback = supabase
          .from('movelaria_orcamentos_fechados')
          .delete()
          .eq('cliente_nome', conta.cliente_nome ?? '')

        if (typeof conta.valor_total === 'number') {
          delOrcamentoFallback = delOrcamentoFallback.eq('valor_total', conta.valor_total)
        }

        const { error: delOrcamentoFallbackErr } = await delOrcamentoFallback
        if (delOrcamentoFallbackErr) throw new Error(delOrcamentoFallbackErr.message)
      }

      setData(prev =>
        prev.filter(item => {
          const mesmoCliente = (item.cliente_nome ?? '') === (conta.cliente_nome ?? '')
          const mesmoValor = item.valor_total === conta.valor_total
          const mesmoLead = leadIdRelacionado && item.origem_lead_id === leadIdRelacionado
          return !(mesmoLead || (mesmoCliente && mesmoValor))
        }),
      )
      return
    }

    const { error: err } = await supabase
      .from('movelaria_contas_receber')
      .delete()
      .eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(x => x.id !== id))
  }

  return { data, loading, error, gerarCobranca, marcarRecebido, atualizarTransacao, removerTransacao, reload: load }
}
