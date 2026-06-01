/**
 * Remove e recria completamente os usuários montador/montador_admin
 * com TODOS os campos que o GoTrue espera (incluindo tokens como string vazia).
 */
import pkg from 'pg'
const { Client } = pkg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

// Compara campos de um usuário que FUNCIONA vs os criados por nós
const { rows: comparar } = await client.query(`
  SELECT
    au.email,
    au.aud, au.role,
    au.email_confirmed_at IS NOT NULL   AS confirmed,
    au.confirmation_token               AS conf_token,
    au.recovery_token                   AS rec_token,
    au.email_change_token_new           AS ec_token,
    au.email_change                     AS ec_email,
    au.phone,
    mu.perfil
  FROM public.movelaria_usuarios mu
  JOIN auth.users au ON au.id = mu.id
  ORDER BY mu.email
`)

console.log('Estado atual dos usuários:')
comparar.forEach(r => {
  console.log(`\n  ${r.email} (${r.perfil})`)
  console.log(`    aud: ${r.aud}, role: ${r.role}, confirmed: ${r.confirmed}`)
  console.log(`    conf_token: ${JSON.stringify(r.conf_token)} (null=problema)`)
  console.log(`    rec_token:  ${JSON.stringify(r.rec_token)}`)
})

// Usuários criados via SQL que têm tokens NULL (GoTrue espera string vazia '')
const { rows: comNullTokens } = await client.query(`
  SELECT mu.id, mu.email, mu.perfil, mu.nome
  FROM public.movelaria_usuarios mu
  JOIN auth.users au ON au.id = mu.id
  WHERE au.confirmation_token IS NULL
    OR au.recovery_token IS NULL
    OR au.email_change_token_new IS NULL
    OR au.email_change IS NULL
`)

console.log(`\nUsuários com tokens NULL: ${comNullTokens.length}`)

if (comNullTokens.length > 0) {
  console.log('Corrigindo tokens NULL → vazio...')
  for (const u of comNullTokens) {
    await client.query(`
      UPDATE auth.users SET
        confirmation_token     = COALESCE(confirmation_token, ''),
        recovery_token         = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change           = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone                  = COALESCE(phone, ''),
        phone_change           = COALESCE(phone_change, ''),
        phone_change_token     = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        updated_at             = NOW()
      WHERE id = $1::uuid
    `, [u.id])
    console.log('  ✅ Corrigido:', u.email)
  }
}

// Verifica identities novamente
const { rows: ids } = await client.query(`
  SELECT mu.email, COUNT(i.id)::int AS identities
  FROM public.movelaria_usuarios mu
  LEFT JOIN auth.identities i ON i.user_id = mu.id
  GROUP BY mu.email
`)
console.log('\nIdentities por usuário:')
ids.forEach(r => console.log(r.identities > 0 ? '  ✅' : '  ❌', r.email, '→', r.identities))

console.log('\nPronto. Tente fazer login novamente.')
await client.end()
