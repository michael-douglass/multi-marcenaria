-- M04 (base) — Triggers de preenchimento do tenant, acesso do role definer às tabelas globais
-- (o job de faltas por empresa fica na migration pós-núcleo).

-- Preenche empresa_id com a empresa do contexto e propaga para inserts em cascata.
-- INVOKER de propósito: app_empresa_atual() precisa enxergar o role de quem está inserindo.
create or replace function public.app_tenant_fill()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.empresa_id is null then
    new.empresa_id := public.app_empresa_atual();
  end if;
  if new.empresa_id is null then
    raise exception 'empresa_id não definido para %.% (sem empresa no contexto)', tg_table_schema, tg_table_name
      using errcode = '23502';
  end if;
  perform set_config('app.empresa_ctx', new.empresa_id::text, true);
  return new;
end $$;

create or replace function public.app_tenant_fill_company()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.company_id is null then
    new.company_id := public.app_empresa_atual();
  end if;
  if new.company_id is null then
    raise exception 'company_id não definido para %.% (sem empresa no contexto)', tg_table_schema, tg_table_name
      using errcode = '23502';
  end if;
  perform set_config('app.empresa_ctx', new.company_id::text, true);
  return new;
end $$;

-- O role definer lê/escreve tabelas globais com RLS (as policies de papel continuam valendo
-- para anon/authenticated).
do $$
declare t text;
begin
  foreach t in array array[
    'public."CRM-multi-empresas>empresas<"',
    'public."CRM-multi-empresas>usuario_empresa<"',
    'public."CRM-multi-empresas>super_admins<"',
    'public.user_roles',
    'public.market_reference_prices',
    'public.plataforma_master_contexto'
  ] loop
    if to_regclass(t) is not null then
      execute format('drop policy if exists tenant_definer on %s', t);
      execute format('create policy tenant_definer on %s for all to app_tenant_definer using (true) with check (true)', t);
    end if;
  end loop;
end $$;

grant usage on schema extensions to app_tenant_definer;
grant create on schema public to app_tenant_definer; -- exigido para ser dono de funções do schema

