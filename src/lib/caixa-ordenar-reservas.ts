import type { ReservaConsolidada } from '@/types'

const EPS = 0.009

/**
 * Ordem de exibição no Caixa (aba Reservas):
 * 1 — reserva parcial (já tem algo reservado, mas não o total)
 * 2 — em aberto, sem valor reservado
 * 3 — valor totalmente reservado (ainda não pago)
 * 4 — status pago
 */
export type PrioridadeOrdemCaixa = 1 | 2 | 3 | 4

export function prioridadeOrdemReservaCaixa(item: Pick<
  ReservaConsolidada,
  'valor_total_real' | 'valor_em_reserva' | 'total_pago'
>): PrioridadeOrdemCaixa {
  const real = item.valor_total_real
  const reservado = item.valor_em_reserva
  const pago = item.total_pago

  // 4. Pago (total já quitado)
  if (real > EPS && pago >= real - EPS) return 4
  if (real <= EPS && pago > EPS) return 4

  // 3. Totalmente reservado (e ainda não pago)
  if (real > EPS && reservado >= real - EPS) return 3
  if (real <= EPS && reservado > EPS) return 3

  // 1. Reserva parcial
  if (reservado > EPS) return 1

  // 2. Em aberto, sem reserva
  return 2
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
