/**
 * Teste: valor a pagar no dialog = Reservado − Já pago
 * Rodar: node scripts/test-caixa-pagar-reserva.mjs
 */
function calcValorAPagarDaReserva(reservado, jaPago) {
  return Math.max(0, Number((reservado - jaPago).toFixed(2)))
}

const casos = [
  { nome: 'Pro labore parcial', reservado: 7370, pago: 7000, esperado: 370 },
  { nome: 'Exemplo usuário (~350)', reservado: 7370, pago: 7020, esperado: 350 },
  { nome: 'Nada pago', reservado: 8805.4, pago: 0, esperado: 8805.4 },
  { nome: 'Tudo pago', reservado: 3200, pago: 3200, esperado: 0 },
  { nome: 'Pago > reservado', reservado: 100, pago: 150, esperado: 0 },
]

let ok = true
for (const c of casos) {
  const got = calcValorAPagarDaReserva(c.reservado, c.pago)
  const pass = Math.abs(got - c.esperado) < 0.001
  console.log(`${pass ? 'OK' : 'FAIL'} ${c.nome}: ${got} (esperado ${c.esperado})`)
  if (!pass) ok = false
}

if (!ok) process.exit(1)
console.log('\nOK — A pagar = Reservado − Já pago')
