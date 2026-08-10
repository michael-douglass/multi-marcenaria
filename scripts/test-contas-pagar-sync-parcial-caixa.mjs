/**
 * Teste isolado: sync Contas a Pagar × pagamento parcial do Caixa
 * (caso Pro labore Fabio).
 *
 * Rodar: node scripts/test-contas-pagar-sync-parcial-caixa.mjs
 */

function calcStatusEValorPago({ valorParcela, pagoCaixa }) {
  const pago = Math.min(Number(pagoCaixa) || 0, Number(valorParcela) || 0)
  if (pago >= valorParcela - 0.009) {
    return { status: 'pago', valor_pago: valorParcela, restante: 0 }
  }
  if (pago > 0.009) {
    return {
      status: 'parcialmente_pago',
      valor_pago: Number(pago.toFixed(2)),
      restante: Number((valorParcela - pago).toFixed(2)),
    }
  }
  return { status: 'pendente', valor_pago: 0, restante: valorParcela }
}

/** Regra antiga (bug): se pago >= reserva → quita valor_parcela inteiro */
function calcStatusRegraAntigaBugada({ valorParcela, pagoCaixa, reservadoCaixa }) {
  if (pagoCaixa >= reservadoCaixa - 0.009 && pagoCaixa > 0) {
    return { status: 'pago', valor_pago: valorParcela, restante: 0 }
  }
  return calcStatusEValorPago({ valorParcela, pagoCaixa })
}

const casos = [
  {
    nome: 'Pro labore Fabio ago/2026',
    valorParcela: 20000,
    pagoCaixa: 15650,
    reservadoCaixa: 20000,
    esperado: { status: 'parcialmente_pago', valor_pago: 15650, restante: 4350 },
  },
  {
    nome: 'Quitação real (pago = parcela)',
    valorParcela: 20000,
    pagoCaixa: 20000,
    reservadoCaixa: 20000,
    esperado: { status: 'pago', valor_pago: 20000, restante: 0 },
  },
  {
    nome: 'Reserva menor que parcela — NÃO quitar no total',
    valorParcela: 20000,
    pagoCaixa: 7370,
    reservadoCaixa: 7370,
    esperado: { status: 'parcialmente_pago', valor_pago: 7370, restante: 12630 },
  },
  {
    nome: 'Sem pagamento',
    valorParcela: 20000,
    pagoCaixa: 0,
    reservadoCaixa: 20000,
    esperado: { status: 'pendente', valor_pago: 0, restante: 20000 },
  },
]

let ok = true
for (const c of casos) {
  const got = calcStatusEValorPago(c)
  const bug = calcStatusRegraAntigaBugada(c)
  const pass =
    got.status === c.esperado.status
    && Math.abs(got.valor_pago - c.esperado.valor_pago) < 0.01
    && Math.abs(got.restante - c.esperado.restante) < 0.01

  const bugMarcariaIntegral =
    bug.status === 'pago' && c.esperado.status !== 'pago'

  if (!pass) {
    ok = false
    console.error(`FAIL ${c.nome}`, { got, esperado: c.esperado })
  } else {
    console.log(
      `OK   ${c.nome} → ${got.status} pago=${got.valor_pago} restante=${got.restante}`
        + (bugMarcariaIntegral ? ' (regra antiga marcaria 20k indevido)' : ''),
    )
  }
}

if (!ok) {
  process.exit(1)
}
console.log('\nTodos os casos passaram.')
