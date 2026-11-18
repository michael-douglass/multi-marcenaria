-- M43 — Console master isolado e inspeção com modo (somente leitura | acesso total), aplicada no banco.
--
-- * O master só tem empresa ativa quando está "inspecionando" (linha em plataforma_master_contexto).
--   Sem inspeção, app_empresa_atual() devolve NULL para ele (o console não depende de empresa).
-- * Em modo leitura, a policy RESTRICTIVE tenant_master_leitura recusa insert/update/delete em toda
--   tabela de tenant e no storage; funções do postgres (BYPASSRLS) que gravam ganham guarda explícita.
-- * Cada entrada fica registrada em plataforma_master_acessos.

-- 1. Modo de inspeção e registro de acessos -----------------------------------------------------
alter table public.plataforma_master_contexto
  add column if not exists somente_leitura boolean not null default true;

create table if not exists public.plataforma_master_acessos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  somente_leitura boolean not null,
  inicio timestamptz not null default now(),
  fim timestamptz
);
create index if not exists plataforma_master_acessos_empresa_idx on public.plataforma_master_acessos (empresa_id, inicio desc);
alter table public.plataforma_master_acessos enable row level security;
drop policy if exists plataforma_master on public.plataforma_master_acessos;
create policy plataforma_master on public.plataforma_master_acessos
  for all to authenticated using (public.app_is_master()) with check (public.app_is_master());
revoke all on public.plataforma_master_acessos from anon;

-- 2. Master sem inspeção não tem empresa (antes caía no próprio vínculo em usuario_empresa) ------
create or replace function public.app__empresa_do_usuario(p_uid uuid)
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_emp uuid;
begin
  if p_uid is null then return null; end if;
  if exists (select 1 from "CRM-multi-empresas>super_admins<" where user_id = p_uid) then
    select empresa_id into v_emp from plataforma_master_contexto where user_id = p_uid;
    return v_emp;
  end if;
  select ue.empresa_id into v_emp
    from "CRM-multi-empresas>usuario_empresa<" ue
    join "CRM-multi-empresas>empresas<" e on e.id = ue.empresa_id
   where ue.user_id = p_uid and e.ativo and e.status = 'ativa';
  return v_emp;
end $$;
revoke all on function public.app__empresa_do_usuario(uuid) from public, anon, authenticated;

-- 3. Somente leitura ---------------------------------------------------------------------------
create or replace function public.app_master_somente_leitura()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null
     and exists (select 1 from plataforma_master_contexto c
                  where c.user_id = auth.uid() and c.somente_leitura)
     and public.me_is_super_admin(auth.uid());
$$;
grant execute on function public.app_master_somente_leitura() to public, anon, authenticated, service_role, app_tenant_definer;

create or replace function public.app_assert_escrita_permitida()
returns void language plpgsql stable set search_path = public, pg_temp as $$
begin
  if public.app_master_somente_leitura() then
    raise exception 'Modo somente leitura: alterações estão bloqueadas durante a inspeção do master'
      using errcode = '42501';
  end if;
end $$;
grant execute on function public.app_assert_escrita_permitida() to public, anon, authenticated, service_role, app_tenant_definer;

-- 4. Entrar / sair da empresa ------------------------------------------------------------------
drop function if exists public.master_definir_empresa_ativa(uuid);
create or replace function public.master_definir_empresa_ativa(p_empresa_id uuid, p_somente_leitura boolean default true)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Apenas o usuário master pode entrar em uma empresa' using errcode = '42501';
  end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa_id) then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;
  update plataforma_master_acessos set fim = now() where user_id = auth.uid() and fim is null;
  insert into plataforma_master_contexto (user_id, empresa_id, somente_leitura)
  values (auth.uid(), p_empresa_id, coalesce(p_somente_leitura, true))
  on conflict (user_id) do update
    set empresa_id = excluded.empresa_id, somente_leitura = excluded.somente_leitura, atualizado_em = now();
  insert into plataforma_master_acessos (user_id, empresa_id, somente_leitura)
  values (auth.uid(), p_empresa_id, coalesce(p_somente_leitura, true));
end $$;
revoke all on function public.master_definir_empresa_ativa(uuid, boolean) from public, anon;
grant execute on function public.master_definir_empresa_ativa(uuid, boolean) to authenticated;

create or replace function public.master_sair_empresa()
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Apenas o usuário master' using errcode = '42501';
  end if;
  update plataforma_master_acessos set fim = now() where user_id = auth.uid() and fim is null;
  delete from plataforma_master_contexto where user_id = auth.uid();
end $$;
revoke all on function public.master_sair_empresa() from public, anon;
grant execute on function public.master_sair_empresa() to authenticated;

