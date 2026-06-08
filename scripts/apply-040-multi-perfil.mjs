/**
 * Aplica migration 040 — multi-perfil por usuário
 * Uso: node --env-file=.env scripts/apply-040-multi-perfil.mjs
 */

import pkg from 'pg'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { Client } = pkg
const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env')
  process.exit(1)
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log('🔗 Conectando ao Supabase...')

try {
  await client.connect()
  console.log('✅ Conexão estabelecida.\n')

  const sqlPath = join(__dirname, '../supabase/migrations/040_multi_perfil.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  console.log('⚙️  040_multi_perfil.sql ...')
  await client.query(sql)
  console.log('✅ Migration aplicada com sucesso.')
} catch (err) {
  console.error('❌ Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
