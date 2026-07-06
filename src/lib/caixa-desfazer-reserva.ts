import { supabase } from '@/lib/supabase'

async function recalcularSaldoFornecedorAposEstorno(fornecedorId: string): Promise<void> {
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
}

async function estornarDebitosContaPagar(contaPagarId: string): Promise<void> {
  const { data: txs, error: fetchErr } = await supabase
    .from('movelaria_transacoes_caixa_fornecedor')
    .select('fornecedor_id')
    .eq('conta_pagar_id', contaPagarId)
    .eq('tipo', 'debito')
  if (fetchErr) throw new Error(fetchErr.message)
  if (!txs?.length) return

  const fornecedorId = txs[0].fornecedor_id
  const { error: delErr } = await supabase
    .from('movelaria_transacoes_caixa_fornecedor')
    .delete()
    .eq('conta_pagar_id', contaPagarId)
    .eq('tipo', 'debito')
  if (delErr) throw new Error(delErr.message)

  await recalcularSaldoFornecedorAposEstorno(fornecedorId)
}

/** Reverte uma conta paga/parcial no caixa e remove reservas vinculadas. */
export async function reverterContaPagarReservaCaixa(contaPagarId: string): Promise<void> {
  const { data: conta, error: fetchErr } = await supabase
    .from('movelaria_contas_pagar')
    .select('id, valor_parcela, fornecedor_nome, descricao, data_vencimento, status')
    .eq('id', contaPagarId)
    .maybeSingle()
  if (fetchErr) throw new Error(fetchErr.message)
  if (!conta) return

  const mesRef = Number(conta.data_vencimento?.slice(5, 7))
  const anoRef = Number(conta.data_vencimento?.slice(0, 4))
  const descricaoReserva =
    `Reserva automática via pagamento: ${conta.descricao?.trim() || 'Sem descrição'}`

  await estornarDebitosContaPagar(contaPagarId)

  const { error: reservaIdErr } = await supabase
    .from('movelaria_caixa_movimentacoes')
    .delete()
    .eq('conta_pagar_id', contaPagarId)
    .in('tipo_movimentacao', ['reserva', 'pagamento'])
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

  if (conta.status === 'pago' || conta.status === 'parcialmente_pago') {
    const { error: err } = await supabase
      .from('movelaria_contas_pagar')
      .update({
        status: 'pendente',
        data_pagamento: null,
        valor_pago: 0,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', contaPagarId)
      .in('status', ['pago', 'parcialmente_pago'])
    if (err) throw new Error(err.message)
  }
}

export interface DesfazerReservaResult {
  contasRevertidas: number
  reservasManuaisRemovidas: number
}

/**
 * Remove reservas do destinatário no mês e devolve contas vinculadas para "a pagar".
 */
export async function desfazerReservaDestinatarioMes(input: {
  destinatarioId: string
  mes: number
  ano: number
}): Promise<DesfazerReservaResult> {
  const { destinatarioId, mes, ano } = input

  const { data: movs, error: movErr } = await supabase
    .from('movelaria_caixa_movimentacoes')
    .select('id, conta_pagar_id, tipo_movimentacao')
    .eq('destinatario_id', destinatarioId)
    .eq('mes_referencia', mes)
    .eq('ano_referencia', ano)
    .in('tipo_movimentacao', ['reserva', 'pagamento'])
  if (movErr) throw new Error(movErr.message)

  const contaIds = [
    ...new Set(
      (movs ?? [])
        .map(m => m.conta_pagar_id)
        .filter((id): id is string => !!id),
    ),
  ]

  let contasRevertidas = 0
  for (const contaId of contaIds) {
    await reverterContaPagarReservaCaixa(contaId)
    contasRevertidas += 1
  }

  const { data: manuais, error: manualErr } = await supabase
    .from('movelaria_caixa_movimentacoes')
    .delete()
    .eq('destinatario_id', destinatarioId)
    .eq('mes_referencia', mes)
    .eq('ano_referencia', ano)
    .eq('tipo_movimentacao', 'reserva')
    .is('conta_pagar_id', null)
    .select('id')
  if (manualErr) throw new Error(manualErr.message)

  return {
    contasRevertidas,
    reservasManuaisRemovidas: manuais?.length ?? 0,
  }
}
