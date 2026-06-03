import pkg from 'pg'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { Client } = pkg
const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '../supabase/migrations/036_caixa_saldo_zero_ao_esvaziar.sql'), 'utf-8')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  console.log('✅ Migration 036 aplicada.')

  await client.query(
    `UPDATE movelaria_caixa_saldo_acumulado s
     SET total_reservado = 0, total_pago = 0, saldo = 0
     FROM movelaria_caixa_destinatarios d
     WHERE d.id = s.destinatario_id
       AND LOWER(TRIM(d.nome)) = 'michael douglas'
       AND s.mes_referencia = 7 AND s.ano_referencia = 2026
       AND NOT EXISTS (
         SELECT 1 FROM movelaria_caixa_movimentacoes m
         WHERE m.destinatario_id = s.destinatario_id
           AND m.mes_referencia = s.mes_referencia
           AND m.ano_referencia = s.ano_referencia
       )`,
  )
  console.log('✅ Saldo jul/2026 Michael Douglas zerado (fantasma removido).')

  const check = await client.query(
    `SELECT total_reservado, total_pago, saldo FROM movelaria_caixa_saldo_acumulado s
     JOIN movelaria_caixa_destinatarios d ON d.id = s.destinatario_id
     WHERE LOWER(TRIM(d.nome)) = 'michael douglas' AND mes_referencia = 7 AND ano_referencia = 2026`,
  )
  console.log('Saldo atual:', check.rows[0] ?? 'sem registro')
} catch (err) {
  console.error('❌', err.message)
  process.exit(1)
} finally {
  await client.end()
}
