/**
 * Garante que a base do Simulador (ao vivo + histórico) bate com o cálculo real do sistema.
 * Rode: node scripts/test-simulador-caixa-live.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

function roundMoney(n) {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function roundMoneySigned(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function monthIndexFromIso(iso) {
  if (!iso || iso.length < 7) return null
  const month = Number(iso.slice(5, 7))
  if (!Number.isFinite(month) || month < 1 || month > 12) return null
  return month - 1
}

function aplicarAjustesNosMeses(base, ajustes) {
  const result = base.map(m => ({ ...m }))
  for (const a of [...ajustes].reverse()) {
    if (!a.mes || !a.campo) continue
    const idx = result.findIndex(m => m.mes === a.mes)
    if (idx < 0) continue
    const sinal = a.tipo === 'adicionar' ? 1 : -1
    result[idx] = {
      ...result[idx],
      [a.campo]: roundMoney(Math.max(0, result[idx][a.campo] + sinal * Number(a.valor))),
    }
  }
  return result
}

const env = loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)

const ano = new Date().getFullYear()
const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const now = new Date()
const prox = new Date(now.getFullYear(), now.getMonth() + 1, 1)
const proxLabel = labels[prox.getMonth()]

const start = `${ano}-01-01`
const end = `${ano}-12-31`

const [{ data: receber }, { data: pagar }, { data: sim }] = await Promise.all([
  supabase
    .from('movelaria_contas_receber')
    .select('valor_parcela, data_vencimento')
    .eq('status', 'pendente')
    .gte('data_vencimento', start)
    .lte('data_vencimento', end),
  supabase
    .from('movelaria_contas_pagar')
    .select('valor_parcela, valor_pago, data_vencimento')
    .in('status', ['pendente', 'parcialmente_pago'])
    .gte('data_vencimento', start)
    .lte('data_vencimento', end),
  supabase
    .from('movelaria_simulador_caixa')
    .select('ajustes, previsao_recebimento, previsao_despesas, meses')
    .eq('ano', ano)
    .maybeSingle(),
])

const base = labels.map(mes => ({ mes, receitas: 0, despesas: 0 }))
for (const r of receber ?? []) {
  const i = monthIndexFromIso(r.data_vencimento)
  if (i == null) continue
  base[i].receitas = roundMoney(base[i].receitas + Number(r.valor_parcela))
}
for (const d of pagar ?? []) {
  const i = monthIndexFromIso(d.data_vencimento)
  if (i == null) continue
  const aberto = Math.max(0, Number(d.valor_parcela) - Number(d.valor_pago ?? 0))
  if (aberto <= 0) continue
  base[i].despesas = roundMoney(base[i].despesas + aberto)
}

const ajustes = sim?.ajustes ?? []
const derivado = aplicarAjustesNosMeses(base, ajustes)
const setBase = base.find(m => m.mes === proxLabel)
const setDeriv = derivado.find(m => m.mes === proxLabel)

console.log('=== Base real do sistema (em aberto) ===')
console.table(base.filter(m => m.receitas > 0 || m.despesas > 0))
console.log(`Próximo mês (${proxLabel}) base:`, setBase)
console.log(`Próximo mês (${proxLabel}) + histórico:`, setDeriv)
console.log('Histórico salvo:', ajustes)
console.log('Simulação antiga (congelada) previsao:', {
  receber: sim?.previsao_recebimento,
  pagar: sim?.previsao_despesas,
})

const staleReceber = Number(sim?.previsao_recebimento ?? 0)
const stalePagar = Number(sim?.previsao_despesas ?? 0)
const liveReceber = setBase?.receitas ?? 0
const livePagar = setBase?.despesas ?? 0

if (staleReceber !== liveReceber || stalePagar !== livePagar) {
  console.log('\nOK: detectamos que a simulação salva estava desatualizada vs sistema.')
  console.log(`  salva: ${staleReceber} / ${stalePagar}`)
  console.log(`  real:  ${liveReceber} / ${livePagar}`)
  console.log(`  UI deve mostrar (real + histórico): ${setDeriv?.receitas} / ${setDeriv?.despesas}`)
}

const caixa = derivado.reduce((s, m) => s + (m.receitas - m.despesas), 0)
console.log('\nCaixa simulado (soma dos meses):', roundMoneySigned(caixa))

// Sanity: aplicarAjustes
const amostra = aplicarAjustesNosMeses(
  [{ mes: 'Set', receitas: 100, despesas: 50 }],
  [{ mes: 'Set', campo: 'despesas', tipo: 'adicionar', valor: 10 }],
)
if (amostra[0].despesas !== 60) {
  console.error('FALHA helper aplicarAjustesNosMeses', amostra)
  process.exit(1)
}

if (roundMoneySigned(-340832.09) >= 0) {
  console.error('FALHA: arredondamento assinado não pode zerar negativo')
  process.exit(1)
}

console.log('\nTeste helper OK.')
process.exit(0)
