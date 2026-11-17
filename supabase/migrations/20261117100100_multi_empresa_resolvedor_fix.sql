-- M02 (ajuste) — o resolvedor é INVOKER e precisa chamar o helper definer.
-- Versão sem parâmetro (usa auth.uid() internamente), para poder ser liberada a authenticated
-- sem permitir descobrir a empresa de outro usuário.

create or replace function public.app__minha_empresa_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select public.app__empresa_do_usuario(auth.uid());
$$;
revoke all on function public.app__minha_empresa_id() from public, anon;
grant execute on function public.app__minha_empresa_id() to authenticated, app_tenant_definer;

create or replace function public.app_empresa_atual()
returns uuid language plpgsql stable set search_path = public, pg_temp as $$
declare v_ctx text;
begin
  if auth.uid() is not null then
    return public.app__minha_empresa_id();
  end if;
  if current_user in ('anon', 'authenticated') then
    return null;
  end if;
  v_ctx := nullif(current_setting('app.empresa_ctx', true), '');
  return v_ctx::uuid;
end $$;
