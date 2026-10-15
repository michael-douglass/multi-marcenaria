/** Gate Épico 2 — valida quote_projects + quote_analyses.project_id. */
import pg from 'pg'

const { Client } = pg
const company = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'

const c = new Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

const cols = await c.query(
  `select column_name, is_nullable
   from information_schema.columns
   where table_schema='public' and table_name='quote_analyses' and column_name='project_id'`,
)
if (!cols.rows.length) {
  console.error('FAIL: quote_analyses.project_id ausente')
  process.exit(1)
}
console.log('quote_analyses.project_id', cols.rows[0])

const tbl = await c.query(`select to_regclass('public.quote_projects') as exists`)
if (!tbl.rows[0]?.exists) {
  console.error('FAIL: quote_projects ausente')
  process.exit(1)
}

const p = await c.query(
  `insert into quote_projects (company_id, name, source_pdf_name)
   values ($1,$2,$3) returning id`,
  [company, 'gate-epic2-test', 'test.pdf'],
)
const projectId = p.rows[0].id
const totals = {
  page_ranges: [1, 2, 3],
  batch_label: '1-3',
  project_id: projectId,
}
const a = await c.query(
  `insert into quote_analyses (company_id, mode, status, project_id, totals)
   values ($1,'pro','PENDING',$2,$3::jsonb)
   returning id, project_id, totals`,
  [company, projectId, JSON.stringify(totals)],
)
console.log(
  JSON.stringify(
    {
      ok: true,
      project_id_nullable: cols.rows[0].is_nullable === 'YES',
      projectId,
      analysisId: a.rows[0].id,
      linked: a.rows[0].project_id === projectId,
      totals: a.rows[0].totals,
    },
    null,
    2,
  ),
)

await c.query('delete from quote_analyses where id=$1', [a.rows[0].id])
await c.query('delete from quote_projects where id=$1', [projectId])
await c.end()
console.log('OK gate-quote-projects')
