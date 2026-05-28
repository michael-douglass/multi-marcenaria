/**
 * GARBO Movelaria — Script de Migration
 * Executa o SQL em supabase/migrations/001_movelaria_schema.sql
 * via conexão direta PostgreSQL (DATABASE_URL no .env)
 *
 * Uso: node --env-file=.env scripts/migrate.mjs
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

const migrations = [
  '001_movelaria_schema.sql',
  '002_movelaria_auth.sql',
  '003_contas_pagar_anexos.sql',
  '004_contas_pagar_observacao.sql',
  '004_fornecedor_vendedor.sql',
  '005_formas_pagamento_pagar.sql',
  '006_clientes_sync_leads.sql',
  '007_clientes_sync_trigger_leads.sql',
  '008_orcamentos_fechados.sql',
  '009_orcamentos_fechados_liquido_desconto.sql',
  '010_transacoes_historico.sql',
  '011_contas_receber_origem.sql',
  '013_leads_ganhos_observacoes.sql',
  '014_caixa_fornecedor.sql',
  '015_fornecedor_limite.sql',
]

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log('🔗 Conectando ao banco de dados Supabase...')

try {
  await client.connect()
  console.log('✅ Conexão estabelecida.')

  for (const file of migrations) {
    const sqlPath = join(__dirname, '../supabase/migrations', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    console.log(`⚙️  Executando ${file}...`)
    await client.query(sql)
    console.log(`✅ ${file} aplicado.`)
  }

  console.log('')
  console.log('🚀 Banco pronto. Execute: pnpm dev')
} catch (err) {
  console.error('❌ Erro na migration:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
