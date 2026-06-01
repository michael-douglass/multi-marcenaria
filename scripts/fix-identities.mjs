/**
 * Corrige usuários movelaria que existem em auth.users mas não têm auth.identities.
 * Sem identity o GoTrue retorna 500 ao tentar logar via email/senha.
 */
import pkg from 'pg'
const { Client } = pkg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

// Todos os usuários movelaria sem identity de email
const { rows: semIdentity } = await client.query(`
  SELECT mu.id, mu.email
  FROM public.movelaria_usuarios mu
  LEFT JOIN auth.identities i ON i.user_id = mu.id AND i.provider = 'email'
  WHERE i.id IS NULL
  ORDER BY mu.email
`)

console.log('Usuários sem identity:', semIdentity.length)

for (const u of semIdentity) {
  // Verifica se existe em auth.users (pode ter sido deletado)
  const { rows: authRows } = await client.query(
    `SELECT id FROM auth.users WHERE id = $1::uuid`, [u.id]
  )
  if (!authRows.length) {
    console.log('  ⚠️  Sem auth.users:', u.email)
    continue
  }

  const sql = `
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), '${u.id}'::uuid, '${u.email}',
      '{"sub":"${u.id}","email":"${u.email}","email_verified":true}'::jsonb,
      'email', NOW(), NOW(), NOW())
    ON CONFLICT (provider, provider_id) DO NOTHING
  `
  await client.query(sql)
  console.log('  ✅ Identity criada para', u.email)
}

console.log('\nConcluído.')
await client.end()
