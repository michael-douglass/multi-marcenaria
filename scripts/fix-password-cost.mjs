/**
 * Recria senhas dos usuários criados via SQL com bcrypt cost 10
 * (compatível com GoTrue) e verifica triggers no auth.users
 */
import pkg from 'pg'
const { Client } = pkg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

// 1. Verifica triggers em auth.users
const { rows: triggers } = await client.query(`
  SELECT trigger_name, event_manipulation, action_statement
  FROM information_schema.triggers
  WHERE event_object_schema = 'auth' AND event_object_table = 'users'
`)
console.log('Triggers auth.users:')
triggers.forEach(t => console.log(' -', t.trigger_name, t.event_manipulation))

// 2. Verifica usuários com cost baixo (< $2a$10$)
const { rows: usuarios } = await client.query(`
  SELECT mu.id, mu.email, left(au.encrypted_password, 7) as pw_prefix
  FROM public.movelaria_usuarios mu
  JOIN auth.users au ON au.id = mu.id
  WHERE au.encrypted_password NOT LIKE '$2a$10$%'
    AND au.encrypted_password IS NOT NULL
`)
console.log('\nUsuários com senha de cost < 10:', usuarios.length)
usuarios.forEach(u => console.log(' -', u.email, u.pw_prefix))

// 3. Não recriar senhas automaticamente (precisam ser redefinidas pelo admin)
if (usuarios.length > 0) {
  console.log('\nPara corrigir: use a página Configurações → Redefinir Senha para cada usuário.')
}

// 4. Verifica se há algum AFTER UPDATE trigger problemático
const { rows: updateTriggers } = await client.query(`
  SELECT trigger_name, action_statement
  FROM information_schema.triggers
  WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
    AND event_manipulation = 'UPDATE'
`)
console.log('\nTriggers UPDATE em auth.users:', updateTriggers.length)

await client.end()
