/**
 * Verifica unificação Kaique → Kayke Santos (migrações 141–142).
 *
 * Foco no que define o "Valor real" do Caixa: contas a pagar do mês.
 * (Destinatários/saldos exigem usuário autenticado — RLS bloqueia anon.)
 *
 * Rodar: node scripts/test-unifica-kaique-kayke.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env')
  const raw = readFileSync(envPath, 'utf8')
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env')
  process.exit(1)
}

const supabase = createClient(url, key)
let failed = 0

function assert(cond, msg) {
  if (cond) console.log(`  OK  ${msg}`)
  else {
    failed += 1
    console.error(`  FAIL ${msg}`)
  }
}

async function sumContas(nomeExato, mes, ano) {
  const start = `${ano}-${String(mes).padStart(2, '0')}-01`
  const end = new Date(ano, mes, 0).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('movelaria_contas_pagar')
    .select('valor_parcela, fornecedor_nome')
    .eq('fornecedor_nome', nomeExato)
    .gte('data_vencimento', start)
    .lte('data_vencimento', end)
  if (error) throw error
  return (data ?? []).reduce((acc, r) => acc + Number(r.valor_parcela || 0), 0)
}

console.log('Teste: unificação Kaique → Kayke Santos\n')

const { count: contasKaique, error: e1 } = await supabase
  .from('movelaria_contas_pagar')
  .select('id', { count: 'exact', head: true })
  .eq('fornecedor_nome', 'Kaique')

if (e1) {
  console.error('Erro ao contar contas Kaique:', e1.message)
  process.exit(1)
}

assert((contasKaique ?? 0) === 0, 'zero contas a pagar com fornecedor_nome Kaique')

const agoKayke = await sumContas('Kayke Santos', 8, 2026)
const julKayke = await sumContas('Kayke Santos', 7, 2026)
const agoKaique = await sumContas('Kaique', 8, 2026)

assert(agoKaique === 0, `ago/2026 Kaique = 0 (obtido ${agoKaique})`)
assert(
  Math.abs(agoKayke - 2200) < 0.01,
  `ago/2026 Kayke Santos ≈ 2200 — não os R$ 12.000 fantasma (obtido ${agoKayke})`,
)
assert(
  Math.abs(julKayke - 2200) < 0.01,
  `jul/2026 Kayke Santos ≈ 2200 (obtido ${julKayke})`,
)

console.log('')
if (failed > 0) {
  console.error(`Falhou: ${failed} asserção(ões).`)
  process.exit(1)
}
console.log('Tudo certo: Kaique sumiu das contas; Kayke Santos está com o valor certo.')
