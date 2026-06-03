import pkg from 'pg'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { Client } = pkg
const __dirname = dirname(fileURLToPath(import.meta.url))
const file = '035_fix_reverter_pagamento_caixa.sql'
const sql = readFileSync(join(__dirname, '../supabase/migrations', file), 'utf-8')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log(`⚙️  Executando ${file}...`)
  await client.query(sql)
  console.log(`✅ ${file} aplicado.`)
} catch (err) {
  console.error('❌', err.message)
  process.exit(1)
} finally {
  await client.end()
}
