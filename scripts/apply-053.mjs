/**
 * Aplica migração 053 — reserva no caixa para pagamentos parciais
 * Uso: node --env-file=.env scripts/apply-053.mjs
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

  const sql = readFileSync(
    join(__dirname, '../supabase/migrations/053_contas_pagar_caixa_parcial.sql'),
    'utf-8',
  )

  process.stdout.write('⚙️  053_contas_pagar_caixa_parcial.sql ... ')
  await client.query(sql)
  console.log('✅')

  console.log('\n🚀 Migração aplicada com sucesso.')
} catch (err) {
  console.log('❌')
  console.error('   Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
