/**
 * Teste expandido: tom + headline + valor em destaque.
 * Espelha buildSaldoMesInsightMessage / resolveSaldoMesInsightTone.
 * pnpm exec node scripts/test-saldo-mes-insight.mjs
 */
import assert from 'node:assert/strict'

const LIMITE_QUASE = 40_000
const LIMITE_ALERTA = 60_000

function fmtCur(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function roundMoney(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function resolveTone(saldo) {
  if (saldo >= 0) return 'sucesso'
  const falta = Math.abs(saldo)
  if (falta < LIMITE_QUASE) return 'quase'
  if (falta > LIMITE_ALERTA) return 'alerta'
  return 'falta'
}

function buildMessage({ totalAReceber, totalAPagarMes }) {
  const receber = roundMoney(Number(totalAReceber) || 0)
  const pagar = roundMoney(Number(totalAPagarMes) || 0)
  const saldo = roundMoney(receber - pagar)
  const tone = resolveTone(saldo)

  if (tone === 'sucesso') {
    return {
      tone,
      headline: 'Você está um sucesso!',
      detail: `A previsão é para o caixa passar ${fmtCur(receber)} em faturamento.`,
      valorDestaque: receber,
      saldo,
    }
  }

  const falta = Math.abs(saldo)
  if (tone === 'quase') {
    return {
      tone,
      headline: 'Falta pouco',
      detail: `${fmtCur(falta)} para fechar o mês.`,
      valorDestaque: falta,
      saldo,
    }
  }
  if (tone === 'alerta') {
    return {
      tone,
      headline: 'Ainda falta',
      detail: `${fmtCur(falta)} para fechar o mês.`,
      valorDestaque: falta,
      saldo,
    }
  }
  return {
    tone,
    headline: 'Faltam',
    detail: `${fmtCur(falta)} para fechar o mês.`,
    valorDestaque: falta,
    saldo,
  }
}

function clampConfig(partial) {
  const intervalMs = Math.min(60 * 60 * 1000, Math.max(30_000, Number(partial.intervalMs) || 300_000))
  const durationMs = Math.min(60_000, Math.max(2_000, Number(partial.durationMs) || 5_000))
  return {
    intervalMs,
    durationMs,
    enabled: partial.enabled ?? true,
  }
}

const toneCases = [
  { saldo: 12_500, expect: 'sucesso', label: 'superávit → sucesso' },
  { saldo: 0, expect: 'sucesso', label: 'zerado → sucesso' },
  { saldo: -38_339.77, expect: 'quase', label: 'exemplo dashboard (−38k) → só palavras' },
  { saldo: -39_999.99, expect: 'quase', label: 'quase no limite 40k' },
  { saldo: -40_000, expect: 'falta', label: 'exatos 40k → Faltam' },
  { saldo: -55_000, expect: 'falta', label: 'faixa média → Faltam' },
  { saldo: -60_000, expect: 'falta', label: 'exatos 60k → Faltam' },
  { saldo: -60_000.01, expect: 'alerta', label: 'acima de 60k → Ainda falta' },
  { saldo: -120_000, expect: 'alerta', label: 'buraco grande → Ainda falta' },
]

let failed = 0
function check(label, fn) {
  try {
    fn()
    console.log(`ok  ${label}`)
  } catch (err) {
    failed += 1
    console.error(`fail ${label}`)
    console.error(err.message)
  }
}

for (const c of toneCases) {
  check(c.label, () => assert.equal(resolveTone(c.saldo), c.expect))
}

check('mensagem sucesso usa a receber como faturamento', () => {
  const msg = buildMessage({ totalAReceber: 80_000, totalAPagarMes: 20_000 })
  assert.equal(msg.tone, 'sucesso')
  assert.equal(msg.headline, 'Você está um sucesso!')
  assert.equal(msg.valorDestaque, 80_000)
  assert.match(msg.detail, /passar/)
  assert.match(msg.detail, /faturamento/)
})

check('mensagem quase: mostra o valor que falta', () => {
  const msg = buildMessage({ totalAReceber: 10_000, totalAPagarMes: 48_339.77 })
  assert.equal(msg.tone, 'quase')
  assert.equal(msg.headline, 'Falta pouco')
  assert.equal(msg.valorDestaque, 38_339.77)
  assert.match(msg.detail, /para fechar o mês/)
})

check('mensagem falta (40–60k) com valor absoluto', () => {
  const msg = buildMessage({ totalAReceber: 10_000, totalAPagarMes: 60_000 })
  assert.equal(msg.tone, 'falta')
  assert.equal(msg.headline, 'Faltam')
  assert.equal(msg.valorDestaque, 50_000)
})

check('mensagem alerta (>60k)', () => {
  const msg = buildMessage({ totalAReceber: 10_000, totalAPagarMes: 90_000 })
  assert.equal(msg.tone, 'alerta')
  assert.equal(msg.headline, 'Ainda falta')
  assert.equal(msg.valorDestaque, 80_000)
})

check('defaults 5min / 5s', () => {
  const cfg = clampConfig({ intervalMs: 5 * 60 * 1000, durationMs: 5_000, enabled: true })
  assert.equal(cfg.intervalMs, 300_000)
  assert.equal(cfg.durationMs, 5_000)
  assert.equal(cfg.enabled, true)
})

check('clamp mínimo de intervalo/duração', () => {
  const tooLow = clampConfig({ intervalMs: 1_000, durationMs: 100 })
  assert.equal(tooLow.intervalMs, 30_000)
  assert.equal(tooLow.durationMs, 2_000)
})

check('arquivos do épico existem', async () => {
  const { access } = await import('node:fs/promises')
  const root = new URL('..', import.meta.url)
  const files = [
    'src/lib/saldo-mes-insight.ts',
    'src/components/dashboard/SaldoMesInsightAura.tsx',
    'src/components/dashboard/SaldoMesInsightCard.tsx',
    'src/components/dashboard/SaldoMesInsightHost.tsx',
  ]
  for (const rel of files) {
    await access(new URL(rel, root))
  }
})

check('MainLayout monta o host', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../src/components/layout/MainLayout.tsx', import.meta.url), 'utf8')
  assert.match(src, /SaldoMesInsightHost/)
  assert.match(src, /showSaldoMesInsight/)
})

check('CSS de entrada/saída do card', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  assert.match(css, /\.saldo-mes-insight-enter/)
  assert.match(css, /\.saldo-mes-insight-exit/)
  assert.match(css, /@keyframes saldoMesInsightEnter/)
})

if (failed > 0) {
  console.error(`\n${failed} caso(s) falharam`)
  process.exit(1)
}

console.log('\nTodos os checks dos épicos passaram.')
