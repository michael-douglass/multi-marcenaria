-- M24 (ajuste) — em master_atualizar_empresa, CNPJ/razão social vazios mantêm o valor atual.
create or replace function public.master_atualizar_empresa(
  p_empresa_id uuid, p_nome text, p_cnpj text default null, p_razao_social text default null, p_cor_primaria text default null)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  update "CRM-multi-empresas>empresas<"
     set nome = coalesce(nullif(trim(p_nome), ''), nome),
         cnpj = coalesce(nullif(trim(p_cnpj), ''), cnpj),
         razao_social = coalesce(nullif(trim(p_razao_social), ''), razao_social),
         cor_primaria = coalesce(nullif(trim(p_cor_primaria), ''), cor_primaria),
         atualizado_em = now()
   where id = p_empresa_id;
  if not found then raise exception 'Empresa não encontrada'; end if;
end $$;
