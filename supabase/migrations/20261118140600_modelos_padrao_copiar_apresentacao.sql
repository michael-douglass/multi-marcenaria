-- Modelos padrão (T17) — cópia da apresentação para arquitetos e do Pontua; catálogo com os 5 tipos.
-- Ver docs/modelos-padrao/DESIGN.md §3.2 e §4. Só acrescenta: quem já tem conteúdo próprio não muda.

create or replace function public.plataforma_copiar_apresentacao(p_origem uuid, p_destino uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_conteudo jsonb; v_n int := 0;
begin
  perform public.plataforma__validar_copia(p_origem, p_destino);
  perform public.app_set_empresa_ctx(p_destino);
  select conteudo into v_conteudo from crm.apresentacao_conteudo where empresa_id = p_origem;
  if coalesce(v_conteudo, '{}'::jsonb) = '{}'::jsonb then
    return jsonb_build_object('copiado', false, 'motivo', 'origem sem conteúdo');
  end if;
  insert into crm.apresentacao_conteudo (empresa_id, conteudo) values (p_destino, v_conteudo)
  on conflict (empresa_id) do update set conteudo = excluded.conteudo, atualizado_em = now()
   where crm.apresentacao_conteudo.conteudo = '{}'::jsonb;
  get diagnostics v_n = row_count;
  return jsonb_build_object('copiado', v_n > 0);
end $$;
revoke all on function public.plataforma_copiar_apresentacao(uuid, uuid) from public, anon, authenticated;

-- Pontua: texto/demonstração (se o destino não tiver) + percentual padrão do programa (campo de
-- sistema dos leads; par no front: ensurePontuaGarboCampoDefinitivo em useLeadCustomFields.ts).
create or replace function public.plataforma_copiar_pontua(p_origem uuid, p_destino uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_pontua jsonb; v_n int := 0; v_pct numeric; v_campo uuid; v_pct_ok boolean := false;
begin
  perform public.plataforma__validar_copia(p_origem, p_destino);
  perform public.app_set_empresa_ctx(p_destino);

  select pontua into v_pontua from crm.apresentacao_conteudo where empresa_id = p_origem;
  if coalesce(v_pontua, '{}'::jsonb) <> '{}'::jsonb then
    insert into crm.apresentacao_conteudo (empresa_id, pontua) values (p_destino, v_pontua)
    on conflict (empresa_id) do update set pontua = excluded.pontua, atualizado_em = now()
     where crm.apresentacao_conteudo.pontua = '{}'::jsonb;
    get diagnostics v_n = row_count;
  end if;

  select coalesce((config_pontua_garbo->>'percentual_padrao')::numeric, (config_pontua_garbo->>'percentual')::numeric)
    into v_pct
    from crm.lead_custom_field_definitions
   where empresa_id = p_origem and tipo = 'usuario_sistema' and config_pontua_garbo is not null
   order by ativo desc limit 1;
  if v_pct is not null then
    select id into v_campo from crm.lead_custom_field_definitions
     where empresa_id = p_destino and tipo = 'usuario_sistema' and config_pontua_garbo is not null
     order by ativo desc limit 1;
    if v_campo is null then
      insert into crm.lead_custom_field_definitions (empresa_id, nome, tipo, opcoes, ordem, ativo, config_pontua_garbo)
      values (p_destino, 'Pontua Garbo', 'usuario_sistema', null,
              coalesce((select max(ordem) + 1 from crm.lead_custom_field_definitions where empresa_id = p_destino), 0),
              true, jsonb_build_object('ativo', true, 'percentual_padrao', v_pct));
      v_pct_ok := true;
    end if;
    -- campo já existente: a empresa pode ter ajustado o percentual — não sobrescreve.
  end if;

  return jsonb_build_object('copiado', v_n > 0, 'percentual_padrao', case when v_pct_ok then v_pct end);
end $$;
revoke all on function public.plataforma_copiar_pontua(uuid, uuid) from public, anon, authenticated;

-- Catálogo: apresentação e Pontua também são pacotes da empresa-modelo.
create or replace function public.plataforma_sincronizar_modelos(p_empresa_modelo uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  insert into plataforma_modelos (tipo, empresa_modelo_id, nome)
  select t.tipo, p_empresa_modelo, t.nome
    from (values ('markup', 'Markup (custo)'), ('slides', 'Slides de orçamento'),
                 ('apresentacao', 'Apresentação para arquitetos'), ('pontua', 'Pontua (programa de pontos)')) as t(tipo, nome)
  on conflict do nothing;

  insert into plataforma_modelos (tipo, empresa_modelo_id, ref_id, nome)
  select 'contrato', p_empresa_modelo, c.id, c.nome
    from crm.contratos_modelos c where c.empresa_id = p_empresa_modelo
  on conflict do nothing;

  update plataforma_modelos pm set nome = c.nome, atualizado_em = now()
    from crm.contratos_modelos c
   where pm.tipo = 'contrato' and pm.empresa_modelo_id = p_empresa_modelo and c.id = pm.ref_id and pm.nome <> c.nome;

  delete from plataforma_modelos pm
   where pm.tipo = 'contrato' and pm.empresa_modelo_id = p_empresa_modelo
     and not exists (select 1 from crm.contratos_modelos c where c.id = pm.ref_id)
     and not exists (select 1 from plataforma_modelo_entregas e where e.modelo_id = pm.id);
  update plataforma_modelos pm set publicado = false, atualizado_em = now()
   where pm.tipo = 'contrato' and pm.empresa_modelo_id = p_empresa_modelo and pm.publicado
     and not exists (select 1 from crm.contratos_modelos c where c.id = pm.ref_id);
end $$;
revoke all on function public.plataforma_sincronizar_modelos(uuid) from public, anon, authenticated;

-- Contagem dos novos tipos no catálogo (configurado = já tem conteúdo próprio).
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
           when 'pontua' then jsonb_build_object('configurado', exists (
             select 1 from crm.apresentacao_conteudo a where a.empresa_id = m.empresa_modelo_id and a.pontua <> '{}'::jsonb))
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

-- Empresa-modelo importa também apresentação e Pontua.
create or replace function public.master_criar_empresa_modelo(p_nome text, p_slug text, p_segmento text default null,
                                                              p_importar_de uuid default null)
returns uuid language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_slug text := lower(trim(p_slug)); c record;
begin
  perform public.app_assert_master();
  if coalesce(trim(p_nome), '') = '' then raise exception 'Nome da empresa-modelo é obrigatório'; end if;
  if v_slug !~ '^[a-z0-9_]+$' then raise exception 'Slug inválido: use letras minúsculas, números e _'; end if;
  if exists (select 1 from "CRM-multi-empresas>empresas<" where slug = v_slug) then
    raise exception 'Já existe uma empresa com o slug "%"', v_slug;
  end if;
  if p_importar_de is not null and not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_importar_de) then
    raise exception 'Empresa de origem não encontrada';
  end if;

  insert into "CRM-multi-empresas>empresas<" (nome, slug, schema_nome, ativo, status, e_modelo, segmento)
  values (trim(p_nome), v_slug, 'crm', true, 'ativa', true, nullif(trim(p_segmento), ''))
  returning id into v_id;

  if p_importar_de is not null then
    perform public.plataforma_copiar_markup(p_importar_de, v_id);
    perform public.plataforma_copiar_slides(p_importar_de, v_id);
    for c in select id from crm.contratos_modelos where empresa_id = p_importar_de order by ativo desc, updated_at loop
      perform public.plataforma_copiar_contrato(c.id, v_id);
    end loop;
    perform public.plataforma_copiar_apresentacao(p_importar_de, v_id);
    perform public.plataforma_copiar_pontua(p_importar_de, v_id);
  end if;

  perform public.plataforma_seed_empresa(v_id);
  perform public.plataforma_sincronizar_modelos(v_id);
  return v_id;
end $$;
