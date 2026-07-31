/**
 * Teste rápido da ordem do Caixa (sem dependências).
 * Rodar: node scripts/test-caixa-ordenar-reservas.mjs
 */
const EPS = 0.009

function prioridade(item) {
  const real = item.valor_total_real
  const reservado = item.valor_em_reserva
  const pago = item.total_pago

  if (real > EPS && pago >= real - EPS) return 4
  if (real <= EPS && pago > EPS) return 4
  if (real > EPS && reservado >= real - EPS) return 3
  if (real <= EPS && reservado > EPS) return 3
  if (reservado > EPS) return 1
  return 2
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
  { destinatario_nome: 'Beta Parcial', valor_total_real: 800, valor_em_reserva: 200, total_pago: 0 },
  { destinatario_nome: 'Delta Full Reserva', valor_total_real: 700, valor_em_reserva: 700, total_pago: 0 },
  { destinatario_nome: 'Charlie Parcial', valor_total_real: 900, valor_em_reserva: 100, total_pago: 50 },
  { destinatario_nome: 'Echo Aberto', valor_total_real: 300, valor_em_reserva: 0, total_pago: 0 },
]

const esperado = [
  'Beta Parcial',
  'Charlie Parcial',
  'Alpha Aberto',
  'Echo Aberto',
  'Delta Full Reserva',
  'Zeta Pago',
]

const obtido = ordenar(amostra).map(i => i.destinatario_nome)
const ok = JSON.stringify(obtido) === JSON.stringify(esperado)

console.log('Ordem obtida:')
obtido.forEach((nome, i) => {
  const item = amostra.find(a => a.destinatario_nome === nome)
  console.log(`  ${i + 1}. [prio ${prioridade(item)}] ${nome}`)
})

if (!ok) {
  console.error('\nFALHOU. Esperado:', esperado)
  process.exit(1)
}

console.log('\nOK — ordem parcial → aberto → reservado total → pago')
