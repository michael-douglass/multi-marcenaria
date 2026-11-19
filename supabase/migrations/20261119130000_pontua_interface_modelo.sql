-- Interface da página Pontua definida pelo master por empresa-modelo (/master/modelos).
-- A escolha fica em `crm.apresentacao_conteudo.pontua->>'interface'` ('sem_marca' | 'classica'), sem coluna nova:
-- o front já mescla o jsonb salvo sobre o padrão (sem_marca) e a página pública lê o mesmo objeto.

-- 1) Master define a interface do pacote Pontua de uma empresa-modelo.
create or replace function public.master_definir_pontua_interface(p_empresa_modelo uuid, p_interface text)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_interface text := lower(trim(coalesce(p_interface, '')));
begin
  perform public.app_assert_master();
  if v_interface not in ('sem_marca', 'classica') then
    raise exception 'Interface inválida: use sem_marca ou classica' using errcode = '22023';
  end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa_modelo and e_modelo) then
    raise exception 'A interface é definida em uma empresa-modelo' using errcode = '22023';
  end if;

  perform public.app_set_empresa_ctx(p_empresa_modelo);
  insert into crm.apresentacao_conteudo (empresa_id, pontua)
  values (p_empresa_modelo, jsonb_build_object('interface', v_interface))
  on conflict (empresa_id) do update
     set pontua = coalesce(crm.apresentacao_conteudo.pontua, '{}'::jsonb) || jsonb_build_object('interface', v_interface),
         atualizado_em = now();

  -- Nova versão do pacote: quem já recebeu continua com a cópia que tem (o modelo só acrescenta).
  update plataforma_modelos set versao = versao + 1, atualizado_em = now()
   where tipo = 'pontua' and empresa_modelo_id = p_empresa_modelo;

  return jsonb_build_object('interface', v_interface);
end $$;
revoke all on function public.master_definir_pontua_interface(uuid, text) from public, anon;
grant execute on function public.master_definir_pontua_interface(uuid, text) to authenticated;

