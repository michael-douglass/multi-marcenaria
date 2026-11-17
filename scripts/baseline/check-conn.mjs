// Testa conexão nos dois bancos. Antigo sempre em modo somente-leitura.
import pg from 'pg'
const NEW_REF = 'vejugdspjfgfajdpfiht', OLD_REF = 'zzqgtclvuetemzhqzhbq'
async function probe(label, url, ref, readOnly) {
  if (!url) return console.log(`${label}: variável vazia`)
  if (!url.includes(ref)) return console.log(`${label}: ABORTADO — URL não contém ${ref}`)
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
    ...(readOnly ? { options: '-c default_transaction_read_only=on' } : {}) })
  try {
    await c.connect()
    const { rows } = await c.query(`select current_setting('server_version') v, current_user u,
      current_setting('default_transaction_read_only') ro,
      (select count(*) from pg_tables where schemaname='public') public_tables,
      (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') public_funcs,
      (select count(*) from pg_namespace where nspname like 'emp\_%') emp_schemas,
      (select string_agg(extname||'@'||n.nspname, ', ' order by extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace) exts`)
    console.log(`${label}: OK`, JSON.stringify(rows[0]))
  } catch (e) { console.log(`${label}: FALHOU — ${e.code || ''} ${e.message}`) }
  finally { await c.end().catch(() => {}) }
}
await probe('NOVO  ', process.env.DATABASE_URL, NEW_REF, false)
await probe('ANTIGO', process.env.OLD_DATABASE_URL, OLD_REF, true)
