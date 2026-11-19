// Grava o JSON de CONTEUDO_NEUTRO / PONTUA_NEUTRO na migration da marca neutra, no lugar dos
// marcadores __NEUTRO_CONTEUDO__ / __NEUTRO_PONTUA__ (só roda antes de aplicar a migration).
// Uso: npx tsx --tsconfig tsconfig.app.json scripts/marca-neutra/gerar-conteudo-neutro.mjs
import fs from 'node:fs'
import { CONTEUDO_NEUTRO, PONTUA_NEUTRO } from '../../src/components/marketing/apresentacao-empresa/apresentacao-conteudo.ts'

const arq = 'supabase/migrations/20261119100100_marca_neutra_modelo.sql'
let sql = fs.readFileSync(arq, 'utf8')
if (!sql.includes('__NEUTRO_CONTEUDO__')) {
  console.log('marcadores já substituídos — nada a fazer')
  process.exit(0)
}
const conteudo = JSON.stringify(CONTEUDO_NEUTRO)
const pontua = JSON.stringify(PONTUA_NEUTRO)
for (const [n, t] of [['conteudo', conteudo], ['pontua', pontua]]) {
  if (t.includes('$json$')) throw new Error(`delimitador $json$ dentro de ${n}`)
  if (/garbo/i.test(t)) throw new Error(`${n} neutro ainda cita a marca: ${t.match(/.{0,40}garbo.{0,20}/i)[0]}`)
}
sql = sql.split('__NEUTRO_CONTEUDO__').join(conteudo).split('__NEUTRO_PONTUA__').join(pontua)
fs.writeFileSync(arq, sql)
console.log(`ok: conteudo ${conteudo.length} chars, pontua ${pontua.length} chars`)
