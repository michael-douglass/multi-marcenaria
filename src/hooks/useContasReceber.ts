import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { canUseRealtime } from '../lib/device'
import type { ContaReceber, FormaPagamento, TipoRecebimento } from '../types'
import { createId, addDays, addMonths, todayISO } from '../lib/utils'
import { useAutoRefresh } from './useAutoRefresh'
import { useAuthReady } from './useAuthReady'

export interface ParcelaInput {
  numero: number
  valor: number
  vencimento: string
}

interface GerarCobrancaInput {
  cliente_id: string
  cliente_nome: string
  valor_total: number
  tipo_recebimento: TipoRecebimento
  forma_pagamento: FormaPagamento
  total_parcelas: number
  primeiro_vencimento: string
  entrada?: {
    valor: number
    data: string
    forma_pagamento: FormaPagamento
  }
  parcelas_detalhadas?: ParcelaInput[]
  desconto_cartao_percentual?: number
  observacao?: string | null
}

export interface AtualizarTransacaoInput {
  valor_parcela: number
  data_vencimento: string
  forma_pagamento: FormaPagamento
  status: 'pendente' | 'recebido'
  data_recebimento?: string | null
  observacao?: string | null
  /** Se true e houver parcelamento, aplica a observação a todas as parcelas. */
  observacaoScope?: ContaReceberExclusaoScope
}

export type ContaReceberExclusaoScope = 'single' | 'all'

export function parcelasRelacionadas(conta: ContaReceber, todas: ContaReceber[]): ContaReceber[] {
  return todas.filter(item => {
    if (conta.origem_lead_id) return item.origem_lead_id === conta.origem_lead_id
    if (conta.grupo_id) return item.grupo_id === conta.grupo_id
    return item.cliente_nome === conta.cliente_nome && item.valor_total === conta.valor_total
  })
}

export function cobrancaTemParcelamento(conta: ContaReceber, todas: ContaReceber[]): boolean {
  return conta.total_parcelas > 1 || parcelasRelacionadas(conta, todas).length > 1
}

const CONTAS_RECEBER_REALTIME_CHANNEL = 'movelaria-contas-receber-sync'

