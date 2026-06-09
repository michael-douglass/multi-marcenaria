/**
 * Aplica migration 046 (Comissões por prestador)
 * Uso: node --env-file=.env scripts/apply-046.mjs
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

const migrations = ['046_obra_comissao_itens.sql']

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log('🔗 Conectando ao Supabase...')

try {
  await client.connect()
  console.log('✅ Conexão estabelecida.\n')

  for (const file of migrations) {
    const sqlPath = join(__dirname, '../supabase/migrations', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    process.stdout.write(`⚙️  ${file} ... `)
    try {
      await client.query(sql)
      console.log('✅')
    } catch (err) {
      console.log('❌')
      console.error(`   ${err.message}`)
      process.exit(1)
    }
  }

  console.log('\n🚀 Migration 046 aplicada com sucesso.')
} catch (err) {
  console.error('❌ Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
