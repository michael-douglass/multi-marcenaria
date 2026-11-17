// Consulta ad-hoc no banco NOVO (somente leitura por padrão).
// Uso: node --env-file=.env scripts/multi-empresa/q.mjs "select ..."
//      node --env-file=.env scripts/multi-empresa/q.mjs -f arquivo.sql
//      --write  permite escrita (sem ele a sessão é read-only)
import { readFileSync } from 'node:fs'
import { connectNovo } from './db.mjs'

const args = process.argv.slice(2)
const write = args.includes('--write')
const fi = args.indexOf('-f')
const sql = fi >= 0 ? readFileSync(args[fi + 1], 'utf8') : args.filter((a) => a !== '--write')[0]
if (!sql) {
  console.error('informe a consulta ou -f arquivo.sql')
  process.exit(1)
}

const c = await connectNovo()
try {
  if (!write) await c.query('set session characteristics as transaction read only')
  const res = await c.query(sql)
  const list = Array.isArray(res) ? res : [res]
  for (const r of list) {
    if (r.rows?.length) console.table(r.rows)
    else console.log(`${r.command ?? ''} ${r.rowCount ?? ''}`.trim())
  }
} catch (e) {
  console.error('ERRO:', e.message)
  process.exitCode = 1
} finally {
  await c.end()
}
