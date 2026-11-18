/**
 * M31 — Teste de isolamento REAL pela API (PostgREST + Auth + Storage) com duas empresas de teste.
 * Cria as empresas iso_a e iso_b (com admins), faz login como cada admin e confere que um não enxerga
 * nem altera dados do outro. No fim apaga tudo o que criou. Senhas são aleatórias e nunca impressas.
 *
 * Uso: node --env-file=.env scripts/multi-empresa/test-isolamento.mjs
 */
import { randomBytes } from 'node:crypto'
import { connectNovo, NEW_REF } from './db.mjs'

const URL_ = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
if (!URL_?.includes(NEW_REF) || !ANON) {
  console.error('ABORTADO: VITE_SUPABASE_URL/KEY ausentes ou fora do projeto novo')
  process.exit(1)
}

const senha = () => randomBytes(12).toString('base64url') + 'a1'
const EMP = {
  a: { slug: 'iso_teste_a', email: 'iso.admin.a@teste.local', senha: senha() },
  b: { slug: 'iso_teste_b', email: 'iso.admin.b@teste.local', senha: senha() },
}

let ok = 0
let falhas = 0
function check(nome, cond, extra = '') {
  if (cond) {
    ok++
    console.log(`  ✅ ${nome}`)
  } else {
    falhas++
    console.log(`  ❌ ${nome} ${extra}`)
  }
}

async function rest(token, path, { method = 'GET', body, profile } = {}) {
  const h = { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  if (profile) {
    h['Accept-Profile'] = profile
    h['Content-Profile'] = profile
  }
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  const txt = await r.text()
  let json = null
  try {
    json = txt ? JSON.parse(txt) : null
  } catch {
    json = txt
  }
  return { status: r.status, json }
}

async function login(email, password) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`login falhou para ${email}: ${j.error_description ?? j.msg ?? r.status}`)
  return j.access_token
}

const pg = await connectNovo()
async function limpar() {
  await pg.query(`delete from auth.users where email in ($1, $2)`, [EMP.a.email, EMP.b.email])
  await pg.query(`delete from public."CRM-multi-empresas>empresas<" where slug in ($1, $2)`, [EMP.a.slug, EMP.b.slug])
  await pg.query(`delete from public.plataforma_planos where nome = 'iso_teste_plano'`)
  // Storage não permite apagar por SQL: usa a API com service role.
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (svc) {
    await fetch(`${URL_}/storage/v1/object/movelaria-obra-arquivos`, {
      method: 'DELETE',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: ['iso-teste/a.png'] }),
    })
  }
}

