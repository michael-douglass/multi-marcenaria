/**
 * Teste: valor a pagar no dialog = Reservado − Já pago
 * e total de saldos a pagar no rodapé do Caixa.
 * Rodar: node scripts/test-caixa-pagar-reserva.mjs
 */
function calcValorAPagarDaReserva(reservado, jaPago) {
  return Math.max(0, Number((reservado - jaPago).toFixed(2)))
}

function totalSaldosAPagar(itens) {
  return Number(
    itens
      .reduce((acc, item) => acc + calcValorAPagarDaReserva(item.reservado, item.pago), 0)
      .toFixed(2),
  )
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

const amostraRodape = [
  { reservado: 1220, pago: 0 },   // R$ 1.220,00
  { reservado: 1430, pago: 0 },   // R$ 1.430,00
  { reservado: 5000, pago: 3800 }, // R$ 1.200,00
  { reservado: 2200, pago: 2200 }, // R$ 0 (já quitado)
]
const totalEsperado = 1220 + 1430 + 1200
const totalGot = totalSaldosAPagar(amostraRodape)
const totalOk = Math.abs(totalGot - totalEsperado) < 0.001
console.log(
  `${totalOk ? 'OK' : 'FAIL'} Total saldos a pagar no rodapé: ${totalGot} (esperado ${totalEsperado})`,
)
if (!totalOk) ok = false

if (!ok) process.exit(1)
console.log('\nOK — A pagar = Reservado − Já pago; rodapé soma todos os saldos a pagar')
