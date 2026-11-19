/**
 * Marca neutra (docs/marca-neutra, T06): logos de empresa que ainda apontam para o storage do projeto
 * Supabase ANTIGO são copiadas para o bucket `empresa-branding` do projeto novo (mesmo caminho) e o
 * `logo_url` é trocado. O projeto antigo só é lido (URL pública), nunca alterado.
 *
 * Uso: node --env-file=.env scripts/marca-neutra/copiar-logos-antigos.mjs [--write]
 */
import { connectNovo, NEW_REF } from '../multi-empresa/db.mjs'

const OLD_REF = 'zzqgtclvuetemzhqzhbq'
const WRITE = process.argv.includes('--write')
const URL_ = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_?.includes(NEW_REF) || !KEY) {
  console.error('ABORTADO: VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes ou fora do projeto novo')
  process.exit(1)
}
const OLD_PREFIX = `https://${OLD_REF}.supabase.co/storage/v1/object/public/`

const pg = await connectNovo()
try {
  const rows = (await pg.query(
    `select id, nome, logo_url from public."CRM-multi-empresas>empresas<" where logo_url like $1`, [`${OLD_PREFIX}%`],
  )).rows
  console.log(`logos no projeto antigo: ${rows.length}`)
  for (const r of rows) {
    const semQuery = r.logo_url.split('?')[0]
    const [bucket, ...resto] = semQuery.slice(OLD_PREFIX.length).split('/')
    const obj = resto.join('/')
    console.log(`  ${r.nome}: ${bucket}/${obj}`)
    if (!WRITE) continue
    const res = await fetch(r.logo_url)
    if (!res.ok) throw new Error(`download ${r.logo_url}: ${res.status}`)
    const up = await fetch(`${URL_}/storage/v1/object/${bucket}/${obj}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, 'Content-Type': res.headers.get('content-type') || 'image/png', 'x-upsert': 'true' },
      body: Buffer.from(await res.arrayBuffer()),
    })
    if (!up.ok) throw new Error(`upload ${bucket}/${obj}: ${up.status} ${await up.text()}`)
    const nova = `${URL_}/storage/v1/object/public/${bucket}/${obj}?t=${Date.now()}`
    if (!(await fetch(nova, { method: 'HEAD' })).ok) throw new Error(`HEAD falhou: ${nova}`)
    await pg.query(`update public."CRM-multi-empresas>empresas<" set logo_url = $2 where id = $1`, [r.id, nova])
  }
  console.log(WRITE ? 'ok (gravado)' : 'ensaio: nada gravado (use --write)')
} finally {
  await pg.end()
}
