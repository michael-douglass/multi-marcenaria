// M08 — Troca emp_garbo por crm nos "Exposed schemas" da API do projeto NOVO (Management API).
// Uso: node --env-file=.env scripts/multi-empresa/expose-crm.mjs
const REF = 'vejugdspjfgfajdpfiht'
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN ausente')
  process.exit(1)
}
const api = `https://api.supabase.com/v1/projects/${REF}/postgrest`
const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
const cur = await fetch(api, { headers: h })
if (!cur.ok) {
  console.error('GET falhou:', cur.status, (await cur.text()).slice(0, 300))
  process.exit(1)
}
const cfg = await cur.json()
const antes = String(cfg.db_schema || '').split(',').map((s) => s.trim()).filter(Boolean)
const depois = [...new Set(antes.filter((s) => s !== 'emp_garbo').concat('crm'))]
console.log('antes :', antes.join(', '))
if (antes.join(',') === depois.join(',')) {
  console.log('nada a fazer')
  process.exit(0)
}
const res = await fetch(api, { method: 'PATCH', headers: h, body: JSON.stringify({ db_schema: depois.join(',') }) })
if (!res.ok) {
  console.error('PATCH falhou:', res.status, (await res.text()).slice(0, 300))
  process.exit(1)
}
console.log('depois:', (await res.json()).db_schema)
