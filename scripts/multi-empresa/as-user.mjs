// Roda SQL como um usuário do app (role authenticated + JWT simulado) ou como anon,
// dentro de uma transação que é SEMPRE desfeita (rollback). Banco NOVO apenas.
// Uso: node --env-file=.env scripts/multi-empresa/as-user.mjs <email|anon> "select ..." ["select ..." ...]
import { connectNovo } from './db.mjs'

const [who, ...sqls] = process.argv.slice(2)
if (!who || !sqls.length) {
  console.error('uso: as-user.mjs <email|anon> "sql" ...')
  process.exit(1)
}

const c = await connectNovo()
try {
  await c.query('begin')
  if (who === 'anon') {
    await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`)
    await c.query('set local role anon')
  } else {
    const u = await c.query('select id from auth.users where lower(email) = lower($1)', [who])
    if (!u.rows.length) throw new Error(`usuário ${who} não encontrado`)
    const claims = JSON.stringify({ sub: u.rows[0].id, role: 'authenticated', email: who })
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
    await c.query('set local role authenticated')
  }
  for (const sql of sqls) {
    try {
      await c.query('savepoint s')
      const r = await c.query(sql)
      if (r.rows?.length) console.table(r.rows)
      else console.log(`${r.command} ${r.rowCount ?? ''}`)
      await c.query('release savepoint s')
    } catch (e) {
      await c.query('rollback to savepoint s')
      console.log('ERRO:', e.message)
    }
  }
} catch (e) {
  console.error('ERRO:', e.message)
  process.exitCode = 1
} finally {
  await c.query('rollback').catch(() => {})
  await c.end()
}
