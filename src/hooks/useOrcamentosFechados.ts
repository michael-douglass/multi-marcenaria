import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { FormaPagamento, LeadGanho, OrcamentoFechado, TipoRecebimento } from '../types'
import { addMonths, todayISO } from '../lib/utils'

export interface DarEntradaInput {
  lead: LeadGanho
  valor_total: number
  tipo_recebimento: TipoRecebimento
  forma_pagamento: FormaPagamento
  total_parcelas: number
  primeiro_vencimento: string
  desconto_cartao_percentual?: number
  descricao?: string
  observacoes?: string
}

export interface HistoricoCompraCliente {
  id: string
  cliente_nome: string
  valor_total: number
  descricao: string | null
  tipo_recebimento: TipoRecebimento
  forma_pagamento: FormaPagamento | null
  total_parcelas: number
  criado_em: string | null
}

export function useOrcamentosFechados() {
  const [leads, setLeads] = useState<LeadGanho[]>([])
  const [fechados, setFechados] = useState<OrcamentoFechado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [{ data, error: err }, { data: fechadosRows, error: fechadosErr }] = await Promise.all([
      supabase.rpc('movelaria_get_leads_ganhos'),
      supabase
        .from('movelaria_orcamentos_fechados')
        .select('*')
        .order('criado_em', { ascending: false }),
    ])

    if (err) {
      setLeads([])
    } else {
      setLeads((data ?? []).filter((l: LeadGanho) => !l.ja_processado))
    }

    if (fechadosErr) {
      setFechados([])
    } else {
      setFechados((fechadosRows ?? []) as OrcamentoFechado[])
    }

    if (err || fechadosErr) {
      setError(
        [
          err?.message,
          fechadosErr?.message,
        ]
          .filter(Boolean)
          .join(' | ') || 'Erro ao carregar orçamentos fechados.',
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const carregarHistoricoCliente = async (lead: LeadGanho): Promise<HistoricoCompraCliente[]> => {
    let clienteId: string | undefined

    if (lead.telefone) {
      const { data: cliente } = await supabase
        .from('movelaria_clientes')
        .select('id')
        .eq('telefone', lead.telefone)
        .maybeSingle()
      clienteId = cliente?.id
    }

    let query = supabase
      .from('movelaria_orcamentos_fechados')
      .select('id, cliente_nome, valor_total, descricao, tipo_recebimento, forma_pagamento, total_parcelas, criado_em')
      .order('criado_em', { ascending: false })
      .limit(50)

    if (clienteId) {
      query = query.eq('cliente_id', clienteId)
    } else if (lead.telefone) {
      query = query.eq('cliente_telefone', lead.telefone)
    } else {
      query = query.ilike('cliente_nome', lead.nome)
    }

    const { data, error: histErr } = await query
    if (histErr) throw new Error(histErr.message)

    return (data ?? []) as HistoricoCompraCliente[]
  }

  const darEntrada = async (input: DarEntradaInput): Promise<void> => {
    // 1. Localiza cliente por telefone; cria se não existir
    let clienteId: string | undefined

    if (input.lead.telefone) {
      const { data: cli } = await supabase
        .from('movelaria_clientes')
        .select('id')
        .eq('telefone', input.lead.telefone)
        .maybeSingle()
      clienteId = cli?.id
    }

    if (!clienteId) {
      const { data: novo, error: cliErr } = await supabase
        .from('movelaria_clientes')
        .insert({
          nome: input.lead.nome,
          telefone: input.lead.telefone ?? null,
          email: input.lead.email ?? null,
          origem: input.lead.origem ?? 'Lead Garbo',
          data_cadastro: todayISO(),
        })
        .select('id')
        .single()
      if (cliErr) throw new Error(cliErr.message)
      clienteId = novo.id
    }

    const descontoPercentual = input.tipo_recebimento === 'cartao_parcelado'
      ? Math.max(0, Math.min(100, input.desconto_cartao_percentual ?? 0))
      : 0
    const valorDesconto = parseFloat(((input.valor_total * descontoPercentual) / 100).toFixed(2))
    const valorLiquido = parseFloat((input.valor_total - valorDesconto).toFixed(2))

    // 2. Resolve forma de pagamento e nº de parcelas
    const n = input.tipo_recebimento === 'a_vista' ? 1 : Math.max(1, input.total_parcelas)
    let formaPag: FormaPagamento = input.forma_pagamento
    if (input.tipo_recebimento === 'cartao_parcelado') formaPag = 'cartao'

    // 3. Gera cobrança conforme tipo de recebimento
    if (input.tipo_recebimento === 'a_vista') {
      const { error: vistaErr } = await supabase
        .from('movelaria_contas_receber')
        .insert({
          cliente_id: clienteId,
          cliente_nome: input.lead.nome,
          valor_total: input.valor_total,
          numero_parcela: 1,
          total_parcelas: 1,
          valor_parcela: input.valor_total,
          data_vencimento: input.primeiro_vencimento,
          forma_pagamento: formaPag,
          status: 'recebido',
          data_recebimento: todayISO(),
          origem_tipo: 'orcamento_fechado',
          origem_lead_id: input.lead.id,
        })
      if (vistaErr) throw new Error(vistaErr.message)
    } else if (input.tipo_recebimento === 'cartao_parcelado') {
      const { error: cartaoErr } = await supabase
        .from('movelaria_contas_receber')
        .insert({
          cliente_id: clienteId,
          cliente_nome: input.lead.nome,
          // Mantém o bruto para consolidações financeiras; o líquido entra em valor_parcela.
          valor_total: input.valor_total,
          numero_parcela: 1,
          total_parcelas: 1,
          valor_parcela: valorLiquido,
          data_vencimento: todayISO(),
          forma_pagamento: 'cartao',
          status: 'recebido',
          data_recebimento: todayISO(),
          origem_tipo: 'orcamento_fechado',
          origem_lead_id: input.lead.id,
        })
      if (cartaoErr) throw new Error(cartaoErr.message)
    } else {
      const valorUnit = input.valor_total / n
      const parcelas = Array.from({ length: n }, (_, i) => ({
        cliente_id: clienteId,
        cliente_nome: input.lead.nome,
        valor_total: input.valor_total,
        numero_parcela: i + 1,
        total_parcelas: n,
        valor_parcela:
          i === n - 1
            ? parseFloat((input.valor_total - valorUnit * (n - 1)).toFixed(2))
            : parseFloat(valorUnit.toFixed(2)),
        data_vencimento: addMonths(input.primeiro_vencimento, i),
        forma_pagamento: formaPag,
        status: 'pendente' as const,
        origem_tipo: 'orcamento_fechado' as const,
        origem_lead_id: input.lead.id,
      }))
      const { error: parErr } = await supabase
        .from('movelaria_contas_receber')
        .insert(parcelas)
      if (parErr) throw new Error(parErr.message)
    }

    // 4. Registra o orçamento fechado para não aparecer mais nos cards
    const registroBase = {
      lead_id: input.lead.id,
      cliente_id: clienteId,
      cliente_nome: input.lead.nome,
      cliente_telefone: input.lead.telefone ?? null,
      valor_total: input.valor_total,
      descricao: input.descricao ?? null,
      tipo_recebimento: input.tipo_recebimento,
      forma_pagamento: formaPag,
      total_parcelas: n,
      observacoes: input.observacoes ?? null,
    }

    const { error: ofErrComCamposNovos } = await supabase
      .from('movelaria_orcamentos_fechados')
      .insert({
        ...registroBase,
        desconto_cartao_percentual: descontoPercentual > 0 ? descontoPercentual : null,
        valor_liquido: valorLiquido,
      })

    if (ofErrComCamposNovos) {
      const mensagem = ofErrComCamposNovos.message.toLowerCase()
      const schemaDesatualizado =
        mensagem.includes('desconto_cartao_percentual') ||
        mensagem.includes('valor_liquido') ||
        mensagem.includes('column')

      if (!schemaDesatualizado) throw new Error(ofErrComCamposNovos.message)

      // Fallback para ambientes onde a migration nova ainda não foi aplicada.
      const { error: ofErrSemCamposNovos } = await supabase
        .from('movelaria_orcamentos_fechados')
        .insert(registroBase)
      if (ofErrSemCamposNovos) throw new Error(ofErrSemCamposNovos.message)
    }

    await load()
  }

  return { leads, fechados, loading, error, darEntrada, carregarHistoricoCliente, reload: load }
}
