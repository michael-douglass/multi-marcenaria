import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { FormaPagamento, LeadGanho, OrcamentoFechado, TipoRecebimento } from '../types'
import { addMonths, todayISO } from '../lib/utils'
import { useAuthReady } from './useAuthReady'

export interface ParcelaInput {
  numero: number
  valor: number
  vencimento: string
}

export interface EntradaParcial {
  valor: number
  forma_pagamento: FormaPagamento
  data: string
}

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
  parcelas_detalhadas?: ParcelaInput[]
  entrada?: EntradaParcial
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
  const { isReady } = useAuthReady()
  const [leads, setLeads] = useState<LeadGanho[]>([])
  const [fechados, setFechados] = useState<OrcamentoFechado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return

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
  }, [isReady])

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

    // 2. Calcula valor base (descontando entrada parcial, se houver)
    const valorBase = input.entrada
      ? parseFloat((input.valor_total - input.entrada.valor).toFixed(2))
      : input.valor_total

    const descontoPercentual = input.tipo_recebimento === 'cartao_parcelado'
      ? Math.max(0, Math.min(100, input.desconto_cartao_percentual ?? 0))
      : 0
    const valorDesconto = parseFloat(((valorBase * descontoPercentual) / 100).toFixed(2))
    const valorLiquido = parseFloat((valorBase - valorDesconto).toFixed(2))

    // 3. Resolve forma de pagamento e nº de parcelas do restante
    const n = input.tipo_recebimento === 'a_vista' ? 1 : Math.max(1, input.total_parcelas)
    let formaPag: FormaPagamento = input.forma_pagamento
    if (input.tipo_recebimento === 'cartao_parcelado') formaPag = 'cartao'

    const nRestante = input.tipo_recebimento === 'a_vista' ? 1 : n
    const totalParcelasGlobal = (input.entrada ? 1 : 0) + nRestante
    const parcelaOffset = input.entrada ? 1 : 0

    // 4. Insere entrada parcial (pendente até a data escolhida)
    if (input.entrada) {
      const { error: entradaErr } = await supabase
        .from('movelaria_contas_receber')
        .insert({
          cliente_id: clienteId,
          cliente_nome: input.lead.nome,
          valor_total: input.valor_total,
          numero_parcela: 1,
          total_parcelas: totalParcelasGlobal,
          valor_parcela: input.entrada.valor,
          data_vencimento: input.entrada.data,
          forma_pagamento: input.entrada.forma_pagamento,
          status: 'pendente',
          origem_tipo: 'orcamento_fechado',
          origem_lead_id: input.lead.id,
        })
      if (entradaErr) throw new Error(entradaErr.message)
    }

    // 5. Gera cobrança do restante conforme tipo de recebimento
    if (input.tipo_recebimento === 'a_vista') {
      const { error: vistaErr } = await supabase
        .from('movelaria_contas_receber')
        .insert({
          cliente_id: clienteId,
          cliente_nome: input.lead.nome,
          valor_total: input.valor_total,
          numero_parcela: 1 + parcelaOffset,
          total_parcelas: totalParcelasGlobal,
          valor_parcela: valorBase,
          data_vencimento: input.primeiro_vencimento,
          forma_pagamento: formaPag,
          status: 'pendente',
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
          valor_total: input.valor_total,
          numero_parcela: 1 + parcelaOffset,
          total_parcelas: totalParcelasGlobal,
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
      let parcelasToInsert
      if (input.parcelas_detalhadas && input.parcelas_detalhadas.length > 0) {
        parcelasToInsert = input.parcelas_detalhadas.map(p => ({
          cliente_id: clienteId,
          cliente_nome: input.lead.nome,
          valor_total: input.valor_total,
          numero_parcela: p.numero + parcelaOffset,
          total_parcelas: totalParcelasGlobal,
          valor_parcela: p.valor,
          data_vencimento: p.vencimento,
          forma_pagamento: formaPag,
          status: 'pendente' as const,
          origem_tipo: 'orcamento_fechado' as const,
          origem_lead_id: input.lead.id,
        }))
      } else {
        const valorUnit = parseFloat((valorBase / n).toFixed(2))
        parcelasToInsert = Array.from({ length: n }, (_, i) => ({
          cliente_id: clienteId,
          cliente_nome: input.lead.nome,
          valor_total: input.valor_total,
          numero_parcela: i + 1 + parcelaOffset,
          total_parcelas: totalParcelasGlobal,
          valor_parcela:
            i === n - 1
              ? parseFloat((valorBase - valorUnit * (n - 1)).toFixed(2))
              : valorUnit,
          data_vencimento: addMonths(input.primeiro_vencimento, i),
          forma_pagamento: formaPag,
          status: 'pendente' as const,
          origem_tipo: 'orcamento_fechado' as const,
          origem_lead_id: input.lead.id,
        }))
      }

      const { error: parErr } = await supabase
        .from('movelaria_contas_receber')
        .insert(parcelasToInsert)
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

    let orcamentoId: string | null = null

    const { data: ofDataNovos, error: ofErrComCamposNovos } = await supabase
      .from('movelaria_orcamentos_fechados')
      .insert({
        ...registroBase,
        desconto_cartao_percentual: descontoPercentual > 0 ? descontoPercentual : null,
        valor_liquido: valorLiquido,
      })
      .select('id')
      .single()

    if (ofErrComCamposNovos) {
      const mensagem = ofErrComCamposNovos.message.toLowerCase()
      const schemaDesatualizado =
        mensagem.includes('desconto_cartao_percentual') ||
        mensagem.includes('valor_liquido') ||
        mensagem.includes('column')

      if (!schemaDesatualizado) throw new Error(ofErrComCamposNovos.message)

      // Fallback para ambientes onde a migration nova ainda não foi aplicada.
      const { data: ofDataSem, error: ofErrSemCamposNovos } = await supabase
        .from('movelaria_orcamentos_fechados')
        .insert(registroBase)
        .select('id')
        .single()
      if (ofErrSemCamposNovos) throw new Error(ofErrSemCamposNovos.message)
      orcamentoId = ofDataSem?.id ?? null
    } else {
      orcamentoId = ofDataNovos?.id ?? null
    }

    // Cria obra automaticamente ao fechar orçamento
    if (orcamentoId && clienteId) {
      try {
        await supabase.rpc('movelaria_criar_obra_de_orcamento', {
          p_orcamento_id: orcamentoId,
          p_cliente_id: clienteId,
          p_cliente_nome: input.lead.nome,
          p_lead_id: input.lead.id,
          p_lousa: input.lead.observacoes ?? input.descricao ?? null,
        })
      } catch (obraErr) {
        console.warn('[darEntrada] Obra não criada automaticamente:', obraErr)
      }
    }

    await load()
  }

  const removerLead = async (leadId: string): Promise<void> => {
    const { error: err } = await supabase
      .from('movelaria_leads')
      .delete()
      .eq('id', leadId)
    if (err) throw new Error(err.message)
    setLeads(prev => prev.filter(l => l.id !== leadId))
  }

  return { leads, fechados, loading, error, darEntrada, carregarHistoricoCliente, removerLead, reload: load }
}
