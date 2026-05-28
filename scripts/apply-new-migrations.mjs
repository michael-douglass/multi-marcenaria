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

const migrations = [
  '009_orcamentos_fechados_liquido_desconto.sql',
  '010_transacoes_historico.sql',
  '011_contas_receber_origem.sql',
  '012_orcamentos_fechados_delete_policy.sql',
]

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  console.log('🔗 Conectando ao banco de dados Supabase...')
  await client.connect()
  console.log('✅ Conexão estabelecida.')

  for (const file of migrations) {
    const sqlPath = join(__dirname, '../supabase/migrations', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    console.log(`⚙️  Executando ${file}...`)
    await client.query(sql)
    console.log(`✅ ${file} aplicado.`)
  }

  console.log('🚀 Migrations 009-011 aplicadas com sucesso.')
} catch (err) {
  console.error('❌ Erro na migration:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
