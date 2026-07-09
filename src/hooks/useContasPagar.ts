import { useState, useEffect, useCallback, useId } from 'react'
import { supabase } from '../lib/supabase'
import type { ContaPagar } from '../types'
import { addMonths, createId, todayISO } from '../lib/utils'
import { setIsoDay } from '../lib/date-br'
import { getContasRelacionadas, getModeloRecorrencia, lancamentoTemParcelamento } from '../lib/contas-pagar-grupo'
import { expandirTodosFixoMontadores, podeExpandirFixoMontadores } from '../lib/fixo-montador'
import { useAutoRefresh } from './useAutoRefresh'
import { useAuthReady } from './useAuthReady'
import { useApp } from '@/context/AppContext'

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
  valor_total?: number
  data_vencimento?: string
  status?: 'pendente' | 'parcialmente_pago' | 'pago'
  valor_pago?: number
  data_pagamento?: string | null
  /** Recalcula vencimentos de todas as parcelas a partir da 1ª (escopo group). */
  primeiro_vencimento_grupo?: string
}

export interface CobrancaImportItem {
  fornecedor_id?: string
  fornecedor_nome: string
  descricao: string
  observacao?: string
  valor: number
  vencimento: string
}

interface AtualizarRecorrenciaInput {
  recorrencia_id: string
  conta_referencia_vencimento: string
  recorrencia_valor_base: number
  recorrencia_encerramento: string | null
  encerramento_alterado: boolean
  dia_vencimento_alterado: boolean
  novo_dia_vencimento?: number | null
  aplicar_valor_futuras_pendentes: boolean
  metadados?: {
    fornecedor_id?: string | null
    fornecedor_nome?: string | null
    descricao?: string | null
    observacao?: string | null
    forma_pagamento_id?: string | null
  }
}

const MESES_HORIZONTE = 12
const CONTAS_PAGAR_REALTIME_CHANNEL = 'movelaria-contas-pagar-sync'

function proximoVencimento(serie: ContaPagar[]): string | null {
  const pendentes = serie
    .filter(c => c.status === 'pendente')
    .map(c => c.data_vencimento)
    .sort()
  return pendentes.at(-1) ?? null
}

