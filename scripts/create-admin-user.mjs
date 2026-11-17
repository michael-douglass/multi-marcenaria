/**
 * Cria (ou atualiza a senha de) um usuário no Supabase Auth, com e-mail confirmado.
 * Depois rode scripts/set-admin.mjs para marcá-lo como administrador.
 *
 * Uso (PowerShell):
 *   $env:ADMIN_EMAIL="x@y.com"; $env:ADMIN_PASSWORD="..."; $env:EXPECT_REF="<ref>"
 *   node --env-file=.env scripts/create-admin-user.mjs
 *
 * A senha vem só de variável de ambiente — nunca grave no arquivo.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const expectRef = process.env.EXPECT_REF

if (!url || !key || !email || !password) {
  console.error('❌ Faltam VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL ou ADMIN_PASSWORD.')
  process.exit(1)
}

const host = new URL(url).host
console.log('Projeto alvo:', host)
if (expectRef && !host.startsWith(expectRef + '.')) {
  console.error(`❌ O .env aponta para ${host}, mas o esperado era ${expectRef}. Abortando.`)
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listErr) {
  console.error('❌ Erro ao listar usuários:', listErr.message)
  process.exit(1)
}

const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
  if (error) {
    console.error('❌ Erro ao atualizar usuário:', error.message)
    process.exit(1)
  }
  console.log('✅ Usuário já existia: senha atualizada e e-mail confirmado.', existing.id)
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) {
    console.error('❌ Erro ao criar usuário:', error.message)
    process.exit(1)
  }
  console.log('✅ Usuário criado:', data.user.id)
}
