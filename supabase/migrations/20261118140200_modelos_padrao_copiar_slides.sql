-- Modelos padrão (T06) — cópia dos slides de orçamento de uma empresa para outra. Só acrescenta.
-- Ver docs/modelos-padrao/DESIGN.md §3.2.

create or replace function public.plataforma_copiar_slides(p_origem uuid, p_destino uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_tpl crm.orcamento_slide_templates%rowtype;
  v_tpl_novo uuid;
  v_perg uuid;
  r record;
  v_ntpl int := 0; v_nbl int := 0; v_ncat int := 0; v_nperg int := 0; v_nopc int := 0; v_nscr int := 0; v_nfor int := 0; v_n int;
begin
  perform public.plataforma__validar_copia(p_origem, p_destino);
  perform public.app_set_empresa_ctx(p_destino);

  -- Template + blocos: só se o destino não tiver template (o público usa o ativo mais antigo).
  -- Logo e fundo são marca da origem → vazios (a empresa usa a logo do cadastro).
  if not exists (select 1 from crm.orcamento_slide_templates where empresa_id = p_destino) then
    select * into v_tpl from crm.orcamento_slide_templates
     where empresa_id = p_origem order by ativo desc, criado_em asc limit 1;
    if found then
      insert into crm.orcamento_slide_templates (empresa_id, nome, cor_primaria, cor_secundaria, cor_texto, cor_fundo,
                                                fonte_titulo, fonte_corpo, logo_url, fundo_url, ativo)
      values (p_destino, v_tpl.nome, v_tpl.cor_primaria, v_tpl.cor_secundaria, v_tpl.cor_texto, v_tpl.cor_fundo,
              v_tpl.fonte_titulo, v_tpl.fonte_corpo, null, null, true)
      returning id into v_tpl_novo;
      v_ntpl := 1;
      insert into crm.orcamento_slide_blocos (empresa_id, template_id, tipo, ordem, config, ativo)
      select p_destino, v_tpl_novo, b.tipo, b.ordem, b.config, b.ativo
        from crm.orcamento_slide_blocos b where b.template_id = v_tpl.id;
      get diagnostics v_nbl = row_count;
    end if;
  end if;

  -- Catálogo antes das perguntas (opções podem guardar o id de um item do catálogo).
  insert into crm.orcamento_slide_catalogo (empresa_id, categoria, titulo, descricao, imagem_url, destaque, ativo, ordem)
  select p_destino, o.categoria, o.titulo, o.descricao, o.imagem_url, o.destaque, o.ativo, o.ordem
    from crm.orcamento_slide_catalogo o
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.orcamento_slide_catalogo d
                      where d.empresa_id = p_destino and d.categoria = o.categoria and d.titulo = o.titulo);
  get diagnostics v_ncat = row_count;

  -- Perguntas por label; opções por label, com valor remapeado quando for id do catálogo da origem.
  for r in select * from crm.orcamento_slide_perguntas where empresa_id = p_origem order by ordem, criado_em loop
    select id into v_perg from crm.orcamento_slide_perguntas
     where empresa_id = p_destino and label = r.label order by criado_em limit 1;
    if v_perg is null then
      insert into crm.orcamento_slide_perguntas (empresa_id, label, tipo, obrigatorio, ordem, ativo)
      values (p_destino, r.label, r.tipo, r.obrigatorio, r.ordem, r.ativo)
      returning id into v_perg;
      v_nperg := v_nperg + 1;
    end if;
    insert into crm.orcamento_slide_pergunta_opcoes (empresa_id, pergunta_id, label, valor, ordem)
    select p_destino, v_perg, o.label,
           coalesce((select dc.id::text
                       from crm.orcamento_slide_catalogo oc
                       join crm.orcamento_slide_catalogo dc
                         on dc.empresa_id = p_destino and dc.categoria = oc.categoria and dc.titulo = oc.titulo
                      where oc.empresa_id = p_origem and oc.id::text = o.valor
                      limit 1), o.valor),
           o.ordem
      from crm.orcamento_slide_pergunta_opcoes o
     where o.pergunta_id = r.id
       and not exists (select 1 from crm.orcamento_slide_pergunta_opcoes d where d.pergunta_id = v_perg and d.label = o.label);
    get diagnostics v_n = row_count;
    v_nopc := v_nopc + v_n;
  end loop;

  insert into crm.orcamento_slide_scripts (empresa_id, titulo, conteudo, categoria, ativo)
  select p_destino, o.titulo, o.conteudo, o.categoria, o.ativo
    from crm.orcamento_slide_scripts o
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.orcamento_slide_scripts d where d.empresa_id = p_destino and d.titulo = o.titulo);
  get diagnostics v_nscr = row_count;

  insert into crm.orcamento_slide_formas_pagamento (empresa_id, tipo, nome, descricao, parcelas_padrao, entrada_percent,
                                                    entrega_percent, ativo, ordem)
  select p_destino, o.tipo, o.nome, o.descricao, o.parcelas_padrao, o.entrada_percent, o.entrega_percent, o.ativo, o.ordem
    from crm.orcamento_slide_formas_pagamento o
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.orcamento_slide_formas_pagamento d
                      where d.empresa_id = p_destino and d.tipo = o.tipo and d.nome = o.nome);
  get diagnostics v_nfor = row_count;

  return jsonb_build_object('template', v_ntpl, 'blocos', v_nbl, 'catalogo', v_ncat, 'perguntas', v_nperg,
                            'opcoes', v_nopc, 'scripts', v_nscr, 'formas_pagamento', v_nfor);
end $$;
revoke all on function public.plataforma_copiar_slides(uuid, uuid) from public, anon, authenticated;
