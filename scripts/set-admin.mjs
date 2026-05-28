/**
 * GARBO Movelaria — Define selvomichael@gmail.com como Administrador
 * Uso: node --env-file=.env scripts/set-admin.mjs
 */

import pkg from 'pg'
const { Client } = pkg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env')
  process.exit(1)
}

const ADMIN_EMAIL = 'selvomichael@gmail.com'

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('🔗 Conectado ao banco.')

  // Find the auth.users row for this email
  const { rows } = await client.query(
    `SELECT id, email FROM auth.users WHERE email = $1`,
    [ADMIN_EMAIL]
  )

  if (rows.length === 0) {
    console.error(`❌ Usuário "${ADMIN_EMAIL}" não encontrado em auth.users.`)
    console.error('   Faça o cadastro primeiro pelo app (ou pelo Supabase Dashboard).')
    process.exit(1)
  }

  const { id, email } = rows[0]
  console.log(`✅ auth.users encontrado: ${email} (${id})`)

  // Upsert into movelaria_usuarios with perfil = administrador
  await client.query(
    `INSERT INTO movelaria_usuarios (id, email, perfil, ativo)
     VALUES ($1, $2, 'administrador', true)
     ON CONFLICT (id) DO UPDATE
       SET perfil = 'administrador', ativo = true, atualizado_em = NOW()`,
    [id, email]
  )

  console.log(`✅ "${ADMIN_EMAIL}" definido como administrador em movelaria_usuarios.`)
  console.log('🚀 Pronto!')
} catch (err) {
  console.error('❌ Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