export function useContasReceber() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<ContaReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return

    if (!opts?.silent) setLoading(true)
    setError(null)
    const { data: rows, error: err } = await supabase
      .from('movelaria_contas_receber')
      .select('*, movelaria_clientes(telefone)')
      .order('data_vencimento', { ascending: true })
    if (err) {
      if (!opts?.silent) setError(err.message)
    } else {
      const flattened = (rows ?? []).map((r: any) => ({
        ...r,
        cliente_telefone: r.movelaria_clientes?.telefone || null,
      }))
      setData(flattened)
    }
    if (!opts?.silent) setLoading(false)
  }, [isReady])

  const silentReload = useCallback(() => {
    void load({ silent: true })
  }, [load])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(silentReload)

  useEffect(() => {
    if (!isReady || !canUseRealtime()) return

    const channel = supabase
      .channel(CONTAS_RECEBER_REALTIME_CHANNEL)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_contas_receber' },
        silentReload,
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isReady, silentReload])

  const gerarCobranca = async (input: GerarCobrancaInput): Promise<ContaReceber[]> => {
    const valorBase = input.entrada
      ? parseFloat((input.valor_total - input.entrada.valor).toFixed(2))
      : input.valor_total

    const descontoPercentual = input.tipo_recebimento === 'cartao_parcelado'
      ? Math.max(0, Math.min(100, input.desconto_cartao_percentual ?? 0))
      : 0
    const valorDesconto = parseFloat(((valorBase * descontoPercentual) / 100).toFixed(2))
    const valorLiquido = parseFloat((valorBase - valorDesconto).toFixed(2))

    const n = input.tipo_recebimento === 'a_vista' ? 1 : Math.max(1, input.total_parcelas)
    let formaPag: FormaPagamento = input.forma_pagamento
    if (input.tipo_recebimento === 'cartao_parcelado') formaPag = 'cartao'

    const totalParcelasGlobal = (input.entrada ? 1 : 0) + n
    const parcelaOffset = input.entrada ? 1 : 0
    const grupoId = createId()
    const observacao = input.observacao?.trim() || null

    const parcelasToInsert: any[] = []

    // 1. Entrada Parcial
    if (input.entrada) {
      parcelasToInsert.push({
        cliente_id: input.cliente_id,
        cliente_nome: input.cliente_nome,
        valor_total: input.valor_total,
        numero_parcela: 1,
        total_parcelas: totalParcelasGlobal,
        valor_parcela: input.entrada.valor,
        data_vencimento: input.entrada.data,
        forma_pagamento: input.entrada.forma_pagamento,
        status: 'pendente',
        origem_tipo: 'manual',
        grupo_id: grupoId,
        observacao,
      })
    }

    // 2. Restante
    if (input.tipo_recebimento === 'a_vista') {
      parcelasToInsert.push({
        cliente_id: input.cliente_id,
        cliente_nome: input.cliente_nome,
        valor_total: input.valor_total,
        numero_parcela: 1 + parcelaOffset,
        total_parcelas: totalParcelasGlobal,
        valor_parcela: valorBase,
        data_vencimento: input.primeiro_vencimento,
        forma_pagamento: formaPag,
        status: 'pendente',
        origem_tipo: 'manual',
        grupo_id: grupoId,
        observacao,
      })
    } else if (input.tipo_recebimento === 'cartao_parcelado') {
      parcelasToInsert.push({
        cliente_id: input.cliente_id,
        cliente_nome: input.cliente_nome,
        valor_total: input.valor_total,
        numero_parcela: 1 + parcelaOffset,
        total_parcelas: totalParcelasGlobal,
        valor_parcela: valorLiquido,
        data_vencimento: todayISO(),
        forma_pagamento: 'cartao',
        status: 'pendente',
        origem_tipo: 'manual',
        grupo_id: grupoId,
        observacao,
      })
    } else {
      if (input.parcelas_detalhadas && input.parcelas_detalhadas.length > 0) {
        input.parcelas_detalhadas.forEach(p => {
          parcelasToInsert.push({
            cliente_id: input.cliente_id,
            cliente_nome: input.cliente_nome,
            valor_total: input.valor_total,
            numero_parcela: p.numero + parcelaOffset,
            total_parcelas: totalParcelasGlobal,
            valor_parcela: p.valor,
            data_vencimento: p.vencimento,
            forma_pagamento: formaPag,
            status: 'pendente',
            origem_tipo: 'manual',
            grupo_id: grupoId,
            observacao,
          })
        })
      } else {
        const valorUnit = parseFloat((valorBase / n).toFixed(2))
        for (let i = 0; i < n; i++) {
          parcelasToInsert.push({
            cliente_id: input.cliente_id,
            cliente_nome: input.cliente_nome,
            valor_total: input.valor_total,
            numero_parcela: i + 1 + parcelaOffset,
            total_parcelas: totalParcelasGlobal,
            valor_parcela:
              i === n - 1
                ? parseFloat((valorBase - valorUnit * (n - 1)).toFixed(2))
                : valorUnit,
            data_vencimento: addMonths(input.primeiro_vencimento, i),
            forma_pagamento: formaPag,
            status: 'pendente',
            origem_tipo: 'manual',
            grupo_id: grupoId,
            observacao,
          })
        }
      }
    }

    const { data: rows, error: err } = await supabase
      .from('movelaria_contas_receber')
      .insert(parcelasToInsert)
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
    const conta = data.find(x => x.id === id)
    const observacao =
      input.observacao !== undefined
        ? (input.observacao?.trim() || null)
        : undefined

    const payload: Record<string, unknown> = {
      valor_parcela: input.valor_parcela,
      data_vencimento: input.data_vencimento,
      forma_pagamento: input.forma_pagamento,
      status: input.status,
      data_recebimento: input.status === 'recebido' ? (input.data_recebimento ?? todayISO()) : null,
      atualizado_em: new Date().toISOString(),
    }
    if (observacao !== undefined) {
      payload.observacao = observacao
    }

    const { data: row, error: err } = await supabase
      .from('movelaria_contas_receber')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)

    if (
      observacao !== undefined
      && input.observacaoScope === 'all'
      && conta
      && cobrancaTemParcelamento(conta, data)
    ) {
      const relacionadas = parcelasRelacionadas(conta, data).filter(x => x.id !== id)
      if (relacionadas.length > 0) {
        const ids = relacionadas.map(x => x.id)
        const { error: groupErr } = await supabase
          .from('movelaria_contas_receber')
          .update({ observacao, atualizado_em: new Date().toISOString() })
          .in('id', ids)
        if (groupErr) throw new Error(groupErr.message)
        setData(prev =>
          prev.map(x => {
            if (x.id === id) return { ...row, cliente_telefone: x.cliente_telefone }
            if (ids.includes(x.id)) return { ...x, observacao }
            return x
          }),
        )
        return row
      }
    }

    setData(prev =>
      prev.map(x => (x.id === id ? { ...row, cliente_telefone: x.cliente_telefone } : x)),
    )
    return row
  }

  const atualizarParcelasEmLote = async (
    parcelas: Array<{ id: string; valor_parcela: number; data_vencimento: string }>,
    valorTotal: number,
    observacao?: string | null,
  ) => {
    const obs =
      observacao !== undefined ? (observacao?.trim() || null) : undefined

    const results = await Promise.all(
      parcelas.map(async p => {
        const payload: Record<string, unknown> = {
          valor_parcela: p.valor_parcela,
          data_vencimento: p.data_vencimento,
          valor_total: valorTotal,
          atualizado_em: new Date().toISOString(),
        }
        if (obs !== undefined) payload.observacao = obs

        const { data: row, error: err } = await supabase
          .from('movelaria_contas_receber')
          .update(payload)
          .eq('id', p.id)
          .select()
          .single()
        if (err) throw new Error(err.message)
        return row
      }),
    )

    setData(prev => {
      const newData = [...prev]
      results.forEach(row => {
        const idx = newData.findIndex(x => x.id === row.id)
        if (idx !== -1) {
          newData[idx] = { ...row, cliente_telefone: newData[idx].cliente_telefone }
        }
      })
      return newData
    })
  }

  const marcarLeadsExcluidos = async (leadIds: string[]) => {
    const unique = [...new Set(leadIds.map(lid => lid?.trim()).filter(Boolean))]
    if (!unique.length) return

    for (const leadId of unique) {
      const { error: rpcErr } = await supabase.rpc('movelaria_excluir_lead_ganho', {
        p_lead_id: leadId,
      })
      if (!rpcErr) continue

      const { error: upsertErr } = await supabase
        .from('movelaria_leads_ganhos_excluidos')
        .upsert({ lead_id: leadId }, { onConflict: 'lead_id' })
      if (upsertErr) throw new Error(upsertErr.message)
    }
  }

  const coletarLeadIdsOrcamento = async (conta: ContaReceber): Promise<string[]> => {
    const ids = new Set<string>()
    if (conta.origem_lead_id) ids.add(conta.origem_lead_id)

    let query = supabase
      .from('movelaria_orcamentos_fechados')
      .select('lead_id')
      .eq('cliente_nome', conta.cliente_nome ?? '')

    if (typeof conta.valor_total === 'number') {
      query = query.eq('valor_total', conta.valor_total)
    }

    const { data: orcs, error } = await query
    if (error) throw new Error(error.message)
    for (const row of orcs ?? []) {
      if (row.lead_id) ids.add(row.lead_id)
    }
    return [...ids]
  }

  const removerTransacao = async (id: string, scope: ContaReceberExclusaoScope = 'single') => {
    const conta = data.find(x => x.id === id)
    if (!conta) return

    if (scope === 'single') {
      const { error: err } = await supabase
        .from('movelaria_contas_receber')
        .delete()
        .eq('id', id)
      if (err) throw new Error(err.message)
      setData(prev => prev.filter(x => x.id !== id))
      return
    }

    const leadIdRelacionado = conta.origem_lead_id ?? null
    const grupoIdManual = conta.grupo_id ?? null

    if (conta.origem_tipo === 'orcamento_fechado' || !!leadIdRelacionado) {
      const leadIdsExcluir = await coletarLeadIdsOrcamento(conta)

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

      await marcarLeadsExcluidos(leadIdsExcluir)

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

    if (grupoIdManual) {
      const { error: err } = await supabase
        .from('movelaria_contas_receber')
        .delete()
        .eq('grupo_id', grupoIdManual)
      if (err) throw new Error(err.message)
      setData(prev => prev.filter(x => x.grupo_id !== grupoIdManual))
      return
    }

    const relacionadas = parcelasRelacionadas(conta, data)
    const idsRelacionados = relacionadas.map(item => item.id)
    if (idsRelacionados.length > 1) {
      const { error: err } = await supabase
        .from('movelaria_contas_receber')
        .delete()
        .in('id', idsRelacionados)
      if (err) throw new Error(err.message)
      setData(prev => prev.filter(x => !idsRelacionados.includes(x.id)))
      return
    }

    const { error: err } = await supabase
      .from('movelaria_contas_receber')
      .delete()
      .eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(x => x.id !== id))
  }

  return { data, loading, error, gerarCobranca, marcarRecebido, atualizarTransacao, atualizarParcelasEmLote, removerTransacao, reload: load }
}
