import pkg from 'pg'
const { Client } = pkg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

// Usuários movelaria: verifica campos críticos para autenticação
const { rows } = await client.query(`
  SELECT
    mu.email, mu.perfil, mu.ativo,
    au.email_confirmed_at IS NOT NULL   AS confirmed,
    au.encrypted_password IS NOT NULL   AS has_password,
    left(au.encrypted_password, 7)      AS pw_prefix,
    au.banned_until,
    au.deleted_at,
    (SELECT COUNT(*) FROM auth.identities i WHERE i.user_id = mu.id AND i.provider = 'email') AS identities
  FROM public.movelaria_usuarios mu
  JOIN auth.users au ON au.id = mu.id
  ORDER BY mu.email
`)

console.log('Usuários Movelaria no auth:\n')
rows.forEach(r => {
  const ok = r.confirmed && r.has_password && Number(r.identities) > 0 && !r.banned_until && !r.deleted_at
  const status = ok ? '✅' : '❌'
  console.log(status, r.email, '|', r.perfil,
    '| confirmed:', r.confirmed,
    '| pw_prefix:', r.pw_prefix,
    '| identities:', r.identities,
    r.banned_until ? '| BANNED' : '',
    r.deleted_at ? '| DELETED' : '',
  )
})

await client.end()