-- 2) Cópia do pacote Pontua (versão de 20261119110000) agora também leva a interface.
--    - A chave `interface` sozinha não conta como "conteúdo": o texto ainda é copiado para destino que só a tem.
--    - Destino que já tem conteúdo próprio sem `interface` recebe só a chave (nunca sobrescreve o texto).
create or replace function public.plataforma_copiar_pontua(p_origem uuid, p_destino uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_pontua jsonb; v_n int := 0; v_pct numeric; v_campo uuid; v_pct_ok boolean := false; v_ban int := 0; v_if int := 0;
begin
  perform public.plataforma__validar_copia(p_origem, p_destino);
  perform public.app_set_empresa_ctx(p_destino);

  select pontua into v_pontua from crm.apresentacao_conteudo where empresa_id = p_origem;
  if coalesce(v_pontua, '{}'::jsonb) <> '{}'::jsonb then
    insert into crm.apresentacao_conteudo (empresa_id, pontua) values (p_destino, v_pontua)
    on conflict (empresa_id) do update set pontua = excluded.pontua, atualizado_em = now()
     where (crm.apresentacao_conteudo.pontua - 'interface') = '{}'::jsonb;
    get diagnostics v_n = row_count;

    if v_n = 0 and v_pontua ? 'interface' then
      update crm.apresentacao_conteudo
         set pontua = jsonb_set(pontua, '{interface}', v_pontua->'interface'), atualizado_em = now()
       where empresa_id = p_destino and not (pontua ? 'interface');
      get diagnostics v_if = row_count;
    end if;
  end if;

  select coalesce((config_pontua->>'percentual_padrao')::numeric, (config_pontua->>'percentual')::numeric)
    into v_pct
    from crm.lead_custom_field_definitions
   where empresa_id = p_origem and tipo = 'usuario_sistema' and config_pontua is not null
   order by ativo desc limit 1;
  if v_pct is not null then
    select id into v_campo from crm.lead_custom_field_definitions
     where empresa_id = p_destino and tipo = 'usuario_sistema' and config_pontua is not null
     order by ativo desc limit 1;
    if v_campo is null then
      insert into crm.lead_custom_field_definitions (empresa_id, nome, tipo, opcoes, ordem, ativo, config_pontua)
      values (p_destino, 'Pontua', 'usuario_sistema', null,
              coalesce((select max(ordem) + 1 from crm.lead_custom_field_definitions where empresa_id = p_destino), 0),
              true, jsonb_build_object('ativo', true, 'percentual_padrao', v_pct));
      v_pct_ok := true;
    end if;
  end if;

  -- Banners do portal do parceiro: arquivos ficam no storage do modelo (URLs públicas compartilhadas).
  update "CRM-multi-empresas>empresas<" d
     set banner_slides_desktop = case when coalesce(jsonb_array_length(d.banner_slides_desktop), 0) = 0
                                      then o.banner_slides_desktop else d.banner_slides_desktop end,
         banner_slides_mobile = case when coalesce(jsonb_array_length(d.banner_slides_mobile), 0) = 0
                                     then o.banner_slides_mobile else d.banner_slides_mobile end,
         atualizado_em = now()
    from "CRM-multi-empresas>empresas<" o
   where o.id = p_origem and d.id = p_destino
     and ((coalesce(jsonb_array_length(d.banner_slides_desktop), 0) = 0 and coalesce(jsonb_array_length(o.banner_slides_desktop), 0) > 0)
       or (coalesce(jsonb_array_length(d.banner_slides_mobile), 0) = 0 and coalesce(jsonb_array_length(o.banner_slides_mobile), 0) > 0));
  get diagnostics v_ban = row_count;

  return jsonb_build_object('copiado', v_n > 0, 'interface', v_if > 0, 'percentual_padrao', case when v_pct_ok then v_pct end,
                            'banners', v_ban > 0);
end $$;
revoke all on function public.plataforma_copiar_pontua(uuid, uuid) from public, anon, authenticated;

-- 3) Catálogo: o tipo pontua expõe a interface atual. `configurado` ignora a chave `interface`.
create or replace function public.master_listar_modelos(p_empresa_modelo uuid default null)
returns table (id uuid, tipo text, empresa_modelo_id uuid, empresa_modelo_nome text, segmento text, ref_id uuid,
               nome text, descricao text, publicado boolean, versao integer, atualizado_em timestamptz,
               contagem jsonb, entregas integer, planos uuid[])
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare e record;
begin
  perform public.app_assert_master();
  for e in select x.id from "CRM-multi-empresas>empresas<" x
            where x.e_modelo and (p_empresa_modelo is null or x.id = p_empresa_modelo) loop
    perform public.plataforma_sincronizar_modelos(e.id);
  end loop;

  return query
  select m.id, m.tipo, m.empresa_modelo_id, em.nome, em.segmento, m.ref_id, m.nome, m.descricao, m.publicado, m.versao,
         m.atualizado_em,
         case m.tipo
           when 'markup' then jsonb_build_object(
             'categorias', (select count(*) from crm.markup_categorias x where x.empresa_id = m.empresa_modelo_id),
             'produtos', (select count(*) from crm.markup_produtos x where x.empresa_id = m.empresa_modelo_id),
             'servicos', (select count(*) from crm.markup_servico_templates x where x.empresa_id = m.empresa_modelo_id),
             'despesas', (select count(*) from crm.markup_despesa_templates x where x.empresa_id = m.empresa_modelo_id))
           when 'slides' then jsonb_build_object(
             'blocos', (select count(*) from crm.orcamento_slide_blocos x where x.empresa_id = m.empresa_modelo_id),
             'perguntas', (select count(*) from crm.orcamento_slide_perguntas x where x.empresa_id = m.empresa_modelo_id),
             'formas_pagamento', (select count(*) from crm.orcamento_slide_formas_pagamento x where x.empresa_id = m.empresa_modelo_id))
           when 'contrato' then jsonb_build_object(
             'caracteres', (select length(coalesce(c.conteudo, '')) from crm.contratos_modelos c where c.id = m.ref_id),
             'ativo_no_modelo', (select c.ativo from crm.contratos_modelos c where c.id = m.ref_id))
           when 'apresentacao' then jsonb_build_object('configurado', exists (
             select 1 from crm.apresentacao_conteudo a where a.empresa_id = m.empresa_modelo_id and a.conteudo <> '{}'::jsonb))
           when 'pontua' then jsonb_build_object(
             'configurado', exists (
               select 1 from crm.apresentacao_conteudo a
                where a.empresa_id = m.empresa_modelo_id and (a.pontua - 'interface') <> '{}'::jsonb),
             'interface', coalesce((select case when a.pontua->>'interface' = 'classica' then 'classica' else 'sem_marca' end
                                      from crm.apresentacao_conteudo a where a.empresa_id = m.empresa_modelo_id), 'sem_marca'))
           else '{}'::jsonb
         end,
         (select count(*)::int from plataforma_modelo_entregas en where en.modelo_id = m.id),
         coalesce((select array_agg(pm.plano_id) from plataforma_plano_modelos pm where pm.modelo_id = m.id), '{}'::uuid[])
    from plataforma_modelos m
    join "CRM-multi-empresas>empresas<" em on em.id = m.empresa_modelo_id
   where p_empresa_modelo is null or m.empresa_modelo_id = p_empresa_modelo
   order by em.nome, case m.tipo when 'markup' then 1 when 'slides' then 2 when 'contrato' then 3
                                 when 'apresentacao' then 4 else 5 end, m.nome;
end $$;
