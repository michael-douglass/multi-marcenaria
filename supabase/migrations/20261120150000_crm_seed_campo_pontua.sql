-- Campo de sistema "Pontua" no card do lead (usuario_sistema, comissão ligada).
-- Antes ele só nascia quando o master enviava o modelo (plataforma_copiar_pontua): empresa com o programa
-- liberado podia ficar sem o container no card. Agora todo seed de empresa nova cria o campo e as empresas
-- existentes sem ele recebem (backfill). Só age em empresa que ainda não tem campo Pontua.
create or replace function public.crm_seed_campo_pontua(p_empresa_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_set_empresa_ctx(p_empresa_id);
  if exists (select 1 from crm.lead_custom_field_definitions d
              where d.empresa_id = p_empresa_id and public.me_is_campo_pontua(d.tipo, d.nome, d.config_pontua)) then
    return;
  end if;
  insert into crm.lead_custom_field_definitions (empresa_id, nome, tipo, opcoes, ordem, ativo, config_pontua)
  values (p_empresa_id, 'Pontua', 'usuario_sistema', null, 0, true,
          jsonb_build_object('ativo', true, 'percentual_padrao', 10));
end $$;
revoke all on function public.crm_seed_campo_pontua(uuid) from public, anon, authenticated;

create or replace function public.plataforma_seed_empresa(p_empresa_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_set_empresa_ctx(p_empresa_id);

  insert into movelaria_formas_pagamento_pagar (empresa_id, nome, ordem)
  values (p_empresa_id, 'Pix', 1), (p_empresa_id, 'Boleto', 2), (p_empresa_id, 'Cheque', 3), (p_empresa_id, 'Cheque de cliente', 4)
  on conflict (empresa_id, nome) do nothing;

  insert into movelaria_visualizacao_config (empresa_id, chave, paineis_visiveis)
  values (p_empresa_id, 'default', array['chegada_materiais','calendario_obras','acompanhamento_obras',
          'obras_do_dia','obras_atrasadas','cobrancas_atrasadas']::text[])
  on conflict (empresa_id, chave) do nothing;

  insert into movelaria_obra_lousa_text_config (empresa_id, singleton_key) values (p_empresa_id, 'default')
  on conflict (empresa_id, singleton_key) do nothing;

  insert into movelaria_kanban_colunas_obra (empresa_id, titulo, status_key, cor, ordem) values
    (p_empresa_id, 'Datas em Aberto', 'datas_em_aberto', '#6b7280', 1),
    (p_empresa_id, 'Datas em Atraso', 'datas_em_atraso', '#ef4444', 2),
    (p_empresa_id, 'Datas Definidas', 'datas_definidas', '#3b82f6', 3),
    (p_empresa_id, 'Em Andamento',    'em_andamento',    '#f59e0b', 4),
    (p_empresa_id, 'Concluída',       'concluida',       '#10b981', 5),
    (p_empresa_id, 'Cancelada',       'cancelada',       '#9ca3af', 6)
  on conflict (empresa_id, status_key) do nothing;

  if not exists (select 1 from movelaria_escritorio_pastas where empresa_id = p_empresa_id) then
    insert into movelaria_escritorio_pastas (empresa_id, nome, descricao, ordem) values
      (p_empresa_id, 'Contabilidade', 'Notas, balancetes, impostos e comprovantes contábeis', 10),
      (p_empresa_id, 'Escritório', 'Documentos administrativos e do dia a dia do escritório', 20);
  end if;

  if not exists (select 1 from crm.marketing_columns where empresa_id = p_empresa_id) then
    insert into crm.marketing_columns (empresa_id, nome, ordem) values
      (p_empresa_id, 'Ideias', 1), (p_empresa_id, 'Enviados para aprovação', 2), (p_empresa_id, 'Aprovados', 3),
      (p_empresa_id, 'Postados Meta- Ads', 4), (p_empresa_id, 'Postado- Instagram organico', 5),
      (p_empresa_id, 'Postado Tik Tok', 6);
  end if;

  if not exists (select 1 from crm.producao_stages where empresa_id = p_empresa_id) then
    insert into crm.producao_stages (empresa_id, nome, cor, ordem, ativo, is_default) values
      (p_empresa_id, 'Projetos de produção pendentes', 'warning', 0, true, true),
      (p_empresa_id, 'Projeto iniciado', 'primary', 1, true, false),
      (p_empresa_id, 'Projetos concluídos', 'success', 2, true, false);
  end if;

  if not exists (select 1 from crm.projeto_stages where empresa_id = p_empresa_id) then
    insert into crm.projeto_stages (empresa_id, nome, cor, ordem, ativo, is_default) values
      (p_empresa_id, 'Projetos aguardando serem feitos', 'warning', 0, true, true),
      (p_empresa_id, 'Visita agendada', 'primary', 1, true, true),
      (p_empresa_id, 'Projetos feitos', 'success', 2, true, true);
  end if;

  perform public.crm_seed_pipeline_padrao(p_empresa_id);
  perform public.crm_seed_contrato_padrao(p_empresa_id);
  perform public.crm_seed_campo_pontua(p_empresa_id);
end $$;
revoke all on function public.plataforma_seed_empresa(uuid) from public, anon, authenticated;

-- Backfill: empresas com a página Pontua liberada e sem o campo.
do $$
declare e record;
begin
  for e in select id from "CRM-multi-empresas>empresas<"
            where not ('pontua' = any(public.app_paginas_bloqueadas(id))) loop
    perform public.crm_seed_campo_pontua(e.id);
  end loop;
end $$;
