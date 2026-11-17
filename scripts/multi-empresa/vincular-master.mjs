/**
 * M01 — Torna selvomichael@gmail.com o usuário MASTER da plataforma e o vincula à Garbo.
 * Idempotente: pode rodar várias vezes. Pré-requisito: o usuário já existe em auth.users.
 * Funciona antes e depois da M08 (schema do CRM `emp_garbo` ou `crm`).
 *
 * Uso: node --env-file=.env scripts/multi-empresa/vincular-master.mjs
 */
import { connectNovo } from './db.mjs'

const EMAIL = 'selvomichael@gmail.com'
const c = await connectNovo()

try {
  await c.query('begin')
  const u = await c.query('select id from auth.users where lower(email) = $1', [EMAIL])
  if (!u.rows.length) throw new Error(`Usuário ${EMAIL} não existe em auth.users. Crie-o no Auth primeiro.`)
  const uid = u.rows[0].id

  const e = await c.query(`select id from public."CRM-multi-empresas>empresas<" where slug = 'garbo'`)
  if (!e.rows.length) throw new Error('Empresa Garbo (slug garbo) não encontrada.')
  const empresaId = e.rows[0].id

  const s = await c.query(
    `select nspname from pg_namespace where nspname in ('crm','emp_garbo') order by nspname = 'crm' desc limit 1`,
  )
  const crm = s.rows[0]?.nspname
  if (!crm) throw new Error('Schema do CRM (crm/emp_garbo) não encontrado.')
  const crmTemEmpresa = (
    await c.query(
      `select 1 from information_schema.columns where table_schema=$1 and table_name='usuarios' and column_name='empresa_id'`,
      [crm],
    )
  ).rows.length > 0
  const movTemEmpresa = (
    await c.query(
      `select 1 from information_schema.columns where table_schema='public' and table_name='movelaria_usuarios' and column_name='empresa_id'`,
    )
  ).rows.length > 0

  await c.query(
    `insert into public."CRM-multi-empresas>super_admins<" (user_id) values ($1) on conflict (user_id) do nothing`,
    [uid],
  )
  await c.query(
    `insert into public."CRM-multi-empresas>usuario_empresa<" (user_id, empresa_id) values ($1, $2)
     on conflict do nothing`,
    [uid, empresaId],
  )

  if (movTemEmpresa) {
    await c.query(
      `insert into public.movelaria_usuarios (id, email, perfil, ativo, empresa_id)
       values ($1, $2, 'administrador', true, $3)
       on conflict (id) do update set perfil = 'administrador', ativo = true, empresa_id = excluded.empresa_id, atualizado_em = now()`,
      [uid, EMAIL, empresaId],
    )
  } else {
    await c.query(
      `insert into public.movelaria_usuarios (id, email, perfil, ativo)
       values ($1, $2, 'administrador', true)
       on conflict (id) do update set perfil = 'administrador', ativo = true, atualizado_em = now()`,
      [uid, EMAIL],
    )
  }

  const empCols = crmTemEmpresa ? ', empresa_id' : ''
  const empVal = crmTemEmpresa ? ', $3' : ''
  await c.query(
    `insert into ${crm}.usuarios (id, nome, email, tipo_usuario, status_convite${empCols})
     values ($1, 'Michael (Master)', $2, 'colaborador', 'ATIVO'${empVal})
     on conflict (id) do update set status_convite = 'ATIVO', atualizado_em = now()`,
    crmTemEmpresa ? [uid, EMAIL, empresaId] : [uid, EMAIL],
  )
  await c.query(
    `insert into ${crm}.user_roles (user_id, role${empCols}) values ($1, 'admin'${crmTemEmpresa ? ', $2' : ''})
     on conflict do nothing`,
    crmTemEmpresa ? [uid, empresaId] : [uid],
  )

  await c.query('commit')

  const v = await c.query(
    `select public.me_is_super_admin($1) as is_master,
       (select count(*) from public."CRM-multi-empresas>usuario_empresa<" where user_id=$1)::int as vinculos,
       (select perfil from public.movelaria_usuarios where id=$1) as perfil_nucleo,
       (select count(*) from ${crm}.user_roles where user_id=$1 and role='admin')::int as crm_admin`,
    [uid],
  )
  console.log('Schema CRM:', crm)
  console.table(v.rows)
} catch (err) {
  await c.query('rollback').catch(() => {})
  console.error('ERRO:', err.message)
  process.exitCode = 1
} finally {
  await c.end()
}
