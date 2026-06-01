import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ContaPagar } from '../types'
import { addMonths, createId, todayISO } from '../lib/utils'
import { useAutoRefresh } from './useAutoRefresh'

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

interface CriarRecorrenciaInput {
  fornecedor_id?: string
  fornecedor_nome?: string
  descricao?: string
  observacao?: string
  forma_pagamento_id?: string
  valor_mensal: number
  primeiro_vencimento: string
  encerramento?: string
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

const MESES_HORIZONTE = 12

function proximoVencimento(serie: ContaPagar[]): string | null {
  const pendentes = serie
    .filter(c => c.status === 'pendente')
    .map(c => c.data_vencimento)
    .sort()
  return pendentes.at(-1) ?? null
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

    if (err) { setError(err.message); setLoading(false); return }

    const allRows: ContaPagar[] = rows ?? []
    setData(allRows)
    setLoading(false)

    // Auto-expansão de recorrências: mantém sempre MESES_HORIZONTE meses à frente
    await expandirRecorrencias(allRows)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Agrupa por recorrencia_id e gera meses que faltam
  const expandirRecorrencias = async (rows: ContaPagar[]) => {
    const hoje = todayISO()
    const horizonte = addMonths(hoje, MESES_HORIZONTE)

    // Agrupa séries recorrentes
    const series = new Map<string, ContaPagar[]>()
    for (const r of rows) {
      if (!r.recorrente || !r.recorrencia_id) continue
      const lista = series.get(r.recorrencia_id) ?? []
      lista.push(r)
      series.set(r.recorrencia_id, lista)
    }

    const novas: ContaPagar[] = []

    for (const [recorrenciaId, serie] of series) {
      const modelo = serie[0]
      const encerramento = modelo.recorrencia_encerramento
      const valorBase = modelo.recorrencia_valor_base ?? modelo.valor_parcela
      const limiteGerado = encerramento && encerramento < horizonte ? encerramento : horizonte

      const ultimo = proximoVencimento(serie)
      if (!ultimo) continue

      // Datas já existentes na série
      const datasExistentes = new Set(serie.map(c => c.data_vencimento))

      let proxData = addMonths(ultimo, 1)
      const inserir: object[] = []

      while (proxData <= limiteGerado) {
        if (!datasExistentes.has(proxData)) {
          inserir.push({
            fornecedor_id: modelo.fornecedor_id ?? null,
            fornecedor_nome: modelo.fornecedor_nome ?? null,
            descricao: modelo.descricao ?? null,
            observacao: modelo.observacao ?? null,
            forma_pagamento_id: modelo.forma_pagamento_id ?? null,
            valor_total: valorBase,
            numero_parcela: 1,
            total_parcelas: 1,
            valor_parcela: valorBase,
            data_vencimento: proxData,
            status: 'pendente' as const,
            grupo_lancamento_id: null,
            recorrente: true,
            recorrencia_id: recorrenciaId,
            recorrencia_valor_base: valorBase,
            recorrencia_encerramento: encerramento ?? null,
          })
        }
        proxData = addMonths(proxData, 1)
      }

      if (inserir.length > 0) {
        const { data: inserted } = await supabase
          .from('movelaria_contas_pagar')
          .insert(inserir)
          .select('*, movelaria_formas_pagamento_pagar!forma_pagamento_id ( id, nome )')
        if (inserted) novas.push(...(inserted as ContaPagar[]))
      }
    }

    if (novas.length > 0) {
      setData(prev => [...prev, ...novas].sort((a, b) =>
        a.data_vencimento.localeCompare(b.data_vencimento),
      ))
    }
  }

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

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

  const criarRecorrencia = async (input: CriarRecorrenciaInput): Promise<void> => {
    const recorrenciaId = createId()
    const hoje = todayISO()
    const horizonte = addMonths(hoje, MESES_HORIZONTE)
    const limiteGerado = input.encerramento && input.encerramento < horizonte
      ? input.encerramento
      : horizonte

    const inserir: object[] = []
    let proxData = input.primeiro_vencimento

    while (proxData <= limiteGerado) {
      inserir.push({
        fornecedor_id: input.fornecedor_id ?? null,
        fornecedor_nome: input.fornecedor_nome ?? null,
        descricao: input.descricao ?? null,
        observacao: input.observacao?.trim() || null,
        forma_pagamento_id: input.forma_pagamento_id ?? null,
        valor_total: input.valor_mensal,
        numero_parcela: 1,
        total_parcelas: 1,
        valor_parcela: input.valor_mensal,
        data_vencimento: proxData,
        status: 'pendente' as const,
        grupo_lancamento_id: null,
        recorrente: true,
        recorrencia_id: recorrenciaId,
        recorrencia_valor_base: input.valor_mensal,
        recorrencia_encerramento: input.encerramento ?? null,
      })
      proxData = addMonths(proxData, 1)
    }

    const { data: rows, error: err } = await supabase
      .from('movelaria_contas_pagar')
      .insert(inserir)
      .select('*, movelaria_formas_pagamento_pagar!forma_pagamento_id ( id, nome )')
    if (err) throw new Error(err.message)
    setData(prev =>
      [...prev, ...(rows as ContaPagar[] ?? [])].sort((a, b) =>
        a.data_vencimento.localeCompare(b.data_vencimento),
      ),
    )
  }

  const encerrarRecorrencia = async (
    recorrenciaId: string,
    modo: 'apagar_futuros' | 'definir_data',
    data?: string,
  ): Promise<void> => {
    if (modo === 'apagar_futuros') {
      const { error: err } = await supabase
        .from('movelaria_contas_pagar')
        .delete()
        .eq('recorrencia_id', recorrenciaId)
        .eq('status', 'pendente')
        .gte('data_vencimento', todayISO())
      if (err) throw new Error(err.message)
    } else if (modo === 'definir_data' && data) {
      // Apaga pendentes além da data de encerramento e registra o encerramento nas demais
      await supabase
        .from('movelaria_contas_pagar')
        .delete()
        .eq('recorrencia_id', recorrenciaId)
        .eq('status', 'pendente')
        .gt('data_vencimento', data)

      const { error: err } = await supabase
        .from('movelaria_contas_pagar')
        .update({ recorrencia_encerramento: data, atualizado_em: new Date().toISOString() })
        .eq('recorrencia_id', recorrenciaId)
      if (err) throw new Error(err.message)
    }
    await load()
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
    criarRecorrencia,
    encerrarRecorrencia,
    marcarPago,
    vincularGrupoLancamento,
    editarContaPagar,
    excluirContaPagar,
    reload: load,
  }
}
