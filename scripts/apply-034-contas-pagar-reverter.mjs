/**
 * Aplica migration 034 — reverter pagamento em contas a pagar + caixa
 * Uso: node --env-file=.env scripts/apply-034-contas-pagar-reverter.mjs
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

const file = '034_contas_pagar_reverter_pagamento.sql'
const sql = readFileSync(join(__dirname, '../supabase/migrations', file), 'utf-8')

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log('🔗 Conectando ao banco de dados Supabase...')

try {
  await client.connect()
  console.log('✅ Conexão estabelecida.')
  console.log(`⚙️  Executando ${file}...`)
  await client.query(sql)
  console.log(`✅ ${file} aplicado.`)
} catch (err) {
  console.error('❌ Erro na migration:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
