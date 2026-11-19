/**
 * T18 (modelos padrão) — teste REAL pela API (PostgREST + Auth) do fluxo completo:
 * empresa-modelo (importa a Garbo) → publica → plano → empresa nova com o plano → admin dela lê e
 * edita a CÓPIA → modelo e Garbo intactos; link público por slug; admin não usa RPCs do master.
 * Cria iso_modelo / iso_modelos_c / plano iso_modelos_plano e apaga tudo no início e no fim.
 * Senha aleatória, nunca impressa.
 *
 * Uso: node --env-file=.env scripts/modelos-padrao/test-modelos-api.mjs
 */
import { randomBytes } from 'node:crypto'
import { connectNovo, NEW_REF } from '../multi-empresa/db.mjs'

const URL_ = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
if (!URL_?.includes(NEW_REF) || !ANON) {
  console.error('ABORTADO: VITE_SUPABASE_URL/KEY ausentes ou fora do projeto novo')
  process.exit(1)
}
const GARBO = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
const MODELO = { slug: 'iso_modelo' }
const C = { slug: 'iso_modelos_c', email: 'iso.modelos.c@teste.local', senha: randomBytes(12).toString('base64url') + 'a1' }
const PLANO = 'iso_modelos_plano'

let ok = 0
let falhas = 0
function check(nome, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✅ ${nome}`) } else { falhas++; console.log(`  ❌ ${nome} ${extra}`) }
}

async function rest(token, path, { method = 'GET', body, profile, prefer } = {}) {
  const h = { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, 'Content-Type': 'application/json', Prefer: prefer ?? 'return=representation' }
  if (profile) { h['Accept-Profile'] = profile; h['Content-Profile'] = profile }
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  const txt = await r.text()
  let json = null
  try { json = txt ? JSON.parse(txt) : null } catch { json = txt }
  return { status: r.status, json }
}

async function login(email, password) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`login falhou: ${j.error_description ?? j.msg ?? r.status}`)
  return j.access_token
}

const pg = await connectNovo()
const contar = async (sql, args) => Number((await pg.query(sql, args)).rows[0].n)

async function limpar() {
  const ids = (await pg.query(`select id from public."CRM-multi-empresas>empresas<" where slug = any($1)`, [[MODELO.slug, C.slug]])).rows.map((r) => r.id)
  if (ids.length) {
    // markup_produtos → categorias é RESTRICT: apaga os produtos antes do cascade da empresa.
    await pg.query(`delete from crm.markup_produtos where empresa_id = any($1)`, [ids])
    await pg.query(`delete from public.plataforma_modelos where empresa_modelo_id = any($1)`, [ids])
  }
  await pg.query(`delete from auth.users where email = $1`, [C.email])
  await pg.query(`delete from public."CRM-multi-empresas>empresas<" where slug = any($1)`, [[MODELO.slug, C.slug]])
  await pg.query(`delete from public.plataforma_planos where nome = $1`, [PLANO])
}

try {
  await limpar()
  const garboAntes = {
    produtos: await contar(`select count(*) n from crm.markup_produtos where empresa_id = $1`, [GARBO]),
    contratos: await contar(`select count(*) n from crm.contratos_modelos where empresa_id = $1`, [GARBO]),
    precos: (await pg.query(`select md5(string_agg(id::text || preco_unitario::text, ',' order by id)) h from crm.markup_produtos where empresa_id = $1`, [GARBO])).rows[0].h,
  }

  console.log('1. Master: empresa-modelo, publicação, plano e empresa nova (SQL com JWT do master)')
  await pg.query('begin')
  await pg.query(`select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true)`)
  await pg.query('set local role authenticated')
  MODELO.id = (await pg.query(`select public.master_criar_empresa_modelo('Iso Modelo', $1, 'marcenaria', $2) id`, [MODELO.slug, GARBO])).rows[0].id
  const cat = (await pg.query(`select id, tipo, contagem from public.master_listar_modelos($1)`, [MODELO.id])).rows
  const publicar = cat.filter((m) => ['markup', 'slides', 'apresentacao'].includes(m.tipo) || (m.tipo === 'contrato' && m.contagem?.ativo_no_modelo))
  for (const m of publicar) await pg.query(`select public.master_publicar_modelo($1, true)`, [m.id])
  const plano = (await pg.query(`insert into plataforma_planos (nome, valor_mensal) values ($1, 1) returning id`, [PLANO])).rows[0].id
  await pg.query(`select public.master_salvar_modelos_plano($1, $2)`, [plano, publicar.map((m) => m.id)])
  C.id = (await pg.query(`select public.master_criar_empresa('Iso Modelos C', $1, $2, 'Admin C', $3, null, null, null, $4, null, 5) id`,
    [C.slug, C.email, C.senha, plano])).rows[0].id
  await pg.query('commit')
  check('empresa-modelo e empresa C criadas', !!MODELO.id && !!C.id)
  check('4 modelos publicados (markup, slides, apresentação, contrato ativo)', publicar.length === 4, `(${publicar.length})`)

  const tC = await login(C.email, C.senha)

  console.log('\n2. Admin de C lê a própria cópia pela API')
  const prodModelo = await contar(`select count(*) n from crm.markup_produtos where empresa_id = $1`, [MODELO.id])
  const prodC = await rest(tC, 'markup_produtos?select=id,preco_unitario,empresa_id', { profile: 'crm' })
  check('C vê os produtos copiados', prodC.status === 200 && prodC.json.length === prodModelo && prodModelo > 0, `(${prodC.json?.length} de ${prodModelo})`)
  check('todos os produtos lidos são de C', Array.isArray(prodC.json) && prodC.json.every((p) => p.empresa_id === C.id))
  const blocos = await rest(tC, 'orcamento_slide_blocos?select=id', { profile: 'crm' })
  check('C vê os blocos de slide', blocos.status === 200 && blocos.json.length > 0, `(${blocos.json?.length})`)
  const contratos = await rest(tC, 'contratos_modelos?select=id,nome,ativo', { profile: 'crm' })
  check('C tem 1 contrato, ativo (sem o padrão duplicado)', contratos.json?.length === 1 && contratos.json[0].ativo, JSON.stringify(contratos.json))
  const apr = await rest(tC, 'apresentacao_conteudo?select=conteudo', { profile: 'crm' })
  check('C tem a apresentação copiada', apr.json?.length === 1 && !!apr.json[0].conteudo?.marca, JSON.stringify(apr.json).slice(0, 120))

  console.log('\n3. Admin de C edita a cópia; modelo e Garbo intactos')
  const alvo = prodC.json[0]
  const up = await rest(tC, `markup_produtos?id=eq.${alvo.id}`, { method: 'PATCH', body: { preco_unitario: 777.77 }, profile: 'crm' })
  check('C altera preço', up.status === 200 && up.json?.[0]?.preco_unitario == 777.77, JSON.stringify(up.json).slice(0, 120))
  check('preço não mudou fora de C', (await contar(`select count(*) n from crm.markup_produtos where preco_unitario = 777.77 and empresa_id <> $1`, [C.id])) === 0)
  const ups = await rest(tC, 'apresentacao_conteudo?on_conflict=empresa_id', {
    method: 'POST', profile: 'crm', prefer: 'resolution=merge-duplicates,return=representation',
    body: { empresa_id: C.id, conteudo: { marca: { titulo: 'Iso C' } }, pontua: {} },
  })
  check('C salva a apresentação (upsert como no editor)', ups.status === 200 || ups.status === 201, `status ${ups.status} ${JSON.stringify(ups.json).slice(0, 160)}`)
  check('apresentação do modelo intacta', (await contar(`select count(*) n from crm.apresentacao_conteudo where empresa_id = $1 and conteudo->'marca'->>'titulo' = 'Iso C'`, [MODELO.id])) === 0)
  const forca = await rest(tC, 'apresentacao_conteudo?on_conflict=empresa_id', {
    method: 'POST', profile: 'crm', prefer: 'resolution=merge-duplicates,return=representation',
    body: { empresa_id: GARBO, conteudo: { marca: { titulo: 'hack' } }, pontua: {} },
  })
  check('C não grava apresentação da Garbo forçando empresa_id', forca.status >= 400, `status ${forca.status}`)
  const garboDepois = {
    produtos: await contar(`select count(*) n from crm.markup_produtos where empresa_id = $1`, [GARBO]),
    contratos: await contar(`select count(*) n from crm.contratos_modelos where empresa_id = $1`, [GARBO]),
    precos: (await pg.query(`select md5(string_agg(id::text || preco_unitario::text, ',' order by id)) h from crm.markup_produtos where empresa_id = $1`, [GARBO])).rows[0].h,
  }
  check('Garbo intacta (produtos, preços, contratos)', JSON.stringify(garboAntes) === JSON.stringify(garboDepois))

  console.log('\n4. Isolamento e permissões')
  const doModelo = await rest(tC, `markup_produtos?select=id&empresa_id=eq.${MODELO.id}`, { profile: 'crm' })
  check('C não lê produtos da empresa-modelo', doModelo.status === 200 && doModelo.json.length === 0)
  const rpcMaster = await rest(tC, 'rpc/master_listar_modelos', { method: 'POST', body: {} })
  check('C não usa RPC do master', rpcMaster.status >= 400, `status ${rpcMaster.status}`)
  const rpcCopia = await rest(tC, 'rpc/plataforma_copiar_markup', { method: 'POST', body: { p_origem: GARBO, p_destino: C.id } })
  check('C não chama a cópia interna', rpcCopia.status >= 400, `status ${rpcCopia.status}`)
  const cat2 = await rest(tC, 'plataforma_modelos?select=id')
  check('C não lê o catálogo', cat2.status >= 400 || (Array.isArray(cat2.json) && cat2.json.length === 0))

  console.log('\n5. Link público (anon)')
  const pub = await rest(null, 'rpc/apresentacao_publica', { method: 'POST', body: { p_slug: C.slug } })
  check('anon lê a apresentação de C pelo slug', pub.status === 200 && pub.json?.empresa_id === C.id && pub.json?.conteudo?.marca?.titulo === 'Iso C', JSON.stringify(pub.json).slice(0, 160))
  const pubModelo = await rest(null, 'rpc/apresentacao_publica', { method: 'POST', body: { p_slug: MODELO.slug } })
  check('empresa-modelo não tem link público', pubModelo.status === 200 && pubModelo.json === null)
  const anonTab = await rest(null, 'apresentacao_conteudo?select=id', { profile: 'crm' })
  check('anon não lê a tabela', anonTab.status >= 400 || (Array.isArray(anonTab.json) && anonTab.json.length === 0))
} catch (e) {
  falhas++
  console.error('ERRO:', e.message)
  await pg.query('rollback').catch(() => {})
} finally {
  await limpar().catch((e) => console.error('limpeza falhou:', e.message))
  await pg.end()
  console.log(`\n${ok} ok, ${falhas} falha(s)`)
  process.exitCode = falhas ? 1 : 0
}
