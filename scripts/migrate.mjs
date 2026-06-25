/**
 * GARBO Movelaria — Aplica migrations incrementais em supabase/migrations/
 *
 * Uso: node --env-file=.env scripts/migrate.mjs
 * Requer: DATABASE_URL no .env
 */

import pkg from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { Client } = pkg
const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '../supabase/migrations')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env')
  process.exit(1)
}

function migrationSortKey(filename) {
  const match = filename.match(/^(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const diff = migrationSortKey(a) - migrationSortKey(b)
      return diff !== 0 ? diff : a.localeCompare(b)
    })
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log('🔗 Conectando ao banco de dados Supabase...')

try {
  await client.connect()
  console.log('✅ Conexão estabelecida.')

  await client.query(`
    CREATE TABLE IF NOT EXISTS movelaria_schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  const { rows: applied } = await client.query(
    'SELECT filename FROM movelaria_schema_migrations',
  )
  const appliedSet = new Set(applied.map(r => r.filename))
  const files = listMigrationFiles()

  if (appliedSet.size === 0) {
    const { rows: existing } = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'movelaria_obras'
      LIMIT 1
    `)
    if (existing.length > 0) {
      console.log('📋 Banco já existente — registrando migrations anteriores como aplicadas...')
      for (const file of files) {
        await client.query(
          'INSERT INTO movelaria_schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file],
        )
        appliedSet.add(file)
      }
    }
  }

  let count = 0

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏭️  ${file} (já aplicada)`)
      continue
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
    console.log(`⚙️  Aplicando ${file}...`)

    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query(
        'INSERT INTO movelaria_schema_migrations (filename) VALUES ($1)',
        [file],
      )
      await client.query('COMMIT')
      console.log(`✅ ${file} aplicada.`)
      count++
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`❌ Falha em ${file}:`, err.message)
      process.exit(1)
    }
  }

  console.log('')
  if (count === 0) {
    console.log('✨ Nenhuma migration pendente — banco já está atualizado.')
  } else {
    console.log(`🚀 ${count} migration(s) aplicada(s) com sucesso.`)
    await client.query(`NOTIFY pgrst, 'reload schema'`)
    console.log('🔄 Cache da API Supabase (PostgREST) recarregado.')
  }
} catch (err) {
  console.error('❌ Erro na migration:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