try {
  await limpar()
  // Cria as empresas como o master (JWT simulado na sessão do banco).
  await pg.query('begin')
  await pg.query(
    `select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true)`,
  )
  await pg.query('set local role authenticated')
  for (const k of ['a', 'b']) {
    const e = EMP[k]
    const r = await pg.query(
      `select public.master_criar_empresa($1, $2, $3, $4, $5) id`,
      [`Isolamento ${k.toUpperCase()}`, e.slug, e.email, `Admin ${k.toUpperCase()}`, e.senha],
    )
    e.id = r.rows[0].id
  }
  await pg.query('commit')
  console.log('Empresas de teste criadas.')

  const tA = await login(EMP.a.email, EMP.a.senha)
  const tB = await login(EMP.b.email, EMP.b.senha)

  console.log('\n1. Núcleo (movelaria_*)')
  const f = await rest(tA, 'movelaria_fornecedores', { method: 'POST', body: { nome: 'Fornecedor A' } })
  check('A cria fornecedor', f.status === 201 && f.json?.[0]?.empresa_id === EMP.a.id, JSON.stringify(f.json).slice(0, 160))
  const fornId = f.json?.[0]?.id
  const cr = await rest(tA, 'movelaria_contas_receber', {
    method: 'POST',
    body: { cliente_nome: 'Cliente A', valor_total: 1000, valor_parcela: 1000, numero_parcela: 1, total_parcelas: 1, data_vencimento: '2026-11-20', forma_pagamento: 'pix', status: 'recebido', data_recebimento: '2026-11-17' },
  })
  check('A cria conta a receber', cr.status === 201, JSON.stringify(cr.json).slice(0, 200))
  const lb = await rest(tB, `movelaria_fornecedores?id=eq.${fornId}`)
  check('B não vê fornecedor de A', lb.status === 200 && Array.isArray(lb.json) && lb.json.length === 0)
  const ub = await rest(tB, `movelaria_fornecedores?id=eq.${fornId}`, { method: 'PATCH', body: { nome: 'hack' } })
  check('B não altera fornecedor de A', Array.isArray(ub.json) && ub.json.length === 0)
  const db = await rest(tB, `movelaria_fornecedores?id=eq.${fornId}`, { method: 'DELETE' })
  check('B não exclui fornecedor de A', Array.isArray(db.json) && db.json.length === 0)
  const fb = await rest(tB, 'movelaria_fornecedores', { method: 'POST', body: { nome: 'Forn B', empresa_id: EMP.a.id } })
  check('B não insere em A forçando empresa_id', fb.status >= 400, `status ${fb.status}`)
  const an = await rest(null, 'movelaria_fornecedores')
  check('anon não lê fornecedores', (Array.isArray(an.json) && an.json.length === 0) || an.status >= 400)
  const ancr = await rest(null, 'movelaria_contas_receber')
  check('anon não lê contas a receber', (Array.isArray(ancr.json) && ancr.json.length === 0) || ancr.status >= 400)

  console.log('\n2. CRM (schema crm)')
  const lead = await rest(tA, 'leads', { method: 'POST', profile: 'crm', body: { nome: 'Lead A', telefone: '31999990000', status: 'Novo Lead' } })
  check('A cria lead', lead.status === 201 && lead.json?.[0]?.empresa_id === EMP.a.id, JSON.stringify(lead.json).slice(0, 200))
  const leadId = lead.json?.[0]?.id
  const lB = await rest(tB, `leads?id=eq.${leadId}`, { profile: 'crm' })
  check('B não vê lead de A', Array.isArray(lB.json) && lB.json.length === 0)
  const uB = await rest(tB, 'usuarios?select=id', { profile: 'crm' })
  check('B vê só usuários da própria empresa', Array.isArray(uB.json) && uB.json.length === 1, `vê ${uB.json?.length}`)

  console.log('\n3. Funções (definer)')
  const idB = await rest(tB, 'rpc/movelaria_listar_identidades', { method: 'POST', body: {} })
  check('listar_identidades de B não traz A', Array.isArray(idB.json) && idB.json.every((u) => u.email !== EMP.a.email), JSON.stringify(idB.json).slice(0, 160))
  const resB = await rest(tB, 'rpc/master_resumo_empresas', { method: 'POST', body: {} })
  check('B não acessa painel master', resB.status >= 400)
  const cobB = await rest(tB, 'plataforma_cobrancas')
  check('B não lê cobranças da plataforma', Array.isArray(cobB.json) && cobB.json.length === 0)

  console.log('\n4. Storage')
  const up = await fetch(`${URL_}/storage/v1/object/movelaria-obra-arquivos/iso-teste/a.png`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${tA}`, 'Content-Type': 'image/png' },
    // PNG 1x1 (o bucket só aceita imagens/documentos)
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  })
  check('A envia arquivo', up.status === 200, `status ${up.status} ${(await up.text()).slice(0, 120)}`)
  const dl = await fetch(`${URL_}/storage/v1/object/authenticated/movelaria-obra-arquivos/iso-teste/a.png`, {
    headers: { apikey: ANON, Authorization: `Bearer ${tB}` },
  })
  check('B não baixa arquivo de A', dl.status >= 400, `status ${dl.status}`)
  const dlA = await fetch(`${URL_}/storage/v1/object/authenticated/movelaria-obra-arquivos/iso-teste/a.png`, {
    headers: { apikey: ANON, Authorization: `Bearer ${tA}` },
  })
  check('A baixa o próprio arquivo', dlA.status === 200, `status ${dlA.status}`)

  console.log('\n5. Páginas bloqueadas (Fase I)')
  await pg.query('begin')
  await pg.query(
    `select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true)`,
  )
  await pg.query('set local role authenticated')
  await pg.query(`select public.master_salvar_paginas_empresa($1, '{"orcamentosIa": false, "leads": false}'::jsonb)`, [EMP.b.id])
  await pg.query('commit')
  const pgB = await rest(tB, 'rpc/app_minha_empresa', { method: 'POST', body: {} })
  const blq = pgB.json?.[0]?.paginas_bloqueadas ?? []
  check('B recebe as páginas bloqueadas', blq.includes('orcamentosIa') && blq.includes('leads'), JSON.stringify(blq))
  const pgA = await rest(tA, 'rpc/app_minha_empresa', { method: 'POST', body: {} })
  check('A não é afetada', (pgA.json?.[0]?.paginas_bloqueadas ?? []).length === 0)
  const chamarIa = (token) =>
    fetch(`${URL_}/functions/v1/orcamentos-ia-pipeline`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  const fnB = await chamarIa(tB)
  const fnTxt = await fnB.text()
  check('Orçamentos IA recusa B (página bloqueada)', fnB.status === 403 && fnTxt.includes('não está liberado'), `status ${fnB.status} ${fnTxt.slice(0, 120)}`)
  const fnA = await chamarIa(tA)
  check('Orçamentos IA não recusa A por página', fnA.status !== 403, `status ${fnA.status}`)

  console.log('\n5b. CRM pré-configurado e bloqueio pelo plano (Fase J)')
  const kb = await rest(tB, 'kanban_pages?select=slug&order=ordem', { profile: 'crm' })
  check('B nasce com os 3 kanbans padrão', (kb.json ?? []).map((r) => r.slug).join(',') === 'orcamentos,prospeccao,manutencao', JSON.stringify(kb.json).slice(0, 160))
  const et = await rest(tB, 'pipeline_custom_stages?select=nome&order=ordem', { profile: 'crm' })
  check('B nasce com as 6 etapas do Pipeline', (et.json ?? []).length === 6 && et.json[0].nome === 'Novo Lead', JSON.stringify(et.json).slice(0, 160))
  const plano = await pg.query(
    `insert into public.plataforma_planos (nome, valor_mensal, paginas_bloqueadas) values ('iso_teste_plano', 1, array['controleGastos','pipelineKanban:prospeccao']) returning id`,
  )
  await pg.query(`insert into public.plataforma_assinaturas (empresa_id, plano_id, valor, dia_vencimento) values ($1, $2, 1, 5)`, [EMP.b.id, plano.rows[0].id])
  const blqPlano = (await rest(tB, 'rpc/app_minha_empresa', { method: 'POST', body: {} })).json?.[0]?.paginas_bloqueadas ?? []
  check('Plano ligado a B bloqueia (página e kanban)', blqPlano.includes('controleGastos') && blqPlano.includes('pipelineKanban:prospeccao'), JSON.stringify(blqPlano))
  const blqA = (await rest(tA, 'rpc/app_minha_empresa', { method: 'POST', body: {} })).json?.[0]?.paginas_bloqueadas ?? []
  check('A continua sem bloqueio', blqA.length === 0, JSON.stringify(blqA))
  await pg.query('delete from public.plataforma_assinaturas where empresa_id = $1', [EMP.b.id])
  await pg.query('delete from public.plataforma_planos where id = $1', [plano.rows[0].id])

  console.log('\n6. Bloqueio por inadimplência')
  await pg.query(
    `insert into public.plataforma_assinaturas (empresa_id, valor, dia_vencimento, dias_tolerancia) values ($1, 100, 5, 3)`,
    [EMP.b.id],
  )
  await pg.query(
    `insert into public.plataforma_cobrancas (empresa_id, competencia, valor, vencimento) values ($1, date_trunc('month', current_date - interval '1 month')::date, 100, current_date - 20)`,
    [EMP.b.id],
  )
  await pg.query('select public.plataforma_atualizar_inadimplencia()')
  const bloq = await rest(tB, 'movelaria_fornecedores')
  check('B bloqueada não lê nada', Array.isArray(bloq.json) && bloq.json.length === 0)
  const minha = await rest(tB, 'rpc/app_minha_empresa', { method: 'POST', body: {} })
  check('B bloqueada ainda vê a própria empresa (tela suspensa)', minha.json?.[0]?.status === 'bloqueada')
} catch (e) {
  falhas++
  console.error('ERRO:', e.message)
  await pg.query('rollback').catch(() => {})
} finally {
  await limpar().catch((e) => console.error('limpeza:', e.message))
  await pg.end()
  console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Dados de teste removidos.`)
  process.exitCode = falhas ? 1 : 0
}
