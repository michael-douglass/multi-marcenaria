// Conexões para os scripts de modelos padrão. Antigo SEMPRE somente leitura.
import pg from 'pg'
export const OLD_REF = 'zzqgtclvuetemzhqzhbq'
export const NEW_REF = 'vejugdspjfgfajdpfiht'
export const GARBO_ID = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
export async function connectAntigo() {
  const url = process.env.OLD_DATABASE_URL
  if (!url?.includes(OLD_REF)) { console.error('ABORTADO: OLD_DATABASE_URL não aponta para o antigo'); process.exit(1) }
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, options: '-c default_transaction_read_only=on' })
  await c.connect()
  return c
}
export async function connectNovo() {
  const url = process.env.DATABASE_URL
  if (!url?.includes(NEW_REF)) { console.error('ABORTADO: DATABASE_URL não aponta para o novo'); process.exit(1) }
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  return c
}
