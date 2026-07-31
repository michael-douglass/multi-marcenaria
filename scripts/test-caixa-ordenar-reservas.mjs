/**
 * Ordem do Caixa (aba Reservas):
 * 1   — em aberto, sem reservado
 * 1.5 — status parcial (já pago algo)
 * 2   — em aberto, com reservado (ainda sem pagamento)
 * 3   — pago (por último)
 *
 * Escala interna: 1 | 2 | 3 | 4
 * Rodar: node scripts/test-caixa-ordenar-reservas.mjs
 */
const EPS = 0.009

function prioridade(item) {
  const real = item.valor_total_real
  const reservado = item.valor_em_reserva
  const pago = item.total_pago

  if (real > EPS && pago >= real - EPS) return 4
  if (real <= EPS && pago > EPS) return 4
  if (pago > EPS) return 2
  if (reservado > EPS) return 3
  return 1
}

function ordenar(itens) {
  return [...itens].sort((a, b) => {
    const pa = prioridade(a)
    const pb = prioridade(b)
    if (pa !== pb) return pa - pb
    return a.destinatario_nome.localeCompare(b.destinatario_nome, 'pt-BR', {
      sensitivity: 'base',
    })
  })
}

const amostra = [
  { destinatario_nome: 'Zeta Pago', valor_total_real: 1000, valor_em_reserva: 1000, total_pago: 1000 },
  { destinatario_nome: 'Alpha Aberto', valor_total_real: 500, valor_em_reserva: 0, total_pago: 0 },
  { destinatario_nome: 'Beta Com Reserva', valor_total_real: 800, valor_em_reserva: 200, total_pago: 0 },
  { destinatario_nome: 'Delta Full Reserva', valor_total_real: 700, valor_em_reserva: 700, total_pago: 0 },
  { destinatario_nome: 'Charlie Parcial', valor_total_real: 900, valor_em_reserva: 100, total_pago: 50 },
  { destinatario_nome: 'Echo Aberto', valor_total_real: 300, valor_em_reserva: 0, total_pago: 0 },
  { destinatario_nome: 'Fabio Parcial', valor_total_real: 20000, valor_em_reserva: 7370, total_pago: 7000 },
  { destinatario_nome: 'Gama Parcial Sem Reserva', valor_total_real: 1000, valor_em_reserva: 0, total_pago: 200 },
]

const esperado = [
  // 1 — sem reserva
  'Alpha Aberto',
  'Echo Aberto',
  // 1.5 — parcial
  'Charlie Parcial',
  'Fabio Parcial',
  'Gama Parcial Sem Reserva',
  // 2 — com reserva, sem pagamento
  'Beta Com Reserva',
  'Delta Full Reserva',
  // 3 — pago
  'Zeta Pago',
]

const obtido = ordenar(amostra).map(i => i.destinatario_nome)
const ok = JSON.stringify(obtido) === JSON.stringify(esperado)

console.log('Ordem obtida:')
obtido.forEach((nome, i) => {
  const item = amostra.find(a => a.destinatario_nome === nome)
  const label = { 1: '1', 2: '1.5', 3: '2', 4: '3' }[prioridade(item)]
  console.log(`  ${i + 1}. [prio ${label}] ${nome}`)
})

if (!ok) {
  console.error('\nFALHOU. Esperado:', esperado)
  process.exit(1)
}

console.log('\nOK — ordem: aberto sem reserva → parcial → aberto com reserva → pago')
