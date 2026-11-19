/**
 * Marca neutra (docs/marca-neutra, T05) — tira arquivos de marca de cliente das pastas do sistema.
 *
 * 1. As duas fotos com o logo de uma empresa (`hero-painel-logo.jpg`, `fechamento-painel-logo.jpg`)
 *    saem de `public/` e vão para o storage da empresa que as usa (`marketing-medias/apresentacao/<empresa>/`);
 *    a URL da linha em `crm.apresentacao_conteudo` é trocada.
 * 2. Imagens dos blocos de slide na pasta antiga `template/emp_*` são copiadas para
 *    `template/crm/blocos/<id do bloco>/<arquivo>` (uma cópia por bloco, inclusive na empresa-modelo) e
 *    as URLs do `config` são trocadas. Os arquivos antigos só são apagados quando nenhum bloco os cita.
 *
 * Uso: node --env-file=.env scripts/marca-neutra/mover-imagens-marca.mjs          (ensaio, não grava)
 *      node --env-file=.env scripts/marca-neutra/mover-imagens-marca.mjs --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { connectNovo, NEW_REF } from '../multi-empresa/db.mjs'

const WRITE = process.argv.includes('--write')
const URL_ = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_?.includes(NEW_REF) || !KEY) {
  console.error('ABORTADO: VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes ou fora do projeto novo')
  process.exit(1)
}
const PUB = `${URL_}/storage/v1/object/public/`
const auth = { Authorization: `Bearer ${KEY}`, apikey: KEY }

async function upload(bucket, obj, file, type) {
  const r = await fetch(`${URL_}/storage/v1/object/${bucket}/${obj}`, {
    method: 'POST', headers: { ...auth, 'Content-Type': type, 'x-upsert': 'true' }, body: fs.readFileSync(file),
  })
  if (!r.ok) throw new Error(`upload ${bucket}/${obj}: ${r.status} ${await r.text()}`)
}
async function copiar(bucket, de, para) {
  const r = await fetch(`${URL_}/storage/v1/object/copy`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: bucket, sourceKey: de, destinationKey: para }),
  })
  if (!r.ok && !(await r.text()).includes('already exists')) throw new Error(`copy ${de} → ${para}: ${r.status}`)
}
async function apagar(bucket, nomes) {
  const r = await fetch(`${URL_}/storage/v1/object/${bucket}`, {
    method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: nomes }),
  })
  if (!r.ok) throw new Error(`delete: ${r.status} ${await r.text()}`)
}
async function existe(url) {
  return (await fetch(url, { method: 'HEAD' })).ok
}

const pg = await connectNovo()
try {
  // 1) Fotos com logo → storage da empresa
  const FOTOS = ['hero-painel-logo.jpg', 'fechamento-painel-logo.jpg']
  const linhas = (await pg.query(
    // Empresas-modelo ficam de fora: o conteúdo delas volta ao padrão neutro (migration da T05).
    `select a.id, a.empresa_id, a.conteudo::text c from crm.apresentacao_conteudo a
       join public."CRM-multi-empresas>empresas<" e on e.id = a.empresa_id
      where not e.e_modelo and a.conteudo::text ~ 'painel-logo\\.jpg'`,
  )).rows
  console.log(`apresentações com foto de logo: ${linhas.length}`)
  for (const l of linhas) {
    let c = l.c
    for (const f of FOTOS) {
      const re = new RegExp(`"/imagens/[a-z-]+/${f.replace('.', '\\.')}"`, 'g')
      if (!re.test(c)) continue
      const obj = `apresentacao/${l.empresa_id}/${f}`
      const local = path.join('public/imagens/apresentacao', f)
      console.log(`  ${l.empresa_id}: ${f} → marketing-medias/${obj}`)
      if (WRITE) {
        if (!fs.existsSync(local)) throw new Error(`arquivo local ausente: ${local}`)
        await upload('marketing-medias', obj, local, 'image/jpeg')
        if (!(await existe(`${PUB}marketing-medias/${obj}`))) throw new Error(`HEAD falhou: ${obj}`)
      }
      c = c.replace(re, JSON.stringify(`${PUB}marketing-medias/${obj}`))
    }
    if (WRITE) await pg.query(`update crm.apresentacao_conteudo set conteudo = $2::jsonb where id = $1`, [l.id, c])
  }

  // 2) Blocos de slide na pasta antiga template/emp_*
  const blocos = (await pg.query(
    `select id, config::text c from crm.orcamento_slide_blocos where config::text ~ 'orcamento-slides/template/emp_[a-z0-9_]+/'`,
  )).rows
  console.log(`blocos de slide com pasta antiga: ${blocos.length}`)
  const antigos = new Set()
  for (const b of blocos) {
    const re = /orcamento-slides\/(template\/emp_[a-z0-9_]+\/blocos\/[^"\\]+)/g
    let c = b.c
    for (const m of [...b.c.matchAll(re)]) {
      const de = m[1]
      const para = `template/crm/blocos/${b.id}/${de.split('/').pop()}`
      antigos.add(de)
      console.log(`  bloco ${b.id}: ${de} → ${para}`)
      if (WRITE) {
        await copiar('orcamento-slides', de, para)
        if (!(await existe(`${PUB}orcamento-slides/${para}`))) throw new Error(`HEAD falhou: ${para}`)
      }
      c = c.split(`orcamento-slides/${de}`).join(`orcamento-slides/${para}`)
    }
    if (WRITE) await pg.query(`update crm.orcamento_slide_blocos set config = $2::jsonb where id = $1`, [b.id, c])
  }

  if (WRITE && antigos.size) {
    const restam = (await pg.query(
      `select count(*)::int n from crm.orcamento_slide_blocos where config::text ~ 'orcamento-slides/template/emp_[a-z0-9_]+/'`,
    )).rows[0].n
    if (restam === 0) {
      await apagar('orcamento-slides', [...antigos])
      console.log(`arquivos antigos apagados: ${antigos.size}`)
    } else console.log(`ainda há ${restam} bloco(s) citando a pasta antiga — arquivos antigos mantidos`)
  }
  console.log(WRITE ? 'ok (gravado)' : 'ensaio: nada gravado (use --write)')
} finally {
  await pg.end()
}
