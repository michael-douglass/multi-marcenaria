-- M12 (SQL) — Fluxos públicos e busca de leads por empresa.
-- Reescritos de forma estática sobre o schema crm (fim do SQL dinâmico por schema). A empresa vem do
-- próprio registro (lead do token / config da agenda pelo slug) e é gravada EXPLICITAMENTE, então o
-- resultado não depende de quem está logado no navegador. p_schema é mantido só por compatibilidade.

create or replace function public.app_empresa_esta_ativa(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from "CRM-multi-empresas>empresas<" e where e.id = p_empresa_id and e.ativo and e.status = 'ativa');
$$;
grant execute on function public.app_empresa_esta_ativa(uuid) to anon, authenticated, app_tenant_definer;

-- Anexos do formulário público viram mídias do lead ------------------------------------------
CREATE OR REPLACE FUNCTION public.agenda_public_attach_uploads_to_lead(p_schema text, p_lead_id bigint, p_resposta_formulario text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_parsed jsonb;
  v_entry record;
  v_items jsonb;
  v_item jsonb;
  v_url text;
  v_name text;
  v_mime text;
  v_size bigint;
  v_tipo text;
  v_folder_id uuid;
  v_emp uuid;
BEGIN
  IF p_lead_id IS NULL OR p_resposta_formulario IS NULL OR trim(p_resposta_formulario) = '' THEN
    RETURN;
  END IF;
  SELECT empresa_id INTO v_emp FROM crm.leads WHERE id = p_lead_id;
  IF v_emp IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_parsed := p_resposta_formulario::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  SELECT id INTO v_folder_id FROM crm.marketing_media_folders
   WHERE nome = 'orçamentos' AND empresa_id = v_emp LIMIT 1;
  IF v_folder_id IS NULL THEN
    INSERT INTO crm.marketing_media_folders (empresa_id, nome, descricao)
    VALUES (v_emp, 'orçamentos', 'Orçamentos de leads')
    RETURNING id INTO v_folder_id;
  END IF;

  FOR v_entry IN SELECT key, value FROM jsonb_each(v_parsed)
  LOOP
    IF jsonb_typeof(v_entry.value) = 'array' THEN
      v_items := v_entry.value;
    ELSIF jsonb_typeof(v_entry.value) = 'object' THEN
      v_items := jsonb_build_array(v_entry.value);
    ELSE
      CONTINUE;
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
    LOOP
      IF jsonb_typeof(v_item) <> 'object' THEN
        CONTINUE;
      END IF;
      v_url := nullif(trim(both '"' from v_item->>'url'), '');
      IF v_url IS NULL OR v_url NOT LIKE 'http%' THEN
        CONTINUE;
      END IF;
      v_name := coalesce(nullif(trim(v_item->>'name'), ''), 'Anexo');
      v_mime := lower(coalesce(nullif(trim(v_item->>'mime_type'), ''), 'application/octet-stream'));
      v_size := coalesce((v_item->>'size')::bigint, 0);
      IF v_mime = 'application/pdf' THEN
        v_tipo := 'pdf';
      ELSIF v_mime LIKE 'image/%' THEN
        v_tipo := 'imagem';
      ELSIF v_mime LIKE 'video/%' THEN
        v_tipo := 'video';
      ELSE
        CONTINUE;
      END IF;

      INSERT INTO crm.marketing_medias (empresa_id, titulo, tipo, file_url, file_name, file_size, mime_type, folder_id, lead_id)
      VALUES (v_emp, regexp_replace(v_name, '\.[^.]+$', ''), v_tipo, v_url, v_name, v_size, v_mime, v_folder_id, p_lead_id);
    END LOOP;
  END LOOP;
END;
$function$;

-- Agendamento público -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agenda_public_create_booking(p_schema text, p_config_id uuid, p_agenda_slug text, p_dados jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_config record;
  v_lead_id bigint;
  v_reuniao_id uuid;
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
  v_telefone text;
  v_nome text;
  v_email text;
  v_status_destino text;
  v_origem text;
  v_resposta text;
  v_metadata jsonb;
  v_hoje date;
BEGIN
  v_nome := trim(coalesce(p_dados->>'convidado_nome', ''));
  v_telefone := regexp_replace(coalesce(p_dados->>'convidado_whatsapp', ''), '\D', '', 'g');
  v_email := nullif(trim(coalesce(p_dados->>'convidado_email', '')), '');
  v_resposta := p_dados->>'resposta_formulario';
  v_metadata := p_dados->'metadata_capturada';
  v_hoje := (timezone('America/Sao_Paulo', now()))::date;

  IF v_nome = '' OR length(v_telefone) < 10 OR p_dados->>'data_hora_inicio' IS NULL THEN
    RAISE EXCEPTION 'Dados incompletos para agendamento';
  END IF;
  v_data_inicio := (p_dados->>'data_hora_inicio')::timestamptz;

  SELECT id, empresa_id, duracao_minutos, link_video_conferencia, criar_lead_automatico, lead_status_destino, lead_origem
    INTO v_config
    FROM crm.agenda_config
   WHERE id = p_config_id AND slug = p_agenda_slug AND ativo = true;

  IF v_config IS NULL OR NOT public.app_empresa_esta_ativa(v_config.empresa_id) THEN
    RAISE EXCEPTION 'Configuração de agenda não encontrada';
  END IF;
  PERFORM public.app_set_empresa_ctx(v_config.empresa_id);

  v_data_fim := v_data_inicio + make_interval(mins => v_config.duracao_minutos);
  v_lead_id := NULL;

  IF coalesce(v_config.criar_lead_automatico, true) THEN
    v_status_destino := coalesce(nullif(trim(v_config.lead_status_destino), ''), 'Novo Lead');
    v_origem := coalesce(nullif(trim(v_config.lead_origem), ''), 'Agendamento Público');

    INSERT INTO crm.leads (empresa_id, nome, telefone, email, status, origem, data_chegada, valor_negocio, observacoes)
    VALUES (v_config.empresa_id, v_nome, v_telefone, v_email, v_status_destino, v_origem, v_hoje, 0,
            format('Lead criado automaticamente via agendamento público (%s).', p_agenda_slug))
    RETURNING id INTO v_lead_id;

    PERFORM public.agenda_public_attach_uploads_to_lead('crm', v_lead_id, v_resposta);
  END IF;

  INSERT INTO crm.agenda_reunioes (
    empresa_id, titulo, data_hora_inicio, data_hora_fim, duracao_minutos,
    convidado_nome, convidado_whatsapp, convidado_email,
    resposta_formulario, tipo, status, link_video_conferencia,
    metadata_capturada, lead_id
  ) VALUES (
    v_config.empresa_id, format('Reunião com %s', v_nome), v_data_inicio, v_data_fim, v_config.duracao_minutos,
    v_nome, v_telefone, v_email,
    v_resposta, 'publico', 'pendente', v_config.link_video_conferencia,
    v_metadata, v_lead_id
  )
  RETURNING id INTO v_reuniao_id;

  RETURN jsonb_build_object('reuniao_id', v_reuniao_id, 'lead_id', v_lead_id);
END;
$function$;

-- Formulário público de início de orçamento (leitura) -----------------------------------------
CREATE OR REPLACE FUNCTION public.ler_form_inicio_orcamento(p_schema text, p_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_campos jsonb := '[]'::jsonb;
  v_empresa_nome text := NULL;
  v_row record;
  v_prefill text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  SELECT id, nome, telefone, email, empresa_id INTO v_lead
    FROM crm.leads WHERE token_form_orcamento = trim(p_token) LIMIT 1;
  IF v_lead IS NULL OR v_lead.id IS NULL OR NOT public.app_empresa_esta_ativa(v_lead.empresa_id) THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  SELECT e.nome INTO v_empresa_nome FROM public."CRM-multi-empresas>empresas<" e WHERE e.id = v_lead.empresa_id;

  FOR v_row IN
    SELECT nome, label, tipo, obrigatorio, ordem
      FROM crm.contratos_variaveis
     WHERE mostrar_no_link_publico = true AND empresa_id = v_lead.empresa_id
     ORDER BY ordem ASC
  LOOP
    v_prefill := NULL;
    IF lower(v_row.nome) IN ('nome', 'cliente_nome', 'nome_cliente', 'contratante') THEN
      v_prefill := v_lead.nome;
    ELSIF lower(v_row.nome) IN ('telefone', 'whatsapp', 'celular') THEN
      v_prefill := v_lead.telefone;
    ELSIF lower(v_row.nome) = 'email' THEN
      v_prefill := v_lead.email;
    END IF;
    v_campos := v_campos || jsonb_build_array(jsonb_build_object(
      'nome', v_row.nome, 'label', v_row.label, 'tipo', v_row.tipo,
      'obrigatorio', v_row.obrigatorio, 'ordem', v_row.ordem,
      'valor_prefill', coalesce(v_prefill, '')
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'lead_id', v_lead.id,
    'cliente_nome', coalesce(v_lead.nome, ''),
    'empresa_nome', v_empresa_nome,
    'campos', v_campos
  );
END;
$function$;

-- Formulário público de início de orçamento (envio) -------------------------------------------
CREATE OR REPLACE FUNCTION public.submeter_form_inicio_orcamento(p_schema text, p_token text, p_valores jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_allowed text[];
  v_required text[];
  v_filtrado jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
  v_cliente_nome text;
  v_identificador text;
  v_identificador_contrato text;
  v_orcamento_id uuid;
  v_contrato_id uuid;
  v_modelo_id uuid;
  v_campos_contrato jsonb;
  v_dados jsonb;
  v_req text;
  v_novo_nome text;
  v_novo_tel text;
  v_novo_email text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;
  IF p_valores IS NULL OR jsonb_typeof(p_valores) <> 'object' THEN
    RAISE EXCEPTION 'Valores inválidos';
  END IF;

  SELECT id, nome, telefone, email, empresa_id INTO v_lead
    FROM crm.leads WHERE token_form_orcamento = trim(p_token) LIMIT 1;
  IF v_lead IS NULL OR v_lead.id IS NULL OR NOT public.app_empresa_esta_ativa(v_lead.empresa_id) THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;
  PERFORM public.app_set_empresa_ctx(v_lead.empresa_id);

  SELECT coalesce(array_agg(nome ORDER BY ordem), ARRAY[]::text[]),
         coalesce(array_agg(nome) FILTER (WHERE obrigatorio), ARRAY[]::text[])
    INTO v_allowed, v_required
    FROM crm.contratos_variaveis
   WHERE mostrar_no_link_publico = true AND empresa_id = v_lead.empresa_id;

  SELECT id INTO v_modelo_id FROM crm.contratos_modelos
   WHERE ativo = true AND empresa_id = v_lead.empresa_id
   ORDER BY updated_at DESC NULLS LAST LIMIT 1;

  IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
    RAISE EXCEPTION 'Nenhum campo configurado para o formulário público';
  END IF;

  FOREACH v_key IN ARRAY v_allowed LOOP
    v_val := nullif(trim(coalesce(p_valores->>v_key, '')), '');
    IF v_val IS NOT NULL THEN
      v_filtrado := v_filtrado || jsonb_build_object(v_key, v_val);
    END IF;
  END LOOP;

  IF v_required IS NOT NULL THEN
    FOREACH v_req IN ARRAY v_required LOOP
      IF nullif(trim(coalesce(v_filtrado->>v_req, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Campo obrigatório não preenchido: %', v_req;
      END IF;
    END LOOP;
  END IF;

  v_novo_nome := nullif(trim(coalesce(v_filtrado->>'nome', v_filtrado->>'cliente_nome', v_filtrado->>'nome_cliente', v_filtrado->>'contratante', '')), '');
  v_novo_tel := nullif(trim(coalesce(v_filtrado->>'telefone', v_filtrado->>'whatsapp', v_filtrado->>'celular', '')), '');
  v_novo_email := nullif(trim(coalesce(v_filtrado->>'email', '')), '');
  v_cliente_nome := coalesce(v_novo_nome, nullif(trim(coalesce(v_lead.nome, '')), ''), 'Cliente');

  v_identificador := 'ORC-FORM-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYMMDD-HH24MI')
    || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  v_identificador_contrato := 'Rascunho — ' || v_cliente_nome || ' — '
    || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  v_campos_contrato := v_filtrado || jsonb_build_object('__etapa', '1');
  IF v_modelo_id IS NOT NULL THEN
    v_campos_contrato := v_campos_contrato || jsonb_build_object('__modelo_id', v_modelo_id::text);
  END IF;
  v_dados := jsonb_build_object('_meta', jsonb_build_object(
    'origem', 'formulario_publico_lead', 'campos_contrato_preenchidos', v_filtrado, 'etapa', 0));

  UPDATE crm.leads SET
    nome = coalesce(v_novo_nome, nome),
    telefone = coalesce(v_novo_tel, telefone),
    email = coalesce(v_novo_email, email),
    atualizado_em = now()
  WHERE id = v_lead.id AND empresa_id = v_lead.empresa_id;

  INSERT INTO crm.orcamento_slides (empresa_id, identificador, lead_id, cliente_nome, status, dados)
  VALUES (v_lead.empresa_id, v_identificador, v_lead.id, v_cliente_nome, 'rascunho', v_dados)
  RETURNING id INTO v_orcamento_id;

  INSERT INTO crm.contratos (empresa_id, identificador, cliente_nome, status, campos_valores, conteudo_final, criado_por, lead_id)
  VALUES (v_lead.empresa_id, v_identificador_contrato, v_cliente_nome, 'rascunho', v_campos_contrato, '', NULL, v_lead.id)
  RETURNING id INTO v_contrato_id;

  RETURN jsonb_build_object(
    'orcamento_id', v_orcamento_id,
    'contrato_id', v_contrato_id,
    'lead_id', v_lead.id,
    'identificador', v_identificador_contrato,
    'cliente_nome', v_cliente_nome
  );
END;
$function$;

-- Busca de leads do funil de projetos (autenticado) -------------------------------------------
CREATE OR REPLACE FUNCTION public.me_projetos_buscar_leads(p_schema text, p_termo text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id bigint, nome text, telefone text, status text, regiao text, vendedor_responsavel_id uuid, data_chegada date, no_funil boolean, stage_id uuid, stage_nome text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_emp uuid := public.app_empresa_atual();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_termo text := btrim(COALESCE(p_termo, ''));
  v_digitos text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '28000';
  END IF;
  IF v_emp IS NULL THEN
    RETURN;
  END IF;
  IF NOT (
    public.me_is_super_admin(v_uid)
    OR public.me_get_empresa_role('crm', v_uid) = 'admin'
    OR public.me_empresa_has_any_role('crm', ARRAY['vendedor', 'projetista', 'projetista_admin'], v_uid)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para pesquisar leads nesta empresa' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_termo) < 2 THEN
    RETURN;
  END IF;
  v_digitos := regexp_replace(v_termo, '\D', '', 'g');

  RETURN QUERY
    SELECT l.id, l.nome, l.telefone, l.status, l.regiao, l.vendedor_responsavel_id, l.data_chegada,
           (lp.id IS NOT NULL) AS no_funil, lp.stage_id, ps.nome AS stage_nome
      FROM crm.leads l
      LEFT JOIN crm.lead_projetos lp ON lp.lead_id = l.id
      LEFT JOIN crm.projeto_stages ps ON ps.id = lp.stage_id
     WHERE l.empresa_id = v_emp
       AND (l.nome ILIKE '%' || v_termo || '%'
            OR (char_length(v_digitos) >= 3
                AND regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g') LIKE '%' || v_digitos || '%'))
     ORDER BY (l.nome ILIKE v_termo || '%') DESC, l.nome ASC
     LIMIT v_limit;
END;
$function$;
