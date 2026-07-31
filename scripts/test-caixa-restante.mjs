/**
 * Teste: Restante = Valor real − Reservado
 * Rodar: node scripts/test-caixa-restante.mjs
 */
function calcValorRestante(valorReal, valorReservado) {
  return Math.max(0, valorReal - valorReservado)
}

const casos = [
  { nome: 'Michael', real: 20000, reservado: 7370, esperado: 12630 },
  { nome: 'Totalmente reservado', real: 1000, reservado: 1000, esperado: 0 },
  { nome: 'Sem reserva', real: 500, reservado: 0, esperado: 500 },
  { nome: 'Reserva > real', real: 100, reservado: 150, esperado: 0 },
]

let ok = true
for (const c of casos) {
  const got = calcValorRestante(c.real, c.reservado)
  const pass = Math.abs(got - c.esperado) < 0.001
  console.log(`${pass ? 'OK' : 'FAIL'} ${c.nome}: ${got} (esperado ${c.esperado})`)
  if (!pass) ok = false
}

if (!ok) process.exit(1)
console.log('\nOK — Restante = Valor real − Reservado')
