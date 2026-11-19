-- Modelos padrão (T08) — aplicar modelo, entregas, empresa-modelo, publicação, planos e envio.
-- Ver docs/modelos-padrao/DESIGN.md §3.3.

-- 1. Aplicar um modelo do catálogo numa empresa (interna) -------------------------------------------
create or replace function public.plataforma_aplicar_modelo(p_modelo uuid, p_empresa uuid, p_por uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare m plataforma_modelos%rowtype; v_res jsonb;
begin
  select * into m from plataforma_modelos where id = p_modelo;
  if not found then raise exception 'Modelo não encontrado'; end if;
  if exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa and e_modelo) then
    raise exception 'Modelos não são enviados para empresas-modelo';
  end if;
  if p_empresa = m.empresa_modelo_id then raise exception 'Destino é a própria empresa-modelo'; end if;

  case m.tipo
    when 'markup' then v_res := public.plataforma_copiar_markup(m.empresa_modelo_id, p_empresa);
    when 'slides' then v_res := public.plataforma_copiar_slides(m.empresa_modelo_id, p_empresa);
    when 'contrato' then
      if not exists (select 1 from crm.contratos_modelos where id = m.ref_id and empresa_id = m.empresa_modelo_id) then
        raise exception 'O contrato "%" não existe mais na empresa-modelo', m.nome;
      end if;
      v_res := public.plataforma_copiar_contrato(m.ref_id, p_empresa);
    when 'apresentacao' then
      execute 'select public.plataforma_copiar_apresentacao($1, $2)' into v_res using m.empresa_modelo_id, p_empresa;
    when 'pontua' then
      execute 'select public.plataforma_copiar_pontua($1, $2)' into v_res using m.empresa_modelo_id, p_empresa;
  end case;

  insert into plataforma_modelo_entregas (modelo_id, empresa_id, versao, entregue_por, resumo)
  values (m.id, p_empresa, m.versao, p_por, coalesce(v_res, '{}'::jsonb));
  return coalesce(v_res, '{}'::jsonb);
end $$;
revoke all on function public.plataforma_aplicar_modelo(uuid, uuid, uuid) from public, anon, authenticated;

