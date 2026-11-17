/**
 * M03 — Gera SQL de isolamento por empresa a partir do catálogo do banco NOVO (só leitura).
 *
 * Uso:
 *   node --env-file=.env scripts/multi-empresa/gerar-tenant-migration.mjs tabelas <nucleo|crm|outras> > arquivo.sql
 *   node --env-file=.env scripts/multi-empresa/gerar-tenant-migration.mjs definers > arquivo.sql
 *   node --env-file=.env scripts/multi-empresa/gerar-tenant-migration.mjs unicos [grupo]   (relatório)
 *
 * O SQL gerado é idempotente e deve ser revisado antes de virar migration.
 */
import { createHash } from 'node:crypto'
import { connectNovo } from './db.mjs'
import { GARBO_ID, EMPRESAS_TABLE, isGlobal, tenantColumn, grupoDe } from './tenant-config.mjs'

const [modo, grupoArg] = process.argv.slice(2)
const c = await connectNovo()
await c.query('set session characteristics as transaction read only')

const qi = (s) => '"' + s.replace(/"/g, '""') + '"'
const fq = (s, t) => `${qi(s)}.${qi(t)}`
const short = (s, t) => 'tnt_' + createHash('md5').update(`${s}.${t}`).digest('hex').slice(0, 10)

async function tabelas() {
  const { rows } = await c.query(`
    select n.nspname s, c.relname t, c.relrowsecurity rls,
      array(select a.attname from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) cols,
      (select count(*) from pg_policy p where p.polrelid=c.oid and p.polpermissive
         and (p.polroles = '{0}' or 'authenticated'::regrole::oid = any(p.polroles)))::int perm_auth
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and n.nspname in ('public','emp_garbo','crm') and not c.relispartition
    order by 1,2`)
  return rows
}

async function gerarTabelas(grupo) {
  const rows = (await tabelas()).filter((r) => !isGlobal(r.s, r.t) && grupoDe(r.s, r.t) === grupo)
  const fks = await c.query(`
    select conrelid::regclass::text rel, a.attname col from pg_constraint k
    join pg_attribute a on a.attrelid=k.conrelid and a.attnum = k.conkey[1]
    where k.contype='f' and k.confrelid = '${EMPRESAS_TABLE}'::regclass and array_length(k.conkey,1)=1`)
  const fkSet = new Set(fks.rows.map((r) => `${r.rel}|${r.col}`))

  const out = [
    `-- GERADO por scripts/multi-empresa/gerar-tenant-migration.mjs (grupo: ${grupo}) — ${rows.length} tabelas.`,
    `-- Coluna de tenant + trigger aaa_tenant_fill + policy RESTRICTIVE tenant_isolamento + policy tenant_definer.`,
    `-- Tabelas que estavam SEM RLS ganham também tenant_acesso (permissiva, só dentro da empresa).`,
    '',
  ]
  for (const r of rows) {
    const col = tenantColumn(r.cols)
    const T = fq(r.s, r.t)
    const sh = short(r.s, r.t)
    const fill = col === 'company_id' ? 'app_tenant_fill_company' : 'app_tenant_fill'
    out.push(`-- ${r.s}.${r.t}${r.rls ? '' : '  (estava sem RLS)'}`)
    if (!r.cols.includes(col)) out.push(`alter table ${T} add column ${col} uuid;`)
    out.push(`update ${T} set ${col} = '${GARBO_ID}' where ${col} is null;`)
    out.push(`alter table ${T} alter column ${col} set not null;`)
    const relKey = (r.s === 'public' ? qi(r.t) : `${r.s}.${qi(r.t)}`)
    const hasFk = [...fkSet].some((k) => k === `${relKey}|${col}` || k === `${r.s}.${r.t}|${col}` || k === `${r.t}|${col}`)
    if (!hasFk) {
      out.push(`alter table ${T} add constraint ${sh}_fk foreign key (${col}) references ${EMPRESAS_TABLE}(id) on delete cascade;`)
    }
    out.push(`create index if not exists ${sh}_idx on ${T} (${col});`)
    out.push(`drop trigger if exists aaa_tenant_fill on ${T};`)
    out.push(`create trigger aaa_tenant_fill before insert on ${T} for each row execute function public.${fill}();`)
    if (!r.rls) {
      out.push(`alter table ${T} enable row level security;`)
      out.push(`drop policy if exists tenant_acesso on ${T};`)
      out.push(`create policy tenant_acesso on ${T} for all to authenticated using (true) with check (true);`)
    }
    out.push(`drop policy if exists tenant_isolamento on ${T};`)
    out.push(
      `create policy tenant_isolamento on ${T} as restrictive for all to public using (${col} = (select public.app_empresa_atual())) with check (${col} = (select public.app_empresa_atual()));`,
    )
    out.push(`drop policy if exists tenant_definer on ${T};`)
    out.push(`create policy tenant_definer on ${T} for all to app_tenant_definer using (true) with check (true);`)
    out.push('')
  }
  return out.join('\n')
}

// Funções definer que devem continuar com o postgres (BYPASSRLS).
async function gerarDefiners() {
  const pol = await c.query(`select coalesce(qual,'') || ' ' || coalesce(with_check,'') txt from pg_policies`)
  const funcs = await c.query(`
    select p.oid, n.nspname s, p.proname f, pg_get_function_identity_arguments(p.oid) args, p.prosrc src,
      pg_get_userbyid(p.proowner) owner
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prosecdef and n.nspname in ('public','emp_garbo','crm') and p.prokind = 'f'`)
  const byName = new Map()
  for (const f of funcs.rows) byName.set(f.f, [...(byName.get(f.f) || []), f])
  const callRe = /\b([a-z_][a-z0-9_]*)\s*\(/gi
  const keep = new Map() // nome -> motivo
  const mark = (name, why) => {
    if (!byName.has(name) || keep.has(name)) return false
    keep.set(name, why)
    return true
  }
  for (const r of pol.rows) for (const m of r.txt.matchAll(callRe)) mark(m[1], 'usada em policy')
  for (const f of funcs.rows) {
    if (/^app_|^app__|^master_|^plataforma_/.test(f.f)) mark(f.f, 'plataforma')
    else if (/\bauth\.(users|identities|sessions|refresh_tokens|mfa)/i.test(f.src)) mark(f.f, 'auth.*')
    else if (/\bstorage\./i.test(f.src)) mark(f.f, 'storage.*')
    else if (/\b(cron|net|vault)\./i.test(f.src)) mark(f.f, 'cron/net/vault')
    else if (/(create|alter|drop)\s+(table|schema|policy|index|function|trigger)|\bgrant\b|execute\s+format|execute\s+'/i.test(f.src))
      mark(f.f, 'ddl/sql dinâmico')
  }
  // Fecho: funções definer chamadas pelos helpers de policy também ficam (evita recursão de RLS).
  let changed = true
  while (changed) {
    changed = false
    for (const [name, why] of [...keep]) {
      if (why !== 'usada em policy' && why !== 'chamada por helper de policy') continue
      for (const f of byName.get(name) || [])
        for (const m of f.src.matchAll(callRe)) if (mark(m[1], 'chamada por helper de policy')) changed = true
    }
  }
  const out = ['-- GERADO: funções SECURITY DEFINER passam a ser do app_tenant_definer (sem BYPASSRLS).', '']
  const kept = []
  for (const f of funcs.rows.sort((a, b) => a.f.localeCompare(b.f))) {
    if (keep.has(f.f)) {
      kept.push(`--   mantém postgres: ${f.s}.${f.f}(${f.args})  [${keep.get(f.f)}]`)
      continue
    }
    out.push(`alter function ${qi(f.s)}.${qi(f.f)}(${f.args}) owner to app_tenant_definer;`)
  }
  return [out.length - 2 + ' funções re-atribuídas.', ...out, '', `-- ${kept.length} mantidas no postgres:`, ...kept].join('\n')
}

async function relUnicos(grupo) {
  const { rows } = await c.query(`
    select n.nspname s, t.relname t, i.relname idx, k.contype,
      array(select a.attname||':'||format_type(a.atttypid,a.atttypmod) from unnest(ix.indkey) with ordinality u(attnum,o)
            join pg_attribute a on a.attrelid=t.oid and a.attnum=u.attnum order by o) cols,
      pg_get_expr(ix.indpred, ix.indrelid) pred
    from pg_index ix join pg_class i on i.oid=ix.indexrelid join pg_class t on t.oid=ix.indrelid
    join pg_namespace n on n.oid=t.relnamespace
    left join pg_constraint k on k.conindid = ix.indexrelid and k.conrelid = ix.indrelid and k.contype in ('p','u')
    where ix.indisunique and n.nspname in ('public','emp_garbo','crm')
    order by 1,2,3`)
  const lines = []
  for (const r of rows) {
    if (isGlobal(r.s, r.t)) continue
    if (grupo && grupoDe(r.s, r.t) !== grupo) continue
    const cols = r.cols
    const isPkId = r.contype === 'p' && cols.length === 1 && /^id:/.test(cols[0])
    if (isPkId) continue
    if (cols.some((x) => /^(empresa_id|company_id):/.test(x))) continue
    const temUuid = cols.some((x) => x.endsWith(':uuid'))
    lines.push(`${temUuid ? 'uuid ' : 'NEGÓCIO'}\t${r.s}.${r.t}\t${r.idx}\t${r.contype || 'idx'}\t${cols.join(', ')}${r.pred ? '\tWHERE ' + r.pred : ''}`)
  }
  return lines.join('\n')
}

try {
  if (modo === 'tabelas') console.log(await gerarTabelas(grupoArg))
  else if (modo === 'definers') console.log(await gerarDefiners())
  else if (modo === 'unicos') console.log(await relUnicos(grupoArg))
  else console.error('modo: tabelas <grupo> | definers | unicos [grupo]')
} finally {
  await c.end()
}
