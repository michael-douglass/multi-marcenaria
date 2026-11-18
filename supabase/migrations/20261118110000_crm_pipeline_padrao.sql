-- M52 (Fase J) — CRM pré-configurado: Pipeline e kanbans padrão (iguais aos da Garbo) em toda marcenaria.
-- Par no front: src/lib/kanbans-padrao.ts (mesmos slugs e nomes). Idempotente.

create or replace function public.crm_seed_pipeline_padrao(p_empresa uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_pag uuid;
  v_col uuid;
  k record;
  c record;
begin
  if p_empresa is null then raise exception 'Empresa obrigatória'; end if;
  perform public.app_set_empresa_ctx(p_empresa);

  -- Etapas do Kanban principal (os nomes são exatos: o front e a migration 203 dependem do texto).
  if not exists (select 1 from crm.pipeline_custom_stages where empresa_id = p_empresa) then
    insert into crm.pipeline_custom_stages (empresa_id, nome, ordem, ativo, is_default) values
      (p_empresa, 'Novo Lead', 0, true, true),
      (p_empresa, 'Visita em obra agendada', 1, true, false),
      (p_empresa, 'Visita em obra Feita', 2, true, false),
      (p_empresa, 'Orçamentos feitos', 3, true, false),
      (p_empresa, 'Precificação Feita', 4, true, false),
      (p_empresa, 'Enviou orçamento', 5, true, false);
  end if;

  -- Kanbans extras: página, colunas e regras (fonte = status do lead; null = coluna manual).
  for k in
    select * from (values
      ('orcamentos', 'Orçamentos internos', 1),
      ('prospeccao', 'Prospecção', 2),
      ('manutencao', 'Manutenção', 3)
    ) as t(slug, nome, ordem)
  loop
    v_pag := null;
    insert into crm.kanban_pages (empresa_id, nome, slug, ordem, ativo)
    values (p_empresa, k.nome, k.slug, k.ordem, true)
    on conflict (empresa_id, slug) do nothing
    returning id into v_pag;
    continue when v_pag is null; -- já existia: não mexe no que a empresa configurou

    for c in
      select * from (values
        ('orcamentos', 1, 'Orçamentos ja enviados', 'Enviou orçamento'),
        ('orcamentos', 2, 'Mensagem reenviada', null),
        ('orcamentos', 3, 'Fechamentos A curto/medio prazo', 'Fechamentos A curto/medio prazo'),
        ('orcamentos', 4, 'Fechamentos Futuros', 'Fechamentos Futuros'),
        ('orcamentos', 5, 'Orçamentos ganhos', 'Orçamentos ganhos'),
        ('orcamentos', 6, 'Orçamentos Perdidos', 'Orçamentos Perdidos'),
        ('prospeccao', 1, 'Arquiteto', 'Arquiteto'),
        ('prospeccao', 2, 'engenheiro', 'engenheiro'),
        ('prospeccao', 3, 'Mensagens enviadas', null),
        ('prospeccao', 4, 'reunião marcada', 'reunião marcada'),
        ('prospeccao', 5, 'reuniao feita', 'reuniao feita'),
        ('prospeccao', 6, 'Clientes Ativos', 'Cliente'),
        ('manutencao', 1, 'Manutenção solicitada', 'Manutenção solicitada'),
        ('manutencao', 2, 'Manutenção agendada', 'Manutenção agendada'),
        ('manutencao', 3, 'Manutenção realizada', 'Manutenção realizada')
      ) as t(slug, ordem, nome, fonte)
      where t.slug = k.slug
      order by t.ordem
    loop
      insert into crm.kanban_columns (empresa_id, pagina_id, nome, ordem, ativo)
      values (p_empresa, v_pag, c.nome, c.ordem, true)
      returning id into v_col;
      if c.fonte is not null then
        insert into crm.kanban_column_sources (empresa_id, coluna_id, tipo_fonte, valor_fonte, ativo)
        values (p_empresa, v_col, 'status', c.fonte, true);
      end if;
    end loop;
  end loop;
end $$;
revoke all on function public.crm_seed_pipeline_padrao(uuid) from public, anon, authenticated;

-- Seed de empresa nova: igual ao anterior (20261117160000) + o CRM padrão.
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
end $$;
revoke all on function public.plataforma_seed_empresa(uuid) from public, anon, authenticated;

-- Backfill: empresas que já existem recebem o CRM padrão (o que já tiverem não muda).
do $$
declare e record;
begin
  for e in select id from "CRM-multi-empresas>empresas<" loop
    perform public.crm_seed_pipeline_padrao(e.id);
  end loop;
  perform set_config('app.empresa_ctx', '', true);
end $$;
