/**
 * Marca neutra (docs/marca-neutra, T09): gera a migration que tira o nome de cliente do esquema do banco.
 * Lê o catálogo do banco NOVO (somente leitura) e escreve, na ordem:
 *   tabelas → colunas → constraints → índices → triggers → nomes de função → corpos de função (recriados
 *   com os nomes novos) → comentários → defaults → dados ('Pontua …' / 'Lead …').
 * Rodar uma vez antes de aplicar; depois a migration fica como está (histórico).
 *
 * Uso: node --env-file=.env scripts/marca-neutra/gerar-migration-banco.mjs <arquivo.sql>
 */
import fs from 'node:fs'
import { connectNovo } from '../multi-empresa/db.mjs'

const saida = process.argv[2]
if (!saida) {
  console.error('informe o arquivo de saída')
  process.exit(1)
}

// Termo a remover, montado em partes para o próprio script não carregar o nome.
const T = ['g', 'a', 'r', 'b', 'o'].join('')
const TC = T[0].toUpperCase() + T.slice(1)
const re = (s, f = 'g') => new RegExp(s, f)

/** Mesma regra do front: nomes snake/quoted sem o termo; valores gravados neutros. */
function neutro(s) {
  return s
    .replace(re(`'Pontua ${TC}'`), "'Pontua'")
    .replace(re(`Pontua ${TC}`), 'Pontua')
    .replace(re(`'Lead ${TC}'`), "'Lead'")
    .replace(re(`emp_${T}_`), '')
    .replace(re(`_${T}_`), '_')
    .replace(re(`_${T}\\b`), '')
    .replace(re(`\\b${T}_`), '')
}

const q = (id) => `"${id.replace(/"/g, '""')}"`
const pg = await connectNovo()
await pg.query('set session characteristics as transaction read only')
const like = `%${T}%`
const sql = []
const add = (l) => sql.push(l)

