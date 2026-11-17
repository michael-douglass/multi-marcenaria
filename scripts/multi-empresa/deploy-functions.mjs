// M30 — Publica as Edge Functions no projeto NOVO. Confere o ref antes; nunca imprime o token.
// Uso: node --env-file=.env scripts/multi-empresa/deploy-functions.mjs [nome-da-funcao ...]
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REF = 'vejugdspjfgfajdpfiht'
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN ausente')
  process.exit(1)
}
if (!(process.env.VITE_SUPABASE_URL ?? '').includes(REF)) {
  console.error(`ABORTADO: o .env não aponta para ${REF}`)
  process.exit(1)
}
const cfg = readFileSync('supabase/config.toml', 'utf8')
if (!cfg.includes(`project_id = "${REF}"`)) {
  console.error(`ABORTADO: supabase/config.toml não tem project_id = "${REF}"`)
  process.exit(1)
}

const nomes = process.argv.slice(2)
// --yes: o deploy só roda com confirmação explícita do usuário (dada em 2026-11-17).
const args = ['-y', 'supabase@latest', 'functions', 'deploy', ...nomes, '--project-ref', REF, '--use-api', '--yes']
console.log('Publicando no projeto', REF, nomes.length ? `(${nomes.join(', ')})` : '(todas)')
const r = spawnSync('npx', args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' })
process.exit(r.status ?? 1)
