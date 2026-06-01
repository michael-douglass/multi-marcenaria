import pkg from 'pg'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { Client } = pkg
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATABASE_URL = process.env.DATABASE_URL

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
console.log('Aplicando 022_agenda_obras.sql...')
const sql = readFileSync(join(__dirname, '../supabase/migrations/022_agenda_obras.sql'), 'utf-8')
await client.query(sql)
console.log('✅ Migration 022 aplicada.')
await client.end()
