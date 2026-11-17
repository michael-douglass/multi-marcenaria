// Conexão com o banco NOVO para os scripts do multi-empresa.
// Aborta se DATABASE_URL não apontar para o projeto novo. Nunca imprime a URL.
import pg from 'pg'

export const NEW_REF = 'vejugdspjfgfajdpfiht'

export async function connectNovo() {
  const url = process.env.DATABASE_URL
  if (!url || !url.includes(NEW_REF)) {
    console.error(`ABORTADO: DATABASE_URL vazia ou não aponta para ${NEW_REF}.`)
    process.exit(1)
  }
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  })
  await client.connect()
  return client
}
