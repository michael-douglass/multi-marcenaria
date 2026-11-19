-- Modelos padrão (T04) — empresa-modelo e catálogo de modelos da plataforma.
-- Ver docs/modelos-padrao/DESIGN.md §3.1 e ADR 0005.

-- 1. Empresa-modelo ---------------------------------------------------------------------------------
alter table public."CRM-multi-empresas>empresas<"
  add column if not exists e_modelo boolean not null default false,
  add column if not exists segmento text;

comment on column public."CRM-multi-empresas>empresas<".e_modelo is
  'Empresa-modelo do master (fonte dos modelos padrão). Fora dos KPIs, faturamento e cobranças.';

-- 2. Catálogo -----------------------------------------------------------------------------------------
create table if not exists public.plataforma_modelos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('markup', 'slides', 'contrato', 'apresentacao', 'pontua')),
  empresa_modelo_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  ref_id uuid,
  nome text not null,
  descricao text,
  publicado boolean not null default false,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((tipo = 'contrato') = (ref_id is not null))
);
create unique index if not exists plataforma_modelos_unico
  on public.plataforma_modelos (empresa_modelo_id, tipo, coalesce(ref_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.plataforma_plano_modelos (
  plano_id uuid not null references public.plataforma_planos(id) on delete cascade,
  modelo_id uuid not null references public.plataforma_modelos(id) on delete cascade,
  primary key (plano_id, modelo_id)
);

create table if not exists public.plataforma_modelo_entregas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.plataforma_modelos(id) on delete cascade,
  empresa_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  versao integer not null,
  entregue_em timestamptz not null default now(),
  entregue_por uuid,
  resumo jsonb not null default '{}'::jsonb
);
create index if not exists plataforma_modelo_entregas_modelo_idx on public.plataforma_modelo_entregas (modelo_id, entregue_em desc);
create index if not exists plataforma_modelo_entregas_empresa_idx on public.plataforma_modelo_entregas (empresa_id);

do $$
declare t text;
begin
  foreach t in array array['plataforma_modelos','plataforma_plano_modelos','plataforma_modelo_entregas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists plataforma_master on public.%I', t);
    execute format('create policy plataforma_master on public.%I for all to authenticated using (public.app_is_master()) with check (public.app_is_master())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 3. Painel master sem empresas-modelo -----------------------------------------------------------------
create or replace function public.master_resumo_empresas(p_inicio date default date_trunc('month', current_date)::date,
                                                         p_fim date default current_date)
returns table (
  empresa_id uuid, nome text, slug text, status text, ativo boolean, cnpj text, criado_em timestamptz,
  admins jsonb, total_usuarios integer, faturamento numeric,
  plano text, valor_mensal numeric, situacao_mensalidade text, cobrancas_vencidas integer, valor_vencido numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query
  select e.id, e.nome, e.slug, e.status, e.ativo, e.cnpj, e.criado_em,
    coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'email', u.email) order by u.nome)
                from movelaria_usuarios u
               where u.empresa_id = e.id and u.perfil = 'administrador' and u.ativo
                 and not public.me_is_super_admin(u.id)), '[]'::jsonb),
    (select count(*)::int from "CRM-multi-empresas>usuario_empresa<" ue
      where ue.empresa_id = e.id and not public.me_is_super_admin(ue.user_id)),
    coalesce((select sum(cr.valor_parcela) from movelaria_contas_receber cr
               where cr.empresa_id = e.id and cr.status = 'recebido'
                 and cr.data_recebimento between p_inicio and p_fim), 0)::numeric,
    pl.nome, a.valor,
    case
      when a.id is null then 'sem_assinatura'
      when e.status = 'bloqueada' then 'bloqueada'
      when exists (select 1 from plataforma_cobrancas c where c.empresa_id = e.id and c.status = 'vencida') then 'vencida'
      else 'em_dia'
    end,
    (select count(*)::int from plataforma_cobrancas c where c.empresa_id = e.id and c.status = 'vencida'),
    coalesce((select sum(c.valor) from plataforma_cobrancas c where c.empresa_id = e.id and c.status = 'vencida'), 0)::numeric
  from "CRM-multi-empresas>empresas<" e
  left join plataforma_assinaturas a on a.empresa_id = e.id
  left join plataforma_planos pl on pl.id = a.plano_id
  where not e.e_modelo
  order by e.nome;
end $$;

create or replace function public.master_faturamento_mensal(p_meses integer default 12)
returns table (empresa_id uuid, empresa_nome text, mes date, faturamento numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query
  select e.id, e.nome, m.mes::date,
         coalesce((select sum(cr.valor_parcela) from movelaria_contas_receber cr
                    where cr.empresa_id = e.id and cr.status = 'recebido'
                      and date_trunc('month', cr.data_recebimento) = m.mes), 0)::numeric
    from "CRM-multi-empresas>empresas<" e
   cross join generate_series(date_trunc('month', current_date) - make_interval(months => greatest(p_meses, 1) - 1),
                              date_trunc('month', current_date), interval '1 month') as m(mes)
   where not e.e_modelo
   order by e.nome, m.mes;
end $$;

-- Lista do master sem as empresas-modelo (elas têm a lista própria em master_listar_empresas_modelo).
create or replace function public.master_listar_empresas()
returns table (id uuid, nome text, slug text, status text, logo_url text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query select e.id, e.nome, e.slug, e.status, e.logo_url
    from "CRM-multi-empresas>empresas<" e where not e.e_modelo order by e.nome;
end $$;

create or replace function public.master_listar_empresas_modelo()
returns table (id uuid, nome text, slug text, segmento text, status text, criado_em timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query select e.id, e.nome, e.slug, e.segmento, e.status, e.criado_em
    from "CRM-multi-empresas>empresas<" e where e.e_modelo order by e.segmento nulls last, e.nome;
end $$;
revoke all on function public.master_listar_empresas_modelo() from public, anon;
grant execute on function public.master_listar_empresas_modelo() to authenticated;
