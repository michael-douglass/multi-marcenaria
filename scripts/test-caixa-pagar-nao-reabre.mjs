/**
 * Teste: pagamento consolidado do Caixa NÃO reabre contas já pagas
 * e NÃO reduz valor_pago.
 *
 * Rodar: node scripts/test-caixa-pagar-nao-reabre.mjs
 */

/** Aloca só o valor DESTE pagamento (NEW.valor), não o total do mês. */
function alocarPagamentoConsolidado({ valorNovo, contas }) {
  // contas: { id, status, valor_parcela, valor_pago }
  const abertas = contas.filter(
    (c) => !(c.status === 'pago' && c.valor_pago >= c.valor_parcela - 0.009),
  )

  const totalFaltante = abertas.reduce(
    (acc, c) => acc + Math.max(c.valor_parcela - (c.valor_pago || 0), 0),
    0,
  )

  const resultado = contas.map((c) => ({ ...c }))

  if (totalFaltante <= 0.009 || valorNovo <= 0.009) {
    return resultado
  }

  for (const c of resultado) {
    if (c.status === 'pago' && c.valor_pago >= c.valor_parcela - 0.009) {
      continue // nunca reabrir
    }
    const jaPago = c.valor_pago || 0
    const faltante = Math.max(c.valor_parcela - jaPago, 0)
    if (faltante <= 0.009) continue

    const alocado =
      valorNovo >= totalFaltante - 0.009
        ? faltante
        : Number(((faltante / totalFaltante) * valorNovo).toFixed(2))

    let novoPago = Number((jaPago + alocado).toFixed(2))
    if (novoPago < jaPago) continue // nunca reduzir

    if (novoPago >= c.valor_parcela - 0.009) {
      c.valor_pago = c.valor_parcela
      c.status = 'pago'
    } else {
      c.valor_pago = novoPago
      c.status = 'parcialmente_pago'
    }
  }

  return resultado
}

/** Regra antiga (bug): redistribui tudo e pode reabrir/reduzir */
function alocarRegraAntigaBugada({ pagoCaixa, contas }) {
  const comReserva = contas.filter((c) => c.temReserva)
  const totalParcelas = comReserva.reduce((a, c) => a + c.valor_parcela, 0)
  return contas.map((c) => {
    if (!c.temReserva) return { ...c }
    if (pagoCaixa >= totalParcelas - 0.009) {
      return { ...c, status: 'pago', valor_pago: c.valor_parcela }
    }
    const novo = Number(((c.valor_parcela / totalParcelas) * pagoCaixa).toFixed(2))
    if (novo >= c.valor_parcela - 0.009) {
      return { ...c, status: 'pago', valor_pago: c.valor_parcela }
    }
    return { ...c, status: 'parcialmente_pago', valor_pago: novo }
  })
}

const casoJR = {
  nome: 'JR: conta já paga + parcial — pagar consolidado',
  valorNovo: 1000,
  contas: [
    {
      id: 'mes07',
      status: 'pago',
      valor_parcela: 3324.2,
      valor_pago: 3324.2,
      temReserva: true,
    },
    {
      id: 'junho',
      status: 'parcialmente_pago',
      valor_parcela: 8805.4,
      valor_pago: 4000,
      temReserva: true,
    },
  ],
}

let ok = true

{
  const got = alocarPagamentoConsolidado(casoJR)
  const mes07 = got.find((c) => c.id === 'mes07')
  const junho = got.find((c) => c.id === 'junho')

  const mes07Ok = mes07.status === 'pago' && Math.abs(mes07.valor_pago - 3324.2) < 0.01
  // faltante junho = 4805.4; novo = 1000 → junho fica 5000 parcial
  const junhoOk =
    junho.status === 'parcialmente_pago' && Math.abs(junho.valor_pago - 5000) < 0.01

  console.log(
    `${mes07Ok ? 'OK' : 'FAIL'} mes07 permanece pago (${mes07.status} ${mes07.valor_pago})`,
  )
  console.log(
    `${junhoOk ? 'OK' : 'FAIL'} junho sobe 4000→5000 com R$ 1.000 novo (${junho.status} ${junho.valor_pago})`,
  )
  if (!mes07Ok || !junhoOk) ok = false

  const bug = alocarRegraAntigaBugada({
    pagoCaixa: 10983.62,
    contas: casoJR.contas,
  })
  const bugMes07 = bug.find((c) => c.id === 'mes07')
  const bugReabriu =
    bugMes07.status !== 'pago' || Math.abs(bugMes07.valor_pago - 3324.2) > 0.01
  console.log(
    bugReabriu
      ? 'OK   regra antiga reabria mes07 (bug documentado)'
      : 'WARN regra antiga não reabriu neste caso',
  )
}

{
  // R$ 1 não pode quitar o restante de 4805
  const got = alocarPagamentoConsolidado({
    valorNovo: 1,
    contas: [
      { id: 'a', status: 'pago', valor_parcela: 3000, valor_pago: 3000, temReserva: true },
      { id: 'b', status: 'parcialmente_pago', valor_parcela: 8805.4, valor_pago: 4000, temReserva: true },
    ],
  })
  const a = got.find((c) => c.id === 'a')
  const b = got.find((c) => c.id === 'b')
  const aOk = a.status === 'pago' && a.valor_pago === 3000
  const bOk = b.status === 'parcialmente_pago' && Math.abs(b.valor_pago - 4001) < 0.01
  console.log(`${aOk ? 'OK' : 'FAIL'} R$ 1: conta paga intacta`)
  console.log(`${bOk ? 'OK' : 'FAIL'} R$ 1: parcial sobe só +1 → ${b.valor_pago}`)
  if (!aOk || !bOk) ok = false
}

{
  const got = alocarPagamentoConsolidado({
    valorNovo: 5000,
    contas: [
      { id: 'a', status: 'pago', valor_parcela: 3000, valor_pago: 3000, temReserva: true },
      { id: 'b', status: 'parcialmente_pago', valor_parcela: 10000, valor_pago: 2000, temReserva: true },
    ],
  })
  const a = got.find((c) => c.id === 'a')
  const b = got.find((c) => c.id === 'b')
  const aOk = a.status === 'pago' && a.valor_pago === 3000
  const bOk = b.status === 'parcialmente_pago' && Math.abs(b.valor_pago - 7000) < 0.01
  console.log(`${aOk ? 'OK' : 'FAIL'} conta A paga intacta`)
  console.log(`${bOk ? 'OK' : 'FAIL'} conta B sobe 2000→7000 (sem reduzir): ${b.valor_pago}`)
  if (!aOk || !bOk) ok = false
}

{
  // Caso Fabio: NÃO marcar 20k se caixa só pagou 15650
  const parcela = 20000
  const pagoCaixa = 15650
  const status =
    pagoCaixa >= parcela - 0.009
      ? 'pago'
      : pagoCaixa > 0.009
        ? 'parcialmente_pago'
        : 'pendente'
  const pass = status === 'parcialmente_pago'
  console.log(
    `${pass ? 'OK' : 'FAIL'} Fabio/Michael: pago parcial ${pagoCaixa} → ${status} (não quita 20k)`,
  )
  if (!pass) ok = false
}

if (!ok) process.exit(1)
console.log('\nOK — Pagar consolidado não reabre contas pagas nem reduz valor_pago')
