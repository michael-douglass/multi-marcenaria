import { applyPeriodFilter, type PeriodFilter } from '@/components/ui/PeriodFilterBar'
import type { ContaPagar } from '@/types'

/** Valor efetivamente pago (inclui contas antigas marcadas como pago antes do campo valor_pago). */
export function getValorPagoConta(conta: ContaPagar): number {
  if (conta.valor_pago != null && conta.valor_pago > 0) return conta.valor_pago
  if (conta.status === 'pago') return conta.valor_parcela
  return 0
}

/** Data usada para saber em qual mês/período o pagamento entrou. */
export function getDataReferenciaPagamento(conta: ContaPagar): string | null {
  if (conta.data_pagamento) return conta.data_pagamento
  if (conta.status === 'pago') return conta.data_vencimento ?? null
  return null
}

export function contaPagaNoPeriodo(conta: ContaPagar, period: PeriodFilter): boolean {
  const valor = getValorPagoConta(conta)
  if (valor <= 0) return false
  const dataRef = getDataReferenciaPagamento(conta)
  if (!dataRef) return false
  return applyPeriodFilter([{ data_vencimento: dataRef }], period).length > 0
}

export function somarPagamentosNoPeriodo(contas: ContaPagar[], period: PeriodFilter): number {
  return contas
    .filter(c => contaPagaNoPeriodo(c, period))
    .reduce((s, c) => s + getValorPagoConta(c), 0)
}
