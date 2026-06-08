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

const file = '043_leads_ganhos_excluidos.sql'
const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log('🔗 Conectando ao banco de dados Supabase...')

try {
  await client.connect()
  console.log('✅ Conexão estabelecida.')

  const sqlPath = join(__dirname, '../supabase/migrations', file)
  const sql = readFileSync(sqlPath, 'utf-8')

  process.stdout.write(`⚙️  Executando ${file}... `)
  await client.query(sql)
  console.log('✅')

  console.log('🚀 Migration aplicada com sucesso.')
} catch (err) {
  console.error('❌ Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
