/** Quanto ainda pode sair da reserva: reservado − já pago. */
export function calcValorAPagarDaReserva(reservado: number, jaPago: number) {
  return Math.max(0, Number((reservado - jaPago).toFixed(2)))
}
