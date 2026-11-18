-- Identidade da marcenaria: gravação dos dados da empresa por RPC (só admin da empresa atual).
-- Ver docs/identidade-empresa/DESIGN.md §2.1.
--
-- Por que RPC: todo UPDATE direto de `authenticated` na tabela de empresas falha com
-- "infinite recursion detected in policy" (a policy me_empresas_contratos_timbrado_update faz
-- join com a própria tabela) e me_empresas_admin_update_branding depende de
-- "CRM-multi-empresas>user_roles<", que está vazia. As policies antigas NÃO são alteradas aqui
-- (ficam para a TS01); a RPC é o caminho de escrita das telas de identidade.
--
-- Regras:
-- * Empresa = app_empresa_atual() (nunca vem do front).
-- * Quem pode: admin do CRM dessa empresa (crm.user_roles.role = 'admin' com o mesmo empresa_id)
--   ou o master em inspeção com acesso total. Master em somente leitura é recusado por
--   app_assert_escrita_permitida().
-- * Só as chaves presentes em p_dados e da whitelist são gravadas; string vazia vira NULL
--   (exceto `nome`, que é obrigatório e é mantido se vier vazio).

create or replace function public.empresa_atualizar_dados(p_dados jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_emp uuid := public.app_empresa_atual();
  v_cnpj text;
  v_uf text;
  v_chave text;
  c_permitidas constant text[] := array['nome', 'razao_social', 'cnpj', 'cep', 'logradouro', 'numero',
    'complemento', 'bairro', 'cidade', 'uf', 'telefone', 'email', 'logo_url', 'cor_primaria'];
begin
  perform public.app_assert_escrita_permitida();

  if auth.uid() is null or v_emp is null then
    raise exception 'Sem empresa ativa' using errcode = '42501';
  end if;

  if not (
    exists (select 1 from crm.user_roles r
             where r.user_id = auth.uid() and r.empresa_id = v_emp and r.role = 'admin')
    or (public.app_is_master()
        and exists (select 1 from plataforma_master_contexto c
                     where c.user_id = auth.uid() and c.empresa_id = v_emp and not c.somente_leitura))
  ) then
    raise exception 'Apenas o administrador da empresa pode alterar os dados da empresa' using errcode = '42501';
  end if;

  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;

  for v_chave in select jsonb_object_keys(p_dados) loop
    if not v_chave = any (c_permitidas) then
      raise exception 'Campo não permitido: %', v_chave using errcode = '22023';
    end if;
  end loop;

  if p_dados ? 'cnpj' then
    v_cnpj := nullif(regexp_replace(coalesce(p_dados ->> 'cnpj', ''), '\D', '', 'g'), '');
    if v_cnpj is not null and length(v_cnpj) <> 14 then
      raise exception 'CNPJ deve ter 14 dígitos' using errcode = '22023';
    end if;
  end if;

  if p_dados ? 'uf' then
    v_uf := nullif(upper(trim(coalesce(p_dados ->> 'uf', ''))), '');
    if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
      raise exception 'UF inválida' using errcode = '22023';
    end if;
  end if;

  update "CRM-multi-empresas>empresas<" e set
    nome         = case when p_dados ? 'nome' then coalesce(nullif(trim(p_dados ->> 'nome'), ''), e.nome) else e.nome end,
    razao_social = case when p_dados ? 'razao_social' then nullif(trim(p_dados ->> 'razao_social'), '') else e.razao_social end,
    cnpj         = case when p_dados ? 'cnpj' then v_cnpj else e.cnpj end,
    cep          = case when p_dados ? 'cep' then nullif(regexp_replace(coalesce(p_dados ->> 'cep', ''), '\D', '', 'g'), '') else e.cep end,
    logradouro   = case when p_dados ? 'logradouro' then nullif(trim(p_dados ->> 'logradouro'), '') else e.logradouro end,
    numero       = case when p_dados ? 'numero' then nullif(trim(p_dados ->> 'numero'), '') else e.numero end,
    complemento  = case when p_dados ? 'complemento' then nullif(trim(p_dados ->> 'complemento'), '') else e.complemento end,
    bairro       = case when p_dados ? 'bairro' then nullif(trim(p_dados ->> 'bairro'), '') else e.bairro end,
    cidade       = case when p_dados ? 'cidade' then nullif(trim(p_dados ->> 'cidade'), '') else e.cidade end,
    uf           = case when p_dados ? 'uf' then v_uf else e.uf end,
    telefone     = case when p_dados ? 'telefone' then nullif(trim(p_dados ->> 'telefone'), '') else e.telefone end,
    email        = case when p_dados ? 'email' then nullif(lower(trim(p_dados ->> 'email')), '') else e.email end,
    logo_url     = case when p_dados ? 'logo_url' then nullif(trim(p_dados ->> 'logo_url'), '') else e.logo_url end,
    cor_primaria = case when p_dados ? 'cor_primaria' then nullif(trim(p_dados ->> 'cor_primaria'), '') else e.cor_primaria end,
    atualizado_em = now()
  where e.id = v_emp;
end $$;

revoke all on function public.empresa_atualizar_dados(jsonb) from public, anon;
grant execute on function public.empresa_atualizar_dados(jsonb) to authenticated;
