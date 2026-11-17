-- M15 — Edge functions (service role) informam a empresa pelo header x-empresa-id.
-- O PostgREST chama app_pre_request() no início de cada requisição; SÓ para o role service_role o header
-- vira o contexto app.empresa_ctx, usado pelo trigger aaa_tenant_fill para preencher empresa_id.
-- anon/authenticated nunca conseguem definir a empresa por header.
create or replace function public.app_pre_request()
returns void language plpgsql set search_path = public, pg_temp as $$
declare v text;
begin
  if current_user <> 'service_role' then
    return;
  end if;
  v := nullif(current_setting('request.headers', true)::json ->> 'x-empresa-id', '');
  if v is not null and v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform set_config('app.empresa_ctx', v, true);
  end if;
end $$;
grant execute on function public.app_pre_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.app_pre_request';
notify pgrst, 'reload config';
