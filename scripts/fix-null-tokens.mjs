/**
 * GoTrue espera tokens como string vazia '', não NULL.
 * Corrige os campos para os usuários criados via SQL.
 */
import pkg from 'pg'
const { Client } = pkg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

// Corrige apenas os campos de token (não phone — tem unique constraint)
const { rowCount } = await client.query(`
  UPDATE auth.users
  SET
    confirmation_token         = COALESCE(confirmation_token, ''),
    recovery_token             = COALESCE(recovery_token, ''),
    email_change_token_new     = COALESCE(email_change_token_new, ''),
    email_change               = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change_token         = COALESCE(phone_change_token, ''),
    reauthentication_token     = COALESCE(reauthentication_token, ''),
    updated_at                 = NOW()
  WHERE id IN (
    SELECT id FROM public.movelaria_usuarios
  )
  AND (
    confirmation_token IS NULL OR
    recovery_token IS NULL OR
    email_change_token_new IS NULL
  )
`)
console.log('Registros corrigidos:', rowCount)

// Verifica resultado final
const { rows } = await client.query(`
  SELECT
    mu.email, mu.perfil,
    left(au.encrypted_password, 7)      AS pw_cost,
    au.email_confirmed_at IS NOT NULL   AS confirmed,
    au.confirmation_token = ''          AS tokens_ok,
    (SELECT COUNT(*)::int FROM auth.identities i
     WHERE i.user_id = mu.id AND i.provider = 'email') AS identities
  FROM public.movelaria_usuarios mu
  JOIN auth.users au ON au.id = mu.id
  ORDER BY mu.email
`)

console.log('\nStatus final:')
rows.forEach(r => {
  const ok = r.confirmed && r.tokens_ok && r.identities > 0 && r.pw_cost === '$2a$10'
  console.log(ok ? '✅' : '❌',
    r.email, '|', r.perfil,
    '| pw:', r.pw_cost,
    '| confirmed:', r.confirmed,
    '| tokens_ok:', r.tokens_ok,
    '| identities:', r.identities
  )
})

await client.end()