-- 2. Catálogo em dia com o que a empresa-modelo tem --------------------------------------------------
create or replace function public.plataforma_sincronizar_modelos(p_empresa_modelo uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  insert into plataforma_modelos (tipo, empresa_modelo_id, nome)
  select t.tipo, p_empresa_modelo, t.nome
    from (values ('markup', 'Markup (custo)'), ('slides', 'Slides de orçamento')) as t(tipo, nome)
  on conflict do nothing;

  insert into plataforma_modelos (tipo, empresa_modelo_id, ref_id, nome)
  select 'contrato', p_empresa_modelo, c.id, c.nome
    from crm.contratos_modelos c where c.empresa_id = p_empresa_modelo
  on conflict do nothing;

  update plataforma_modelos pm set nome = c.nome, atualizado_em = now()
    from crm.contratos_modelos c
   where pm.tipo = 'contrato' and pm.empresa_modelo_id = p_empresa_modelo and c.id = pm.ref_id and pm.nome <> c.nome;

  -- Contrato apagado na empresa-modelo: some do catálogo se nunca foi entregue; senão só despublica.
  delete from plataforma_modelos pm
   where pm.tipo = 'contrato' and pm.empresa_modelo_id = p_empresa_modelo
     and not exists (select 1 from crm.contratos_modelos c where c.id = pm.ref_id)
     and not exists (select 1 from plataforma_modelo_entregas e where e.modelo_id = pm.id);
  update plataforma_modelos pm set publicado = false, atualizado_em = now()
   where pm.tipo = 'contrato' and pm.empresa_modelo_id = p_empresa_modelo and pm.publicado
     and not exists (select 1 from crm.contratos_modelos c where c.id = pm.ref_id);
end $$;
revoke all on function public.plataforma_sincronizar_modelos(uuid) from public, anon, authenticated;

-- 3. RPCs do master ------------------------------------------------------------------------------------
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
    -- o ativo da origem primeiro, para continuar sendo o ativo
    for c in select id from crm.contratos_modelos where empresa_id = p_importar_de order by ativo desc, updated_at loop
      perform public.plataforma_copiar_contrato(c.id, v_id);
    end loop;
  end if;

  perform public.plataforma_seed_empresa(v_id); -- contrato padrão só entra se nada foi importado
  perform public.plataforma_sincronizar_modelos(v_id);
  return v_id;
end $$;
revoke all on function public.master_criar_empresa_modelo(text, text, text, uuid) from public, anon;
grant execute on function public.master_criar_empresa_modelo(text, text, text, uuid) to authenticated;

create or replace function public.master_atualizar_empresa_modelo(p_empresa uuid, p_nome text, p_segmento text)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  update "CRM-multi-empresas>empresas<"
     set nome = coalesce(nullif(trim(p_nome), ''), nome), segmento = nullif(trim(p_segmento), '')
   where id = p_empresa and e_modelo;
  if not found then raise exception 'Empresa-modelo não encontrada'; end if;
end $$;
revoke all on function public.master_atualizar_empresa_modelo(uuid, text, text) from public, anon;
grant execute on function public.master_atualizar_empresa_modelo(uuid, text, text) to authenticated;

-- Lista o catálogo (sincronizando antes) com contagens, entregas e planos.
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
revoke all on function public.master_listar_modelos(uuid) from public, anon;
grant execute on function public.master_listar_modelos(uuid) to authenticated;

create or replace function public.master_publicar_modelo(p_modelo uuid, p_publicado boolean, p_descricao text default null)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  -- Republicar algo já entregue vira nova versão (as próximas entregas registram a versão nova).
  update plataforma_modelos m
     set versao = case when p_publicado and not m.publicado
                            and exists (select 1 from plataforma_modelo_entregas e where e.modelo_id = m.id)
                       then m.versao + 1 else m.versao end,
         publicado = p_publicado,
         descricao = coalesce(p_descricao, m.descricao),
         atualizado_em = now()
   where m.id = p_modelo;
  if not found then raise exception 'Modelo não encontrado'; end if;
end $$;
revoke all on function public.master_publicar_modelo(uuid, boolean, text) from public, anon;
grant execute on function public.master_publicar_modelo(uuid, boolean, text) to authenticated;

create or replace function public.master_salvar_modelos_plano(p_plano uuid, p_modelos uuid[])
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  if not exists (select 1 from plataforma_planos where id = p_plano) then raise exception 'Plano não encontrado'; end if;
  delete from plataforma_plano_modelos where plano_id = p_plano;
  insert into plataforma_plano_modelos (plano_id, modelo_id)
  select p_plano, m.id from plataforma_modelos m where m.id = any(coalesce(p_modelos, '{}'::uuid[]))
  on conflict do nothing;
end $$;
revoke all on function public.master_salvar_modelos_plano(uuid, uuid[]) from public, anon;
grant execute on function public.master_salvar_modelos_plano(uuid, uuid[]) to authenticated;

-- Envia um modelo publicado para várias empresas; erro numa empresa não impede as outras.
create or replace function public.master_enviar_modelo(p_modelo uuid, p_empresas uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_emp uuid; v_out jsonb := '[]'::jsonb; v_res jsonb; v_nome text;
begin
  perform public.app_assert_master();
  if not exists (select 1 from plataforma_modelos where id = p_modelo and publicado) then
    raise exception 'Publique o modelo antes de enviar';
  end if;
  foreach v_emp in array coalesce(p_empresas, '{}'::uuid[]) loop
    select nome into v_nome from "CRM-multi-empresas>empresas<" where id = v_emp;
    begin
      v_res := public.plataforma_aplicar_modelo(p_modelo, v_emp, auth.uid());
      v_out := v_out || jsonb_build_object('empresa_id', v_emp, 'empresa', v_nome, 'ok', true, 'resumo', v_res);
    exception when others then
      v_out := v_out || jsonb_build_object('empresa_id', v_emp, 'empresa', v_nome, 'ok', false, 'erro', sqlerrm);
    end;
  end loop;
  return v_out;
end $$;
revoke all on function public.master_enviar_modelo(uuid, uuid[]) from public, anon;
grant execute on function public.master_enviar_modelo(uuid, uuid[]) to authenticated;

create or replace function public.master_listar_entregas(p_modelo uuid default null, p_limite integer default 200)
returns table (id uuid, modelo_id uuid, modelo_nome text, tipo text, empresa_id uuid, empresa_nome text,
               versao integer, entregue_em timestamptz, resumo jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query
  select en.id, en.modelo_id, m.nome, m.tipo, en.empresa_id, e.nome, en.versao, en.entregue_em, en.resumo
    from plataforma_modelo_entregas en
    join plataforma_modelos m on m.id = en.modelo_id
    join "CRM-multi-empresas>empresas<" e on e.id = en.empresa_id
   where p_modelo is null or en.modelo_id = p_modelo
   order by en.entregue_em desc
   limit greatest(coalesce(p_limite, 200), 1);
end $$;
revoke all on function public.master_listar_entregas(uuid, integer) from public, anon;
grant execute on function public.master_listar_entregas(uuid, integer) to authenticated;

-- 4. Empresa nova recebe os modelos publicados do plano (antes do seed) -------------------------------
create or replace function public.master_criar_empresa(
  p_nome text, p_slug text, p_admin_email text, p_admin_nome text, p_admin_senha text,
  p_cnpj text default null, p_razao_social text default null, p_cor_primaria text default null,
  p_plano_id uuid default null, p_valor_mensal numeric default null, p_dia_vencimento integer default 10)
returns uuid language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_slug text := lower(trim(p_slug)); v_valor numeric; v_m record;
begin
  perform public.app_assert_master();
  if coalesce(trim(p_nome), '') = '' then raise exception 'Nome da empresa é obrigatório'; end if;
  if v_slug !~ '^[a-z0-9_]+$' then raise exception 'Slug inválido: use letras minúsculas, números e _'; end if;
  if exists (select 1 from "CRM-multi-empresas>empresas<" where slug = v_slug) then
    raise exception 'Já existe uma empresa com o slug "%"', v_slug;
  end if;

  insert into "CRM-multi-empresas>empresas<" (nome, slug, schema_nome, cnpj, razao_social, cor_primaria, ativo, status)
  values (trim(p_nome), v_slug, 'crm', nullif(trim(p_cnpj), ''), nullif(trim(p_razao_social), ''),
          coalesce(nullif(trim(p_cor_primaria), ''), '#6366f1'), true, 'ativa')
  returning id into v_id;

  -- Modelos do plano primeiro: o seed do contrato padrão só age em empresa sem modelo.
  if p_plano_id is not null then
    for v_m in
      select m.id from plataforma_plano_modelos pm join plataforma_modelos m on m.id = pm.modelo_id
       where pm.plano_id = p_plano_id and m.publicado
       order by case m.tipo when 'contrato' then 2 else 1 end, m.nome
    loop
      perform public.plataforma_aplicar_modelo(v_m.id, v_id, auth.uid());
    end loop;
  end if;

  perform public.plataforma_seed_empresa(v_id);
  perform public.master_definir_admin_empresa(v_id, p_admin_email, p_admin_nome, p_admin_senha);

  v_valor := coalesce(p_valor_mensal, (select valor_mensal from plataforma_planos where id = p_plano_id));
  if v_valor is not null then
    insert into plataforma_assinaturas (empresa_id, plano_id, valor, dia_vencimento)
    values (v_id, p_plano_id, v_valor, coalesce(p_dia_vencimento, 10));
  end if;
  return v_id;
end $$;
revoke all on function public.master_criar_empresa(text, text, text, text, text, text, text, text, uuid, numeric, integer) from public, anon;
grant execute on function public.master_criar_empresa(text, text, text, text, text, text, text, text, uuid, numeric, integer) to authenticated;
