// T11 — Copia as linhas de tabelas escolhidas do banco ANTIGO (somente leitura) para o NOVO.
// Tudo em uma transação; linhas já existentes são mantidas (ON CONFLICT DO NOTHING).
// Uso: node --env-file=.env scripts/baseline/copy-rows.mjs [--dry-run] <schema.tabela> [<schema.tabela> ...]
// Gatilhos e FKs ficam desligados durante a cópia (session_replication_role = replica),
// então copie junto as tabelas das quais a escolhida depende.
import pg from 'pg'

const OLD_REF = 'zzqgtclvuetemzhqzhbq'
const NEW_REF = 'vejugdspjfgfajdpfiht'
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const tables = args.filter(a => !a.startsWith('--'))
if (!tables.length) { console.error('informe ao menos uma tabela (schema.tabela)'); process.exit(1) }
const oldUrl = process.env.OLD_DATABASE_URL
const newUrl = process.env.DATABASE_URL
if (!oldUrl?.includes(OLD_REF) || !newUrl?.includes(NEW_REF)) { console.error('ABORTADO: URLs não apontam para antigo/novo'); process.exit(1) }

const q = s => '"' + s.replace(/"/g, '""') + '"'
const split = t => { const i = t.indexOf('.'); return [t.slice(0, i), t.slice(i + 1)] }
const src = new pg.Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } })
const dst = new pg.Client({ connectionString: newUrl, ssl: { rejectUnauthorized: false } })
await src.connect()
await dst.connect()
await src.query('SET default_transaction_read_only = on')
try {
  await dst.query('BEGIN')
  await dst.query("SET LOCAL session_replication_role = 'replica'")
  for (const t of tables) {
    const [s, n] = split(t)
    const cols = (await dst.query(`select a.attname, a.attgenerated, format_type(a.atttypid, a.atttypmod) ty from pg_attribute a
      where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped order by a.attnum`, [q(s) + '.' + q(n)])).rows
      .filter(c => c.attgenerated === '')
    const list = cols.map(c => q(c.attname)).join(', ')
    // Lê como texto e reconverte no destino: preserva json, arrays, vetores e timestamps sem perda.
    const rows = (await src.query({ text: `select ${cols.map(c => q(c.attname) + '::text').join(', ')} from ${q(s)}.${q(n)}`, rowMode: 'array' })).rows
    let ins = 0
    for (const r of rows) {
      const res = await dst.query(`insert into ${q(s)}.${q(n)} (${list}) overriding system value values (${cols.map((c, i) => '$' + (i + 1) + '::' + c.ty).join(', ')}) on conflict do nothing`, r)
      ins += res.rowCount
    }
    console.log(t + ': ' + rows.length + ' no antigo, ' + ins + ' inseridas')
  }
  await dst.query(dryRun ? 'ROLLBACK' : 'COMMIT')
  console.log(dryRun ? 'ENSAIO (ROLLBACK feito)' : 'COMMIT')
} catch (e) {
  await dst.query('ROLLBACK').catch(() => {})
  console.error('FALHOU — nada copiado (ROLLBACK): ' + e.message)
  process.exitCode = 1
} finally {
  await src.end()
  await dst.end()
}
