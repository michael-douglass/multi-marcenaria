-- Modelos padrão (T05) — cópia do markup (custo) de uma empresa para outra. Só acrescenta.
-- Ver docs/modelos-padrao/DESIGN.md §3.2.
-- Funções do postgres com empresa_id explícito: o master está fora de inspeção e app_empresa_atual()
-- ignora o GUC quando há auth.uid().

create or replace function public.plataforma__validar_copia(p_origem uuid, p_destino uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_origem is null or p_destino is null then raise exception 'Origem e destino são obrigatórios'; end if;
  if p_origem = p_destino then raise exception 'Origem e destino são a mesma empresa'; end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_origem) then raise exception 'Empresa de origem não encontrada'; end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_destino) then raise exception 'Empresa de destino não encontrada'; end if;
end $$;
revoke all on function public.plataforma__validar_copia(uuid, uuid) from public, anon, authenticated;

create or replace function public.plataforma_copiar_markup(p_origem uuid, p_destino uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_cat int := 0; v_prod int := 0; v_cfg int := 0; v_desp int := 0; v_serv int := 0; v_reg int := 0;
begin
  perform public.plataforma__validar_copia(p_origem, p_destino);
  perform public.app_set_empresa_ctx(p_destino);

  -- Categorias: chave (slug, subcategoria) — a mesma do unique da tabela.
  insert into crm.markup_categorias (empresa_id, nome, slug, subcategoria, ordem, ativo)
  select p_destino, o.nome, o.slug, o.subcategoria, o.ordem, o.ativo
    from crm.markup_categorias o
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.markup_categorias d
                      where d.empresa_id = p_destino and d.slug is not distinct from o.slug
                        and coalesce(d.subcategoria, '') = coalesce(o.subcategoria, ''));
  get diagnostics v_cat = row_count;

  -- Produtos: categoria remapeada pela chave; chave (categoria, nome, variação).
  insert into crm.markup_produtos (empresa_id, categoria_id, nome, variacao, preco_unitario, unidade, quantidade_padrao,
                                   ativo, ordem, espessura_mm, largura_mm, comprimento_mm)
  select p_destino, dc.id, o.nome, o.variacao, o.preco_unitario, o.unidade, o.quantidade_padrao,
         o.ativo, o.ordem, o.espessura_mm, o.largura_mm, o.comprimento_mm
    from crm.markup_produtos o
    join crm.markup_categorias oc on oc.id = o.categoria_id
    join lateral (select d.id from crm.markup_categorias d
                   where d.empresa_id = p_destino and d.slug is not distinct from oc.slug
                     and coalesce(d.subcategoria, '') = coalesce(oc.subcategoria, '')
                   limit 1) dc on true
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.markup_produtos d
                      where d.empresa_id = p_destino and d.categoria_id = dc.id and d.nome = o.nome
                        and coalesce(d.variacao, '') = coalesce(o.variacao, ''));
  get diagnostics v_prod = row_count;

  -- Parâmetros: linha única; só se o destino não tiver. Timbrado é marca da origem → vazio.
  if not exists (select 1 from crm.markup_config where empresa_id = p_destino) then
    insert into crm.markup_config (empresa_id, valor_hora_marcenaria, fator_sobras, margem_lucro, percentual_imposto,
      taxas_financeiras, custo_frete_padrao, rodape_observacoes_padrao, timbrado_url, horas_projeto_padrao,
      horas_producao_padrao, horas_instalacao_padrao, markup_ia_prompt, markup_ia_model, markup_ia_ativo,
      markup_ia_verificacao, markup_ia_agent_prompts, markup_ia_auditor_model, auditor_lucro_percentual,
      valor_dia_marcenaria, negociador_margem_minima_percent, negociador_pct_material, negociador_pct_mao_obra,
      negociador_pct_lucro)
    select p_destino, o.valor_hora_marcenaria, o.fator_sobras, o.margem_lucro, o.percentual_imposto,
      o.taxas_financeiras, o.custo_frete_padrao, o.rodape_observacoes_padrao, null, o.horas_projeto_padrao,
      o.horas_producao_padrao, o.horas_instalacao_padrao, o.markup_ia_prompt, o.markup_ia_model, o.markup_ia_ativo,
      o.markup_ia_verificacao, o.markup_ia_agent_prompts, o.markup_ia_auditor_model, o.auditor_lucro_percentual,
      o.valor_dia_marcenaria, o.negociador_margem_minima_percent, o.negociador_pct_material, o.negociador_pct_mao_obra,
      o.negociador_pct_lucro
      from crm.markup_config o
     where o.empresa_id = p_origem
     order by o.atualizado_em desc nulls last
     limit 1;
    get diagnostics v_cfg = row_count;
  end if;

  insert into crm.markup_despesa_templates (empresa_id, nome, valor_padrao, ordem, ativo)
  select p_destino, o.nome, o.valor_padrao, o.ordem, o.ativo
    from crm.markup_despesa_templates o
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.markup_despesa_templates d where d.empresa_id = p_destino and d.nome = o.nome);
  get diagnostics v_desp = row_count;

  insert into crm.markup_servico_templates (empresa_id, nome, valor_hora_padrao, ordem, ativo, unidade_cobranca)
  select p_destino, o.nome, o.valor_hora_padrao, o.ordem, o.ativo, o.unidade_cobranca
    from crm.markup_servico_templates o
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.markup_servico_templates d where d.empresa_id = p_destino and d.nome = o.nome);
  get diagnostics v_serv = row_count;

  insert into crm.markup_regras_construtivas (empresa_id, tipo_movel, espessura_corpo_mm, espessura_porta_mm,
    espessura_fundo_mm, rebaixo_fundo_mm, regra_dobradicas, folga_corredica_mm, folga_puxador_mm, perda_chapa_pct,
    perda_fita_borda_pct, area_chapa_padrao_m2, ordem, ativo)
  select p_destino, o.tipo_movel, o.espessura_corpo_mm, o.espessura_porta_mm,
    o.espessura_fundo_mm, o.rebaixo_fundo_mm, o.regra_dobradicas, o.folga_corredica_mm, o.folga_puxador_mm, o.perda_chapa_pct,
    o.perda_fita_borda_pct, o.area_chapa_padrao_m2, o.ordem, o.ativo
    from crm.markup_regras_construtivas o
   where o.empresa_id = p_origem
     and not exists (select 1 from crm.markup_regras_construtivas d where d.empresa_id = p_destino and d.tipo_movel = o.tipo_movel);
  get diagnostics v_reg = row_count;

  return jsonb_build_object('categorias', v_cat, 'produtos', v_prod, 'parametros', v_cfg,
                            'despesas', v_desp, 'servicos', v_serv, 'regras', v_reg);
end $$;
revoke all on function public.plataforma_copiar_markup(uuid, uuid) from public, anon, authenticated;