export function useContasPagar() {
  const { isReady } = useAuthReady()
  const { roles } = useApp()
  const realtimeChannelId = useId().replace(/:/g, '')
  const [data, setData] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return

    if (!opts?.silent) setLoading(true)
    setError(null)

    if (podeExpandirFixoMontadores(roles)) {
      try {
        await expandirTodosFixoMontadores()
      } catch (err) {
        console.warn(
          '[contas a pagar] Não foi possível expandir fixo dos montadores.',
          err instanceof Error ? err.message : err,
        )
      }
    }

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

    if (err) {
      if (!opts?.silent) setError(err.message)
      if (!opts?.silent) setLoading(false)
      return
    }

    const allRows: ContaPagar[] = rows ?? []
    setData(allRows)
    if (!opts?.silent) setLoading(false)

    // Auto-expansão de recorrências: mantém sempre MESES_HORIZONTE meses à frente
    await expandirRecorrencias(allRows)
  }, [isReady, roles])  // eslint-disable-line react-hooks/exhaustive-deps

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
      const modelo = getModeloRecorrencia(serie)
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

  const silentReload = useCallback(() => {
    void load({ silent: true })
  }, [load])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(silentReload)

  useEffect(() => {
    if (!isReady) return

    const channel = supabase
      .channel(`${CONTAS_PAGAR_REALTIME_CHANNEL}-${realtimeChannelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_contas_pagar' },
        silentReload,
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isReady, silentReload, realtimeChannelId])

  const gerarParcelas = async (
    input: GerarParcelasInput,
    grupoLancamentoId?: string,
  ): Promise<{ rows: ContaPagar[]; grupo_lancamento_id: string | null }> => {
    const n = input.num_parcelas
    const valorUnitario = input.valor_total / n
    const grupoId = grupoLancamentoId ?? createId()

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

  /** Atualiza série recorrente: valor base, encerramento e metadados compartilhados. */
  const atualizarRecorrencia = async (input: AtualizarRecorrenciaInput): Promise<void> => {
    const updatedAt = new Date().toISOString()
    const {
      recorrencia_id,
      conta_referencia_vencimento,
      recorrencia_valor_base,
      recorrencia_encerramento,
      encerramento_alterado,
      dia_vencimento_alterado,
      novo_dia_vencimento,
      aplicar_valor_futuras_pendentes,
      metadados,
    } = input

    const seriesUpdate: Record<string, unknown> = {
      recorrencia_valor_base,
      atualizado_em: updatedAt,
    }
    if (encerramento_alterado) {
      seriesUpdate.recorrencia_encerramento = recorrencia_encerramento
    }
    if (metadados) Object.assign(seriesUpdate, metadados)

    const { error: seriesErr } = await supabase
      .from('movelaria_contas_pagar')
      .update(seriesUpdate)
      .eq('recorrencia_id', recorrencia_id)
    if (seriesErr) throw new Error(seriesErr.message)

    if (aplicar_valor_futuras_pendentes) {
      const { error: futurasErr } = await supabase
        .from('movelaria_contas_pagar')
        .update({
          valor_parcela: recorrencia_valor_base,
          valor_total: recorrencia_valor_base,
          recorrencia_valor_base,
          atualizado_em: updatedAt,
        })
        .eq('recorrencia_id', recorrencia_id)
        .eq('status', 'pendente')
        .gt('data_vencimento', conta_referencia_vencimento)
      if (futurasErr) throw new Error(futurasErr.message)
    }

    if (dia_vencimento_alterado && novo_dia_vencimento != null) {
      const { data: pendentes, error: fetchErr } = await supabase
        .from('movelaria_contas_pagar')
        .select('id, data_vencimento')
        .eq('recorrencia_id', recorrencia_id)
        .eq('status', 'pendente')
        .gt('data_vencimento', conta_referencia_vencimento)

      if (fetchErr) throw new Error(fetchErr.message)

      for (const row of pendentes ?? []) {
        const vencimento = row.data_vencimento?.slice(0, 10)
        if (!vencimento) continue
        const novaData = setIsoDay(vencimento, novo_dia_vencimento)
        if (!novaData) continue

        const { error: rowErr } = await supabase
          .from('movelaria_contas_pagar')
          .update({
            data_vencimento: novaData,
            atualizado_em: updatedAt,
          })
          .eq('id', row.id)
        if (rowErr) throw new Error(rowErr.message)
      }
    }

    if (encerramento_alterado && recorrencia_encerramento) {
      const { error: trimErr } = await supabase
        .from('movelaria_contas_pagar')
        .delete()
        .eq('recorrencia_id', recorrencia_id)
        .eq('status', 'pendente')
        .gt('data_vencimento', recorrencia_encerramento)
      if (trimErr) throw new Error(trimErr.message)
    }

    await load()
  }

  const marcarPago = async (id: string, valorPagar: number) => {
    const contaAtual = data.find(c => c.id === id)
    if (!contaAtual) throw new Error('Conta não encontrada.')
    const valorPagoAtual = contaAtual.valor_pago ?? 0
    const novoValorPago = parseFloat((valorPagoAtual + valorPagar).toFixed(2))
    const novoStatus = novoValorPago >= contaAtual.valor_parcela ? 'pago' : 'parcialmente_pago'

    const { data: row, error: err } = await supabase
      .from('movelaria_contas_pagar')
      .update({
        valor_pago: novoValorPago,
        status: novoStatus,
        data_pagamento: todayISO(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, movelaria_formas_pagamento_pagar!forma_pagamento_id ( id, nome )')
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? (row as ContaPagar) : x)))
  }

  const reverterPagamento = async (id: string) => {
    const { data: conta, error: fetchErr } = await supabase
      .from('movelaria_contas_pagar')
      .select('id, valor_parcela, valor_pago, fornecedor_nome, descricao, data_vencimento')
      .eq('id', id)
      .in('status', ['pago', 'parcialmente_pago'])
      .maybeSingle()
    if (fetchErr) throw new Error(fetchErr.message)
    if (!conta) throw new Error('Esta conta não está marcada como paga ou parcialmente paga.')

    const mesRef = Number(conta.data_vencimento?.slice(5, 7))
    const anoRef = Number(conta.data_vencimento?.slice(0, 4))
    const descricaoReserva =
      `Reserva automática via pagamento: ${conta.descricao?.trim() || 'Sem descrição'}`

    const { error: reservaIdErr } = await supabase
      .from('movelaria_caixa_movimentacoes')
      .delete()
      .eq('conta_pagar_id', id)
      .eq('tipo_movimentacao', 'reserva')
    if (reservaIdErr) throw new Error(reservaIdErr.message)

    if (conta.fornecedor_nome && mesRef && anoRef) {
      const { data: dests } = await supabase
        .from('movelaria_caixa_destinatarios')
        .select('id')
        .ilike('nome', conta.fornecedor_nome.trim())
        .eq('ativo', true)
        .limit(1)

      const destId = dests?.[0]?.id
      if (destId) {
        const { error: legadoErr } = await supabase
          .from('movelaria_caixa_movimentacoes')
          .delete()
          .eq('tipo_movimentacao', 'reserva')
          .is('conta_pagar_id', null)
          .eq('valor', conta.valor_parcela)
          .eq('descricao', descricaoReserva)
          .eq('mes_referencia', mesRef)
          .eq('ano_referencia', anoRef)
          .eq('destinatario_id', destId)
        if (legadoErr) throw new Error(legadoErr.message)
      }
    }

    const { data: row, error: err } = await supabase
      .from('movelaria_contas_pagar')
      .update({
        status: 'pendente',
        data_pagamento: null,
        valor_pago: 0,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .in('status', ['pago', 'parcialmente_pago'])
      .select('*, movelaria_formas_pagamento_pagar!forma_pagamento_id ( id, nome )')
      .maybeSingle()
    if (err) throw new Error(err.message)
    if (!row) throw new Error('Esta conta não está marcada como paga ou parcialmente paga.')
    setData(prev => prev.map(x => (x.id === id ? (row as ContaPagar) : x)))
  }

  const vincularGrupoLancamento = async (
    contaId: string,
    grupoLancamentoId: string,
    contaIdsRelacionadas?: string[],
  ) => {
    const ids = contaIdsRelacionadas?.length
      ? [...new Set([contaId, ...contaIdsRelacionadas])]
      : [contaId]

    const { error: err } = await supabase
      .from('movelaria_contas_pagar')
      .update({
        grupo_lancamento_id: grupoLancamentoId,
        atualizado_em: new Date().toISOString(),
      })
      .in('id', ids)
    if (err) throw new Error(err.message)
    await load()
  }

  const editarContaPagar = async (
    conta: ContaPagar,
    payload: UpdateContaPagarInput,
    scope: ContaPagarScope,
  ) => {
    const updatedAt = new Date().toISOString()
    const { primeiro_vencimento_grupo, ...restPayload } = payload

    const relacionadas =
      scope === 'group' ? getContasRelacionadas(conta, data) : [conta]

    if (scope === 'group' && relacionadas.length > 1) {
      for (const row of relacionadas) {
        const monthOffset = row.numero_parcela - 1
        const scopedPayload: Record<string, unknown> = {
          ...restPayload,
          atualizado_em: updatedAt,
        }

        if (primeiro_vencimento_grupo) {
          scopedPayload.data_vencimento = addMonths(primeiro_vencimento_grupo, monthOffset)
        } else if (restPayload.data_vencimento) {
          const anchorParcela = conta.numero_parcela || 1
          scopedPayload.data_vencimento = addMonths(
            restPayload.data_vencimento,
            row.numero_parcela - anchorParcela,
          )
        } else {
          delete scopedPayload.data_vencimento
        }

        const { error: rowErr } = await supabase
          .from('movelaria_contas_pagar')
          .update(scopedPayload)
          .eq('id', row.id)

        if (rowErr) throw new Error(rowErr.message)
      }
    } else {
      const singlePayload = { ...restPayload, atualizado_em: updatedAt }
      const { error: err } = await supabase
        .from('movelaria_contas_pagar')
        .update(singlePayload)
        .eq('id', conta.id)
      if (err) throw new Error(err.message)

      const parcelado = lancamentoTemParcelamento(conta, data)
      const valorParcelaAtualizada =
        typeof restPayload.valor_parcela === 'number' ? restPayload.valor_parcela : conta.valor_parcela
      if (parcelado && restPayload.valor_parcela != null && restPayload.valor_total == null) {
        const relacionadas = getContasRelacionadas(conta, data)
        const novoTotal = parseFloat(
          relacionadas
            .reduce(
              (s, c) => s + (c.id === conta.id ? valorParcelaAtualizada : c.valor_parcela),
              0,
            )
            .toFixed(2),
        )
        const ids = relacionadas.map(c => c.id)
        const { error: syncErr } = await supabase
          .from('movelaria_contas_pagar')
          .update({ valor_total: novoTotal, atualizado_em: updatedAt })
          .in('id', ids)
        if (syncErr) throw new Error(syncErr.message)
      }
    }

    await load()
  }

  const excluirContaPagar = async (conta: ContaPagar, scope: ContaPagarScope) => {
    const relacionadas =
      scope === 'group' ? getContasRelacionadas(conta, data) : [conta]
    const ids = relacionadas.map(c => c.id)

    const { error: err } = await supabase
      .from('movelaria_contas_pagar')
      .delete()
      .in('id', ids)

    if (err) throw new Error(err.message)
    await load()
  }

  const excluirContasPagarPorIds = async (ids: string[]) => {
    const unicos = [...new Set(ids.filter(Boolean))]
    if (unicos.length === 0) return

    const { error: err } = await supabase
      .from('movelaria_contas_pagar')
      .delete()
      .in('id', unicos)

    if (err) throw new Error(err.message)
    await load()
  }

  const marcarPagoEmLote = async (itens: { id: string; valor: number }[]) => {
    for (const item of itens) {
      if (!item.valor || item.valor <= 0) continue
      await marcarPago(item.id, item.valor)
    }
  }

  const importarCobrancasUnicas = async (items: CobrancaImportItem[]): Promise<number> => {
    if (items.length === 0) return 0

    const payload = items.map(item => ({
      fornecedor_id: item.fornecedor_id ?? null,
      fornecedor_nome: item.fornecedor_nome,
      descricao: item.descricao,
      observacao: item.observacao?.trim() || null,
      valor: item.valor,
      vencimento: item.vencimento,
    }))

    const { data, error: err } = await supabase.rpc(
      'movelaria_importar_contas_pagar_lote',
      { p_itens: payload },
    )

    if (err) throw new Error(err.message)

    const resultado = data as { inseridas?: number; ignoradas?: number } | null
    await load()
    return resultado?.inseridas ?? 0
  }

  return {
    data,
    loading,
    error,
    gerarParcelas,
    criarRecorrencia,
    encerrarRecorrencia,
    atualizarRecorrencia,
    marcarPago,
    reverterPagamento,
    vincularGrupoLancamento,
    editarContaPagar,
    excluirContaPagar,
    excluirContasPagarPorIds,
    marcarPagoEmLote,
    importarCobrancasUnicas,
    reload: load,
  }
}
