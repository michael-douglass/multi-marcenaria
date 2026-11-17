// T08 — Garante que emp_garbo está nos "Exposed schemas" da API do projeto NOVO (Management API).
const REF = 'vejugdspjfgfajdpfiht'
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) { console.error('SUPABASE_ACCESS_TOKEN ausente'); process.exit(1) }
const api = 'https://api.supabase.com/v1/projects/' + REF + '/postgrest'
const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
const cur = await fetch(api, { headers: h })
if (!cur.ok) { console.error('GET falhou:', cur.status, (await cur.text()).slice(0, 300)); process.exit(1) }
const cfg = await cur.json()
const schemas = String(cfg.db_schema || '').split(',').map(s => s.trim()).filter(Boolean)
console.log('antes :', schemas.join(', '), '| extra_search_path:', cfg.db_extra_search_path)
if (schemas.includes('emp_garbo')) { console.log('emp_garbo já exposto — nada a fazer'); process.exit(0) }
const next = [...schemas, 'emp_garbo'].join(',')
const res = await fetch(api, { method: 'PATCH', headers: h, body: JSON.stringify({ db_schema: next }) })
if (!res.ok) { console.error('PATCH falhou:', res.status, (await res.text()).slice(0, 300)); process.exit(1) }
console.log('depois:', (await res.json()).db_schema)
