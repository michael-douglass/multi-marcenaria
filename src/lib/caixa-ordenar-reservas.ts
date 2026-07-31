import type { ReservaConsolidada } from '@/types'

const EPS = 0.009

/**
 * Ordem de exibição no Caixa (aba Reservas):
 * 1   — em aberto, sem valor na coluna Reservado
 * 1.5 — status parcial (já tem algum valor pago, ainda não quitado)
 * 2   — em aberto, com algum valor reservado (e ainda sem pagamento parcial)
 * 3   — status Pago (fica por último)
 *
 * Internamente usamos 1 | 2 | 3 | 4 (1.5 → 2 na escala inteira).
 */
export type PrioridadeOrdemCaixa = 1 | 2 | 3 | 4

function isStatusPago(real: number, pago: number): boolean {
  if (real > EPS && pago >= real - EPS) return true
  if (real <= EPS && pago > EPS) return true
  return false
}

function isStatusParcial(real: number, pago: number): boolean {
  if (isStatusPago(real, pago)) return false
  return pago > EPS
}

export function prioridadeOrdemReservaCaixa(item: Pick<
  ReservaConsolidada,
  'valor_total_real' | 'valor_em_reserva' | 'total_pago'
>): PrioridadeOrdemCaixa {
  const real = item.valor_total_real
  const reservado = item.valor_em_reserva
  const pago = item.total_pago

  // 3. Pago
  if (isStatusPago(real, pago)) return 4

  // 1.5. Parcial (já pago algo, ainda não quitado)
  if (isStatusParcial(real, pago)) return 2

  // 2. Em aberto com reserva (sem pagamento ainda)
  if (reservado > EPS) return 3

  // 1. Em aberto sem reserva
  return 1
}

export function ordenarReservasCaixa<T extends Pick<
  ReservaConsolidada,
  'destinatario_nome' | 'valor_total_real' | 'valor_em_reserva' | 'total_pago'
>>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    const pa = prioridadeOrdemReservaCaixa(a)
    const pb = prioridadeOrdemReservaCaixa(b)
    if (pa !== pb) return pa - pb
    return a.destinatario_nome.localeCompare(b.destinatario_nome, 'pt-BR', {
      sensitivity: 'base',
    })
  })
}
