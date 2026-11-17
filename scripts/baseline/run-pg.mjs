// Roda uma ferramenta do Postgres (pg_dump, pg_restore, psql) dentro do container postgres:17,
// sem expor a connection string na linha de comando.
// Uso: node --env-file=.env scripts/baseline/run-pg.mjs <old|new|none> <ferramenta> [args...]
//   old  -> usa OLD_DATABASE_URL (sessão somente leitura)
//   new  -> usa DATABASE_URL (aborta se não for o projeto novo)
//   none -> sem conexão (pg_restore lendo arquivo)
// Dentro do container: /work = supabase/baseline/.work, /base = supabase/baseline
import { spawnSync } from 'child_process'
import path from 'path'

const OLD_REF = 'zzqgtclvuetemzhqzhbq'
const NEW_REF = 'vejugdspjfgfajdpfiht'
const [target, tool, ...args] = process.argv.slice(2)
const base = path.resolve('supabase/baseline')
const env = { ...process.env }
const dockerArgs = ['run', '--rm', '-v', base + ':/base', '-v', path.join(base, '.work') + ':/work', '-w', '/work']

if (target === 'old' || target === 'new') {
  const raw = target === 'old' ? process.env.OLD_DATABASE_URL : process.env.DATABASE_URL
  const ref = target === 'old' ? OLD_REF : NEW_REF
  if (!raw || !raw.includes(ref)) {
    console.error('ABORTADO: a URL de "' + target + '" está vazia ou não aponta para ' + ref)
    process.exit(1)
  }
  const u = new URL(raw)
  env.PGHOST = u.hostname
  env.PGPORT = u.port || '5432'
  env.PGUSER = decodeURIComponent(u.username)
  env.PGPASSWORD = decodeURIComponent(u.password)
  env.PGDATABASE = u.pathname.slice(1) || 'postgres'
  env.PGSSLMODE = 'require'
  for (const k of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE']) dockerArgs.push('-e', k)
  if (target === 'old') {
    env.PGOPTIONS = '-c default_transaction_read_only=on'
    dockerArgs.push('-e', 'PGOPTIONS')
  }
} else if (target !== 'none') {
  console.error('alvo inválido: use old, new ou none')
  process.exit(1)
}

const r = spawnSync('docker', [...dockerArgs, 'postgres:17', tool, ...args], { env, stdio: 'inherit' })
process.exit(r.status ?? 1)
