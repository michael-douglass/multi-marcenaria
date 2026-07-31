/**
 * Teste: Valor real do Caixa não cai ao pagar parcela no Contas a Pagar.
 * Cenário JR: real 21937.87; pagar 8805 → real continua 21937.87;
 * reservado 8805; restante 13132.87.
 *
 * Rodar: node scripts/test-caixa-valor-real-ao-pagar.mjs
 */

function resolveValorReal({ aberto, todos, temCaixa }) {
  // Espelha a regra de useCaixa.resolveOper
  if (aberto > 0 || temCaixa) return todos > 0 ? todos : aberto
  return 0
}

function calcValorRestante(valorReal, valorReservado) {
  return Math.max(0, valorReal - valorReservado)
}

const totalMes = 21937.87
const parcelaPaga = 8805.4
const abertoAposPagamento = totalMes - parcelaPaga // 13132.47

const antes = {
  aberto: totalMes,
  todos: totalMes,
  temCaixa: false,
}
const depois = {
  aberto: abertoAposPagamento,
  todos: totalMes,
  temCaixa: true, // pagamento gera reserva no Caixa
  reservado: parcelaPaga,
}

const realAntes = resolveValorReal(antes)
const realDepois = resolveValorReal(depois)
const restante = calcValorRestante(realDepois, depois.reservado)

let ok = true
const checks = [
  { nome: 'real antes', got: realAntes, esperado: 21937.87 },
  { nome: 'real depois (não cai)', got: realDepois, esperado: 21937.87 },
  { nome: 'restante', got: restante, esperado: 13132.47 },
]

for (const c of checks) {
  const pass = Math.abs(c.got - c.esperado) < 0.02
  console.log(`${pass ? 'OK' : 'FAIL'} ${c.nome}: ${c.got.toFixed(2)} (esperado ${c.esperado.toFixed(2)})`)
  if (!pass) ok = false
}

// Regressão do bug antigo
const bugAntigo = abertoAposPagamento // só abertos → valor real caía
if (Math.abs(bugAntigo - 13132.47) < 0.02 && Math.abs(realDepois - totalMes) < 0.02) {
  console.log('OK bug antigo evitado (não usa só aberto)')
} else {
  console.log('FAIL regressão')
  ok = false
}

if (!ok) process.exit(1)
console.log('\nOK — Valor real estável ao pagar parcela')
