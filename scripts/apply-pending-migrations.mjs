/**
 * Aplica migrations 030–036 (idempotentes onde possível)
 * Uso: node --env-file=.env scripts/apply-pending-migrations.mjs
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
  '030_obter_meu_usuario.sql',
  '031_obras_montador_nome_fallback.sql',
  '032_administrador_obras.sql',
  '033_page_zoom.sql',
  '034_contas_pagar_reverter_pagamento.sql',
  '035_fix_reverter_pagamento_caixa.sql',
  '036_caixa_saldo_zero_ao_esvaziar.sql',
]

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log('🔗 Conectando ao Supabase...')

try {
  await client.connect()
  console.log('✅ Conexão estabelecida.\n')

  let ok = 0
  let skipped = 0

  for (const file of migrations) {
    const sqlPath = join(__dirname, '../supabase/migrations', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    process.stdout.write(`⚙️  ${file} ... `)
    try {
      await client.query(sql)
      console.log('✅')
      ok++
    } catch (err) {
      const msg = err.message || ''
      if (
        msg.includes('already exists')
        || msg.includes('duplicate')
        || msg.includes('já existe')
      ) {
        console.log('⏭️  (já aplicada)')
        skipped++
      } else {
        console.log('❌')
        console.error(`   ${msg}`)
        process.exit(1)
      }
    }
  }

  // Corrige saldos fantasma (sem movimentações no mês)
  await client.query(`
    UPDATE movelaria_caixa_saldo_acumulado s
    SET total_reservado = 0, total_pago = 0, saldo = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM movelaria_caixa_movimentacoes m
      WHERE m.destinatario_id = s.destinatario_id
        AND m.mes_referencia = s.mes_referencia
        AND m.ano_referencia = s.ano_referencia
    )
    AND (s.total_reservado <> 0 OR s.total_pago <> 0 OR s.saldo <> 0)
  `)
  console.log('\n✅ Saldos de caixa sem movimentação verificados/zerados.')

  console.log(`\n🚀 Concluído: ${ok} aplicada(s), ${skipped} já existente(s).`)
} catch (err) {
  console.error('❌ Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
