/**
 * Verifica se todo montador com fixo tem cobrança mensal contínua
 * do 1º vencimento até ~12 meses à frente (sem buracos no meio).
 *
 * Uso: node --env-file=.env scripts/test-fixo-montador-cobrancas.mjs
 * (requer SUPABASE_SERVICE_ROLE_KEY ou usa o client anon com RPC se disponível)
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Defina VITE_SUPABASE_URL e uma chave no .env')
  process.exit(1)
}

const supabase = createClient(url, key)

function monthsBetweenInclusive(fromIso, toIso) {
  const from = new Date(`${fromIso}T12:00:00`)
  const to = new Date(`${toIso}T12:00:00`)
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
}

const { data: rows, error } = await supabase.rpc('movelaria_listar_montadores')
if (error) {
  console.error('Falha ao listar montadores:', error.message)
  process.exit(1)
}

const montadores = (rows ?? []).filter(Boolean)
let falhas = 0

for (const m of montadores) {
  const { data: usuario, error: uErr } = await supabase
    .from('movelaria_usuarios')
    .select('id, nome, valor_fixo_mensal, fixo_primeiro_vencimento, fixo_recorrencia_id')
    .eq('id', m.id)
    .maybeSingle()

  if (uErr) {
    console.warn(`! ${m.nome ?? m.id}: não foi possível ler usuário (${uErr.message})`)
    continue
  }

  const valor = Number(usuario?.valor_fixo_mensal) || 0
  if (valor <= 0 || !usuario?.fixo_primeiro_vencimento) continue

  const { data: cobrancas, error: cErr } = await supabase
    .from('movelaria_contas_pagar')
    .select('data_vencimento, status, valor_parcela, prestador_id')
    .eq('prestador_id', m.id)
    .ilike('descricao', 'Fixo montador:%')
    .order('data_vencimento')

  if (cErr) {
    console.error(`✗ ${usuario.nome}: ${cErr.message}`)
    falhas++
    continue
  }

  const meses = new Set(
    (cobrancas ?? []).map(c => String(c.data_vencimento).slice(0, 7)),
  )
  const primeiro = String(usuario.fixo_primeiro_vencimento).slice(0, 10)
  const ultimo = cobrancas?.length
    ? String(cobrancas[cobrancas.length - 1].data_vencimento).slice(0, 10)
    : null

  const esperadoMin = Math.min(
    12,
    monthsBetweenInclusive(primeiro, new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)),
  )

  const orfas = (cobrancas ?? []).filter(c => !c.prestador_id).length
  const okQtd = meses.size >= Math.max(1, esperadoMin - 1)
  const okOrfas = orfas === 0

  if (okQtd && okOrfas) {
    console.log(
      `✓ ${usuario.nome}: R$ ${valor.toFixed(2)} | ${meses.size} meses (${primeiro} → ${ultimo})`,
    )
  } else {
    falhas++
    console.error(
      `✗ ${usuario.nome}: meses=${meses.size} esperado≈${esperadoMin} órfãs=${orfas} (${primeiro} → ${ultimo})`,
    )
  }
}

if (falhas > 0) {
  console.error(`\n${falhas} montador(es) com cobranças incompletas.`)
  process.exit(1)
}

console.log('\nTodas as cobranças fixas mensais estão ok.')
