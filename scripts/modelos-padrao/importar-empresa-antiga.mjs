// T03 (modelos padrão) — traz markup, slides e contratos da Garbo do banco ANTIGO (emp_garbo, só leitura)
// para a Garbo no banco NOVO (schema crm, empresa_id = Garbo).
//
// Uso: node --env-file=.env scripts/modelos-padrao/importar-empresa-antiga.mjs [--dry-run]
//
// - Mantém os ids (uuid) do antigo; linhas já existentes são mantidas (ON CONFLICT DO NOTHING).
// - Tabelas de "linha única" (markup_config, template de slides) só entram se a Garbo não tiver nenhuma.
// - Contratos: os 4 modelos antigos entram; o ativo passa a ser o ativo do antigo (o "Contrato padrão"
//   semeado fica inativo). Campos variáveis faltantes entram por nome.
// - Imagens dos blocos de slide: baixadas do storage público antigo, enviadas ao bucket do novo
//   (mesmo caminho, dono = um usuário da Garbo) e as URLs reescritas. No --dry-run nada é enviado.
import { connectAntigo, connectNovo, GARBO_ID, OLD_REF } from './_old.mjs'

const dryRun = process.argv.includes('--dry-run')
const NEW_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!NEW_URL?.includes('vejugdspjfgfajdpfiht') || !SERVICE_KEY) { console.error('ABORTADO: VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const TABELAS = [
  // [tabela, linhaUnica]
  ['markup_categorias', false],
  ['markup_produtos', false],
  ['markup_config', true],
  ['markup_despesa_templates', false],
  ['markup_servico_templates', false],
  ['markup_regras_construtivas', false],
  ['orcamento_slide_templates', true],
  ['orcamento_slide_blocos', false],
  ['orcamento_slide_perguntas', false],
  ['orcamento_slide_pergunta_opcoes', false],
  ['orcamento_slide_catalogo', false],
  ['orcamento_slide_scripts', false],
  ['orcamento_slide_formas_pagamento', false],
  ['contratos_modelos', false],
]

const q = s => '"' + s.replace(/"/g, '""') + '"'
const old = await connectAntigo()
const dst = await connectNovo()

async function colunas(c, schema, t) {
  return (await c.query(`select a.attname, format_type(a.atttypid, a.atttypmod) ty from pg_attribute a
    where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' order by a.attnum`,
  [q(schema) + '.' + q(t)])).rows
}

// 1) imagens do storage antigo ----------------------------------------------------------------
const OLD_PREFIX = `https://${OLD_REF}.supabase.co/storage/v1/object/public/`
const NEW_PREFIX = `${NEW_URL.replace(/\/$/, '')}/storage/v1/object/public/`
const urls = new Set()
for (const t of ['orcamento_slide_blocos', 'orcamento_slide_templates', 'orcamento_slide_catalogo']) {
  const r = await old.query(`select (regexp_matches(to_jsonb(x)::text, '${OLD_PREFIX.replace(/\./g, '\\.')}[^"\\\\]+', 'g'))[1] u from emp_garbo.${t} x`)
  for (const row of r.rows) urls.add(row.u)
}
console.log(`imagens no storage antigo: ${urls.size}`)

let ownerGarbo = null
{
  const r = await dst.query(`select user_id from "CRM-multi-empresas>usuario_empresa<" where empresa_id = $1 limit 1`, [GARBO_ID])
  ownerGarbo = r.rows[0]?.user_id ?? null
}

if (!dryRun) {
  for (const u of urls) {
    const caminho = u.slice(OLD_PREFIX.length) // bucket/obj
    const i = caminho.indexOf('/')
    const bucket = caminho.slice(0, i), obj = caminho.slice(i + 1)
    const res = await fetch(u)
    if (!res.ok) throw new Error(`download falhou (${res.status}): ${caminho}`)
    const body = Buffer.from(await res.arrayBuffer())
    const up = await fetch(`${NEW_URL}/storage/v1/object/${bucket}/${obj}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': res.headers.get('content-type') || 'application/octet-stream', 'x-upsert': 'true' },
      body,
    })
    if (!up.ok) throw new Error(`upload falhou (${up.status}): ${caminho} ${await up.text()}`)
    if (ownerGarbo) {
      await dst.query(`update storage.objects set owner = $1::uuid, owner_id = $4 where bucket_id = $2 and name = $3`, [ownerGarbo, bucket, obj, String(ownerGarbo)])
    }
    console.log(`  imagem copiada: ${caminho}`)
  }
}

// 2) linhas ------------------------------------------------------------------------------------
try {
  await dst.query('BEGIN')
  await dst.query("SET LOCAL session_replication_role = 'replica'") // sem triggers/FKs: empresa_id vai explícito
  for (const [t, linhaUnica] of TABELAS) {
    if (linhaUnica) {
      const ja = (await dst.query(`select count(*)::int n from crm.${q(t)} where empresa_id = $1`, [GARBO_ID])).rows[0].n
      if (ja > 0) { console.log(`${t}: Garbo já tem ${ja} linha(s) — mantido`); continue }
    }
    const dcols = await colunas(dst, 'crm', t)
    const ocols = new Set((await colunas(old, 'emp_garbo', t)).map(c => c.attname))
    const usar = dcols.filter(c => ocols.has(c.attname) && c.attname !== 'empresa_id')
    const rows = (await old.query({ text: `select ${usar.map(c => q(c.attname) + '::text').join(', ')} from emp_garbo.${q(t)}`, rowMode: 'array' })).rows
    let ins = 0
    for (const r0 of rows) {
      const r = r0.map(v => (typeof v === 'string' && v.includes(OLD_PREFIX) ? v.split(OLD_PREFIX).join(NEW_PREFIX) : v))
      const res = await dst.query(
        `insert into crm.${q(t)} (${usar.map(c => q(c.attname)).join(', ')}, empresa_id)
         values (${usar.map((c, i) => '$' + (i + 1) + '::' + c.ty).join(', ')}, $${usar.length + 1}::uuid) on conflict do nothing`,
        [...r, GARBO_ID])
      ins += res.rowCount
    }
    console.log(`${t}: ${rows.length} no antigo, ${ins} inseridas`)
  }

  // contratos: ativo = o ativo do antigo; campos faltantes por nome
  const ativoAntigo = (await old.query(`select id from emp_garbo.contratos_modelos where ativo order by updated_at desc nulls last limit 1`)).rows[0]?.id
  if (ativoAntigo) {
    await dst.query(`update crm.contratos_modelos set ativo = (id = $2) where empresa_id = $1`, [GARBO_ID, ativoAntigo])
    console.log(`contratos_modelos: ativo = ${ativoAntigo}`)
  }
  const vcols = (await colunas(dst, 'crm', 'contratos_variaveis')).filter(c => !['empresa_id', 'valor_padrao'].includes(c.attname))
  const vrows = (await old.query({ text: `select ${vcols.map(c => q(c.attname) + '::text').join(', ')} from emp_garbo.contratos_variaveis`, rowMode: 'array' })).rows
  let vins = 0
  for (const r of vrows) {
    const res = await dst.query(
      `insert into crm.contratos_variaveis (${vcols.map(c => q(c.attname)).join(', ')}, empresa_id)
       values (${vcols.map((c, i) => '$' + (i + 1) + '::' + c.ty).join(', ')}, $${vcols.length + 1}::uuid) on conflict do nothing`,
      [...r, GARBO_ID])
    vins += res.rowCount
  }
  console.log(`contratos_variaveis: ${vrows.length} no antigo, ${vins} inseridas (as demais já existiam por nome/id)`)

  const restantes = (await dst.query(`select
    (select count(*) from crm.orcamento_slide_blocos where empresa_id = $1 and config::text like '%${OLD_REF}%')
  + (select count(*) from crm.orcamento_slide_templates where empresa_id = $1 and to_jsonb(orcamento_slide_templates)::text like '%${OLD_REF}%') n`, [GARBO_ID])).rows[0].n
  console.log(`URLs do projeto antigo restantes: ${restantes}`)

  await dst.query(dryRun ? 'ROLLBACK' : 'COMMIT')
  console.log(dryRun ? 'ENSAIO (ROLLBACK feito, nenhuma imagem enviada)' : 'COMMIT')
} catch (e) {
  await dst.query('ROLLBACK').catch(() => {})
  console.error('FALHOU — nada gravado (ROLLBACK): ' + e.message)
  process.exitCode = 1
} finally {
  await old.end(); await dst.end()
}