create or replace function public.master_listar_acessos(p_empresa uuid default null, p_limite integer default 200)
returns table (id uuid, empresa_id uuid, empresa_nome text, usuario_email text, somente_leitura boolean,
               inicio timestamptz, fim timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Apenas o usuário master' using errcode = '42501';
  end if;
  return query
  select a.id, a.empresa_id, e.nome::text, u.email::text, a.somente_leitura, a.inicio, a.fim
    from plataforma_master_acessos a
    join "CRM-multi-empresas>empresas<" e on e.id = a.empresa_id
    left join auth.users u on u.id = a.user_id
   where p_empresa is null or a.empresa_id = p_empresa
   order by a.inicio desc
   limit greatest(1, least(coalesce(p_limite, 200), 1000));
end $$;
revoke all on function public.master_listar_acessos(uuid, integer) from public, anon;
grant execute on function public.master_listar_acessos(uuid, integer) to authenticated;

-- 5. app_minha_empresa: + páginas bloqueadas e modo de inspeção -------------------------------
drop function if exists public.app_minha_empresa();
create function public.app_minha_empresa()
returns table (id uuid, nome text, slug text, status text, ativo boolean, logo_url text,
               cor_primaria text, cnpj text, razao_social text, is_master boolean,
               paginas_bloqueadas text[], em_inspecao boolean, inspecao_somente_leitura boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.nome, e.slug, e.status, e.ativo, e.logo_url, e.cor_primaria, e.cnpj, e.razao_social,
         public.app_is_master(),
         public.app_paginas_bloqueadas(e.id),
         c.user_id is not null,
         coalesce(c.somente_leitura, false)
    from "CRM-multi-empresas>empresas<" e
    left join plataforma_master_contexto c on c.user_id = auth.uid() and c.empresa_id = e.id
   where e.id = coalesce(
     public.app__empresa_do_usuario(auth.uid()),
     -- usuário de empresa bloqueada: ainda devolve a empresa (para a tela de acesso suspenso);
     -- o master sem inspeção não cai aqui (não tem vínculo usado como fallback)
     (select ue.empresa_id from "CRM-multi-empresas>usuario_empresa<" ue
       where ue.user_id = auth.uid() and not public.app_is_master())
   );
$$;
revoke all on function public.app_minha_empresa() from public, anon;
grant execute on function public.app_minha_empresa() to authenticated;

-- 6. Policies RESTRICTIVE de somente leitura em toda tabela de tenant ---------------------------
do $$
declare r record;
begin
  for r in
    select distinct schemaname, tablename from pg_policies where policyname = 'tenant_isolamento'
  loop
    execute format('drop policy if exists tenant_master_leitura_ins on %I.%I', r.schemaname, r.tablename);
    execute format('drop policy if exists tenant_master_leitura_upd on %I.%I', r.schemaname, r.tablename);
    execute format('drop policy if exists tenant_master_leitura_del on %I.%I', r.schemaname, r.tablename);
    execute format('create policy tenant_master_leitura_ins on %I.%I as restrictive for insert to public with check (not (select public.app_master_somente_leitura()))', r.schemaname, r.tablename);
    execute format('create policy tenant_master_leitura_upd on %I.%I as restrictive for update to public using (not (select public.app_master_somente_leitura()))', r.schemaname, r.tablename);
    execute format('create policy tenant_master_leitura_del on %I.%I as restrictive for delete to public using (not (select public.app_master_somente_leitura()))', r.schemaname, r.tablename);
  end loop;
end $$;

drop policy if exists tenant_master_leitura_ins on storage.objects;
drop policy if exists tenant_master_leitura_upd on storage.objects;
drop policy if exists tenant_master_leitura_del on storage.objects;
create policy tenant_master_leitura_ins on storage.objects as restrictive for insert to public
  with check (not (select public.app_master_somente_leitura()));
create policy tenant_master_leitura_upd on storage.objects as restrictive for update to public
  using (not (select public.app_master_somente_leitura()));
create policy tenant_master_leitura_del on storage.objects as restrictive for delete to public
  using (not (select public.app_master_somente_leitura()));

-- 7. Guarda nas funções do postgres (BYPASSRLS) que gravam dados da empresa --------------------
do $$
declare
  r record;
  v_def text;
  v_novo text;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('movelaria_atualizar_ficha_crm', 'movelaria_criar_usuario', 'movelaria_excluir_usuario',
                         'movelaria_redefinir_senha', 'movelaria_registrar_usuario_existente',
                         'me_vincular_usuario_empresa', 'app_vincular_usuario_empresa_atual',
                         'me_limpar_vinculos_auth_user')
  loop
    v_def := pg_get_functiondef(r.oid);
    if v_def like '%app_assert_escrita_permitida%' then continue; end if;
    -- primeiro BEGIN do corpo plpgsql
    v_novo := regexp_replace(v_def, '\mbegin\M', 'begin' || chr(10) || '  perform public.app_assert_escrita_permitida();', 'i');
    if v_novo = v_def then
      raise exception 'não achei o BEGIN de %', r.proname;
    end if;
    execute v_novo;
  end loop;
end $$;
