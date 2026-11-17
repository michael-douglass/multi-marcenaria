// Aplica um arquivo SQL no banco NOVO dentro de UMA transação (tudo ou nada).
// Uso: node --env-file=.env scripts/baseline/apply-sql.mjs <arquivo.sql> [--dry-run]
// --dry-run executa tudo e faz ROLLBACK no final (ensaio sem deixar nada no banco).
import pg from 'pg'
import fs from 'fs'

const NEW_REF = 'vejugdspjfgfajdpfiht'
const [file, flag] = process.argv.slice(2)
const url = process.env.DATABASE_URL
if (!url || !url.includes(NEW_REF)) {
  console.error('ABORTADO: DATABASE_URL não aponta para o projeto novo (' + NEW_REF + ')')
  process.exit(1)
}
if (!file || !fs.existsSync(file)) {
  console.error('arquivo não encontrado: ' + file)
  process.exit(1)
}
const dryRun = flag === '--dry-run'
// Remove meta-comandos do psql (\restrict, \unrestrict, \connect) que o pg_dump 17 emite.
const sql = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => !/^\\[a-z]/.test(l)).join('\n')

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 0 })
await c.connect()
const notices = []
c.on('notice', n => notices.push(n.message))
try {
  await c.query('BEGIN')
  await c.query(sql)
  await c.query(dryRun ? 'ROLLBACK' : 'COMMIT')
  console.log((dryRun ? 'ENSAIO OK (ROLLBACK feito): ' : 'APLICADO (COMMIT): ') + file)
  if (notices.length) console.log('avisos: ' + notices.length + (notices.length ? ' | ex.: ' + notices[0] : ''))
} catch (e) {
  await c.query('ROLLBACK').catch(() => {})
  console.error('FALHOU — nada foi aplicado (ROLLBACK). ' + (e.code || '') + ' ' + e.message)
  if (e.position) {
    const pos = Number(e.position)
    console.error('trecho: ...' + sql.slice(Math.max(0, pos - 300), pos + 200).replace(/\n/g, '\n  ') + '...')
  }
  for (const k of ['detail', 'hint', 'where', 'schema', 'table', 'constraint']) if (e[k]) console.error(k + ': ' + String(e[k]).slice(0, 400))
  process.exitCode = 1
} finally {
  await c.end()
}