try {
  add(`-- Marca neutra (docs/marca-neutra, T09; ADR 0006): o esquema do banco deixa de citar uma empresa cliente.`)
  add(`-- Gerada por scripts/marca-neutra/gerar-migration-banco.mjs a partir do catálogo. Publicar junto com o`)
  add(`-- front e as edge functions (create-user-admin, register-public, rep-gerar-comprovante, orcamentos-ia-chat).`)
  add('')

  const tabelas = (await pg.query(
    `select n.nspname s, c.relname o from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind in ('r','p') and c.relname ilike $1 order by 1,2`, [like])).rows
  add('-- 1) Tabelas')
  for (const t of tabelas) add(`alter table ${q(t.s)}.${q(t.o)} rename to ${q(neutro(t.o))};`)

  const tabNova = (s, o) => `${q(s)}.${q(neutro(o))}`
  const colunas = (await pg.query(
    `select table_schema s, table_name t, column_name c from information_schema.columns
      where column_name ilike $1 order by 1,2,3`, [like])).rows
  add('\n-- 2) Colunas')
  for (const c of colunas) add(`alter table ${tabNova(c.s, c.t)} rename column ${q(c.c)} to ${q(neutro(c.c))};`)

  const cons = (await pg.query(
    `select n.nspname s, cl.relname t, co.conname c from pg_constraint co join pg_class cl on cl.oid=co.conrelid
       join pg_namespace n on n.oid=cl.relnamespace where co.conname ilike $1 order by 1,2,3`, [like])).rows
  add('\n-- 3) Constraints (renomeiam também o índice que as sustenta)')
  for (const c of cons) add(`alter table ${tabNova(c.s, c.t)} rename constraint ${q(c.c)} to ${q(neutro(c.c))};`)

  const idx = (await pg.query(
    `select n.nspname s, c.relname o from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='i' and c.relname ilike $1
        and not exists (select 1 from pg_constraint co where co.conindid = c.oid and co.conname ilike $1)
      order by 1,2`, [like])).rows
  add('\n-- 4) Índices')
  for (const i of idx) add(`alter index ${q(i.s)}.${q(i.o)} rename to ${q(neutro(i.o))};`)

  const trg = (await pg.query(
    `select n.nspname s, cl.relname t, tg.tgname g from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid
       join pg_namespace n on n.oid=cl.relnamespace where tg.tgname ilike $1 and not tg.tgisinternal order by 1,2,3`, [like])).rows
  add('\n-- 5) Triggers')
  for (const t of trg) add(`alter trigger ${q(t.g)} on ${tabNova(t.s, t.t)} rename to ${q(neutro(t.g))};`)

  const fnomes = (await pg.query(
    `select n.nspname s, p.proname f, pg_get_function_identity_arguments(p.oid) a from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace where p.proname ilike $1 order by 1,2`, [like])).rows
  add('\n-- 6) Nomes de função (grants e triggers acompanham o oid)')
  for (const f of fnomes) add(`alter function ${q(f.s)}.${q(f.f)}(${f.a}) rename to ${q(neutro(f.f))};`)

  const corpos = (await pg.query(
    `select n.nspname s, p.proname f, pg_get_functiondef(p.oid) d from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
      where (p.prosrc ilike $1 or p.proname ilike $1) and n.nspname not in ('pg_catalog','information_schema')
      order by 1,2`, [like])).rows
  add('\n-- 7) Corpos de função recriados com os nomes e valores novos')
  for (const c of corpos) {
    let d = neutro(c.d)
    // Campo do programa: reconhecido pelo nome "Pontua" (o termo antigo saiu dos dados nesta migration).
    d = d.replace(re(`\\s+AND lower\\(trim\\(COALESCE\\(p_nome, ''\\)\\)\\) LIKE '%${T}%'`), '')
         .replace(re(`\\s+OR lower\\(trim\\(COALESCE\\(p_nome, ''\\)\\)\\) LIKE '%${T}%'`), '')
    // Recibo: nome da empresa do contexto, não um nome fixo.
    d = d.replace(re(`'${T.toUpperCase()} MOVELARIA'`),
      `upper(coalesce((select e.nome from public."CRM-multi-empresas>empresas<" e where e.id = public.app_empresa_atual()), ''))`)
    if (re(T, 'i').test(d)) throw new Error(`corpo de ${c.s}.${c.f} ainda cita o termo: ${d.match(re(`.{0,60}${T}.{0,30}`, 'i'))[0]}`)
    add(d.trimEnd() + ';\n')
  }

  const coms = (await pg.query(
    `select n.nspname s, p.proname f, pg_get_function_identity_arguments(p.oid) a, obj_description(p.oid, 'pg_proc') c
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where obj_description(p.oid, 'pg_proc') ilike $1 order by 1,2`, [like])).rows
  add('-- 8) Comentários')
  for (const c of coms) {
    const txt = neutro(c.c).replace(re(`\\b${TC}\\b`), 'da empresa')
    add(`comment on function ${q(c.s)}.${q(neutro(c.f))}(${c.a}) is '${txt.replace(/'/g, "''")}';`)
  }

  const defs = (await pg.query(
    `select table_schema s, table_name t, column_name c from information_schema.columns where column_default ilike $1`, [like])).rows
  add('\n-- 9) Defaults')
  for (const d of defs) add(`alter table ${tabNova(d.s, d.t)} alter column ${q(d.c)} set default '';`)

  add(`
-- 10) Valores gravados: o programa é "Pontua" e o lead sem origem é "Lead".
update crm.lead_custom_field_definitions set nome = 'Pontua' where nome = 'Pontua ${TC}';
update crm.markup_servico_templates set nome = 'Pontua' where nome = 'Pontua ${TC}';
update crm.leads set origem = 'Pontua' where origem = 'Pontua ${TC}';
update crm.lead_origins set nome = 'Pontua' where nome = 'Pontua ${TC}'
  and not exists (select 1 from crm.lead_origins o2 where o2.empresa_id = crm.lead_origins.empresa_id and o2.nome = 'Pontua');
update public.movelaria_contas_pagar set descricao = replace(descricao, ' — Pontua ${TC}', ' — Pontua') where descricao like '%— Pontua ${TC}%';
update public.movelaria_clientes set origem = 'Lead' where origem = 'Lead ${TC}';`)

  fs.writeFileSync(saida, sql.join('\n') + '\n')
  console.log(`ok: ${saida} (${tabelas.length} tabelas, ${colunas.length} colunas, ${cons.length} constraints, ${idx.length} índices, ${trg.length} triggers, ${fnomes.length} nomes, ${corpos.length} corpos)`)
} finally {
  await pg.end()
}
