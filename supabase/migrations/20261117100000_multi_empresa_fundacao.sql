-- M02 — Fundação multi-empresa: status da empresa, master, resolvedor de empresa e role definer.
-- Ver docs/multi-empresa/DESIGN.md §1 e §1.1.

-- 1. Status da empresa (bloqueio por inadimplência) -------------------------------------------
alter table public."CRM-multi-empresas>empresas<"
  add column if not exists status text not null default 'ativa';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_status_check') then
    alter table public."CRM-multi-empresas>empresas<"
      add constraint empresas_status_check check (status in ('ativa', 'bloqueada', 'inativa'));
  end if;
end $$;

-- 2. Um usuário pertence a uma única empresa ---------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'usuario_empresa_user_unico') then
    alter table public."CRM-multi-empresas>usuario_empresa<"
      add constraint usuario_empresa_user_unico unique (user_id);
  end if;
end $$;

-- 3. Empresa ativa escolhida pelo master ------------------------------------------------------
create table if not exists public.plataforma_master_contexto (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  atualizado_em timestamptz not null default now()
);
alter table public.plataforma_master_contexto enable row level security;
drop policy if exists plataforma_master_contexto_master on public.plataforma_master_contexto;
create policy plataforma_master_contexto_master on public.plataforma_master_contexto
  for all to authenticated
  using (user_id = auth.uid() and public.me_is_super_admin(auth.uid()))
  with check (user_id = auth.uid() and public.me_is_super_admin(auth.uid()));

-- 4. Helpers ----------------------------------------------------------------------------------
create or replace function public.app_is_master()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and public.me_is_super_admin(auth.uid());
$$;

-- Empresa do usuário autenticado (definer: lê tabelas de plataforma sem depender de RLS).
create or replace function public.app__empresa_do_usuario(p_uid uuid)
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_emp uuid;
begin
  if p_uid is null then return null; end if;
  if exists (select 1 from "CRM-multi-empresas>super_admins<" where user_id = p_uid) then
    select empresa_id into v_emp from plataforma_master_contexto where user_id = p_uid;
    if v_emp is null then
      select empresa_id into v_emp from "CRM-multi-empresas>usuario_empresa<" where user_id = p_uid;
    end if;
    return v_emp;
  end if;
  select ue.empresa_id into v_emp
    from "CRM-multi-empresas>usuario_empresa<" ue
    join "CRM-multi-empresas>empresas<" e on e.id = ue.empresa_id
   where ue.user_id = p_uid and e.ativo and e.status = 'ativa';
  return v_emp;
end $$;
revoke all on function public.app__empresa_do_usuario(uuid) from public, anon, authenticated;

-- Resolvedor central. INVOKER de propósito: current_user aqui é o role de quem consulta
-- (anon/authenticated/app_tenant_definer/postgres/service_role), o que decide se o GUC vale.
create or replace function public.app_empresa_atual()
returns uuid language plpgsql stable set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_ctx text;
begin
  if v_uid is not null then
    return public.app__empresa_do_usuario(v_uid);
  end if;
  if current_user in ('anon', 'authenticated') then
    return null;
  end if;
  v_ctx := nullif(current_setting('app.empresa_ctx', true), '');
  return v_ctx::uuid;
end $$;
grant execute on function public.app_empresa_atual() to public, anon, authenticated, service_role;

-- Define a empresa do contexto transacional (cron, service role, funções públicas por slug).
create or replace function public.app_set_empresa_ctx(p_empresa_id uuid)
returns void language plpgsql volatile set search_path = public, pg_temp as $$
begin
  perform set_config('app.empresa_ctx', coalesce(p_empresa_id::text, ''), true);
end $$;
revoke all on function public.app_set_empresa_ctx(uuid) from public, anon, authenticated;

create or replace function public.app_minha_empresa()
returns table (id uuid, nome text, slug text, status text, ativo boolean, logo_url text,
               cor_primaria text, cnpj text, razao_social text, is_master boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.nome, e.slug, e.status, e.ativo, e.logo_url, e.cor_primaria, e.cnpj, e.razao_social,
         public.app_is_master()
    from "CRM-multi-empresas>empresas<" e
   where e.id = coalesce(
     public.app__empresa_do_usuario(auth.uid()),
     -- usuário de empresa bloqueada: ainda devolve a empresa (para a tela de acesso suspenso)
     (select ue.empresa_id from "CRM-multi-empresas>usuario_empresa<" ue where ue.user_id = auth.uid())
   );
$$;
revoke all on function public.app_minha_empresa() from public, anon;
grant execute on function public.app_minha_empresa() to authenticated;

create or replace function public.master_definir_empresa_ativa(p_empresa_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Apenas o usuário master pode trocar de empresa' using errcode = '42501';
  end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa_id) then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;
  insert into plataforma_master_contexto (user_id, empresa_id) values (auth.uid(), p_empresa_id)
  on conflict (user_id) do update set empresa_id = excluded.empresa_id, atualizado_em = now();
end $$;
revoke all on function public.master_definir_empresa_ativa(uuid) from public, anon;
grant execute on function public.master_definir_empresa_ativa(uuid) to authenticated;

-- 5. Role dono das funções SECURITY DEFINER "comuns" (sem BYPASSRLS) --------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_tenant_definer') then
    create role app_tenant_definer nologin nobypassrls;
  end if;
end $$;
grant app_tenant_definer to postgres;
grant usage on schema public to app_tenant_definer;
grant all on all tables in schema public to app_tenant_definer;
grant all on all sequences in schema public to app_tenant_definer;
grant execute on all functions in schema public to app_tenant_definer;
alter default privileges in schema public grant all on tables to app_tenant_definer;
alter default privileges in schema public grant all on sequences to app_tenant_definer;
alter default privileges in schema public grant execute on functions to app_tenant_definer;
grant usage on schema auth to app_tenant_definer;
grant execute on function auth.uid() to app_tenant_definer;
grant execute on function auth.jwt() to app_tenant_definer;
grant execute on function auth.role() to app_tenant_definer;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'emp_garbo') then
    execute 'grant usage on schema emp_garbo to app_tenant_definer';
    execute 'grant all on all tables in schema emp_garbo to app_tenant_definer';
    execute 'grant all on all sequences in schema emp_garbo to app_tenant_definer';
    execute 'grant execute on all functions in schema emp_garbo to app_tenant_definer';
  end if;
end $$;
