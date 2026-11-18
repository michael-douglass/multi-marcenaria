CREATE OR REPLACE FUNCTION public._form_orcamento_schema_ok(p_schema text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT p_schema IS NOT NULL
    AND p_schema ~ '^(crm|emp_[a-z0-9_]+)$'
    AND EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = p_schema
    );
$function$

;
CREATE OR REPLACE FUNCTION public.agenda_public_attach_uploads_to_lead(p_schema text, p_lead_id bigint, p_resposta_formulario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parsed jsonb;
  v_entry record;
  v_item jsonb;
  v_url text;
  v_name text;
  v_mime text;
  v_size bigint;
  v_tipo text;
  v_folder_id uuid;
  v_folders_table text;
  v_medias_table text;
BEGIN
  IF p_lead_id IS NULL OR p_resposta_formulario IS NULL OR trim(p_resposta_formulario) = '' THEN
    RETURN;
  END IF;

  BEGIN
    v_parsed := p_resposta_formulario::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  IF p_schema IS NOT NULL AND p_schema <> '' THEN
    v_folders_table := format('%I.marketing_media_folders', p_schema);
    v_medias_table := format('%I.marketing_medias', p_schema);
  ELSE
    v_folders_table := 'public.crm_multiempresas_marketing_media_folders';
    v_medias_table := 'public.crm_multiempresas_marketing_medias';
  END IF;

  EXECUTE format(
    'SELECT id FROM %s WHERE nome = $1 LIMIT 1',
    v_folders_table
  )
    INTO v_folder_id
    USING 'orçamentos';

  IF v_folder_id IS NULL THEN
    EXECUTE format(
      'INSERT INTO %s (nome, descricao) VALUES ($1, $2) RETURNING id',
      v_folders_table
    )
      INTO v_folder_id
      USING 'orçamentos', 'Orçamentos de leads';
  END IF;

  FOR v_entry IN SELECT key, value FROM jsonb_each(v_parsed)
  LOOP
    IF jsonb_typeof(v_entry.value) = 'array' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_entry.value)
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

        EXECUTE format(
          'INSERT INTO %s (titulo, tipo, file_url, file_name, file_size, mime_type, folder_id, lead_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          v_medias_table
        )
        USING
          regexp_replace(v_name, '\.[^.]+$', ''),
          v_tipo,
          v_url,
          v_name,
          v_size,
          v_mime,
          v_folder_id,
          p_lead_id;
      END LOOP;
    ELSIF jsonb_typeof(v_entry.value) = 'object' THEN
      v_item := v_entry.value;
      v_url := nullif(trim(v_item->>'url'), '');
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

      EXECUTE format(
        'INSERT INTO %s (titulo, tipo, file_url, file_name, file_size, mime_type, folder_id, lead_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        v_medias_table
      )
      USING
        regexp_replace(v_name, '\.[^.]+$', ''),
        v_tipo,
        v_url,
        v_name,
        v_size,
        v_mime,
        v_folder_id,
        p_lead_id;
    END IF;
  END LOOP;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.agenda_public_create_booking(p_schema text, p_config_id uuid, p_agenda_slug text, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_should_create_lead boolean;
  v_status_destino text;
  v_origem text;
  v_titulo text;
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

  IF p_schema IS NOT NULL AND p_schema <> '' THEN
    EXECUTE format(
      'SELECT id, duracao_minutos, link_video_conferencia, criar_lead_automatico, lead_status_destino, lead_origem
         FROM %I.agenda_config
        WHERE id = $1 AND slug = $2 AND ativo = true',
      p_schema
    )
      INTO v_config
      USING p_config_id, p_agenda_slug;
  ELSE
    SELECT id, duracao_minutos, link_video_conferencia, criar_lead_automatico, lead_status_destino, lead_origem
      INTO v_config
      FROM public."CRM-multi-empresas>agenda_config<"
     WHERE id = p_config_id
       AND slug = p_agenda_slug
       AND ativo = true;
  END IF;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Configuração de agenda não encontrada';
  END IF;

  v_data_fim := v_data_inicio + make_interval(mins => v_config.duracao_minutos);
  v_should_create_lead := coalesce(v_config.criar_lead_automatico, true);
  v_lead_id := NULL;
  v_titulo := format('Reunião com %s', v_nome);

  IF v_should_create_lead THEN
    v_status_destino := coalesce(nullif(trim(v_config.lead_status_destino), ''), 'Novo Lead');
    v_origem := coalesce(nullif(trim(v_config.lead_origem), ''), 'Agendamento Público');

    IF p_schema IS NOT NULL AND p_schema <> '' THEN
      EXECUTE format(
        'INSERT INTO %I.leads (nome, telefone, email, status, origem, data_chegada, valor_negocio, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
         RETURNING id',
        p_schema
      )
        INTO v_lead_id
        USING
          v_nome,
          v_telefone,
          v_email,
          v_status_destino,
          v_origem,
          v_hoje,
          format('Lead criado automaticamente via agendamento público (%s).', p_agenda_slug);

      PERFORM public.agenda_public_attach_uploads_to_lead(p_schema, v_lead_id, v_resposta);
    ELSE
      INSERT INTO public."CRM-multi-empresas>leads<" (
        nome, telefone, email, status, origem, data_chegada, valor_negocio, observacoes
      )
      VALUES (
        v_nome,
        v_telefone,
        v_email,
        v_status_destino,
        v_origem,
        v_hoje::text,
        0,
        format('Lead criado automaticamente via agendamento público (%s).', p_agenda_slug)
      )
      RETURNING id INTO v_lead_id;

      PERFORM public.agenda_public_attach_uploads_to_lead(NULL, v_lead_id, v_resposta);
    END IF;
  END IF;

  IF p_schema IS NOT NULL AND p_schema <> '' THEN
    EXECUTE format(
      'INSERT INTO %I.agenda_reunioes (
         titulo, data_hora_inicio, data_hora_fim, duracao_minutos,
         convidado_nome, convidado_whatsapp, convidado_email,
         resposta_formulario, tipo, status, link_video_conferencia,
         metadata_capturada, lead_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ''publico'', ''pendente'', $9, $10, $11)
       RETURNING id',
      p_schema
    )
      INTO v_reuniao_id
      USING
        v_titulo,
        v_data_inicio,
        v_data_fim,
        v_config.duracao_minutos,
        v_nome,
        v_telefone,
        v_email,
        v_resposta,
        v_config.link_video_conferencia,
        v_metadata,
        v_lead_id;
  ELSE
    INSERT INTO public."CRM-multi-empresas>agenda_reunioes<" (
      titulo, data_hora_inicio, data_hora_fim, duracao_minutos,
      convidado_nome, convidado_whatsapp, convidado_email,
      resposta_formulario, tipo, status, link_video_conferencia,
      metadata_capturada, lead_id
    )
    VALUES (
      v_titulo,
      v_data_inicio,
      v_data_fim,
      v_config.duracao_minutos,
      v_nome,
      v_telefone,
      v_email,
      v_resposta,
      'publico',
      'pendente',
      v_config.link_video_conferencia,
      v_metadata,
      v_lead_id
    )
    RETURNING id INTO v_reuniao_id;
  END IF;

  RETURN jsonb_build_object(
    'reuniao_id', v_reuniao_id,
    'lead_id', v_lead_id
  );
END;
$function$

;
CREATE OR REPLACE FUNCTION public.ler_form_inicio_orcamento(p_schema text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  IF public._form_orcamento_schema_ok(p_schema) THEN
    EXECUTE format(
      'SELECT id, nome, telefone, email, token_form_orcamento
         FROM %I.leads
        WHERE token_form_orcamento = $1
        LIMIT 1',
      p_schema
    )
      INTO v_lead
      USING trim(p_token);

    IF v_lead IS NULL OR v_lead.id IS NULL THEN
      RAISE EXCEPTION 'Link inválido ou expirado';
    END IF;

    BEGIN
      SELECT e.nome INTO v_empresa_nome
        FROM public."CRM-multi-empresas>empresas<" e
       WHERE e.schema_nome = p_schema
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_empresa_nome := NULL;
    END;

    FOR v_row IN EXECUTE format(
      'SELECT nome, label, tipo, obrigatorio, ordem
         FROM %I.contratos_variaveis
        WHERE mostrar_no_link_publico = true
        ORDER BY ordem ASC',
      p_schema
    )
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
        'nome', v_row.nome,
        'label', v_row.label,
        'tipo', v_row.tipo,
        'obrigatorio', v_row.obrigatorio,
        'ordem', v_row.ordem,
        'valor_prefill', coalesce(v_prefill, '')
      ));
    END LOOP;
  ELSE
    SELECT id, nome, telefone, email, token_form_orcamento
      INTO v_lead
      FROM public."CRM-multi-empresas>leads<"
     WHERE token_form_orcamento = trim(p_token)
     LIMIT 1;

    IF v_lead IS NULL OR v_lead.id IS NULL THEN
      RAISE EXCEPTION 'Link inválido ou expirado';
    END IF;

    FOR v_row IN
      SELECT nome, label, tipo, obrigatorio, ordem
        FROM public."CRM-multi-empresas>contratos_variaveis<"
       WHERE mostrar_no_link_publico = true
         AND (schema_nome IS NULL OR schema_nome = coalesce(nullif(p_schema, ''), schema_nome))
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
        'nome', v_row.nome,
        'label', v_row.label,
        'tipo', v_row.tipo,
        'obrigatorio', v_row.obrigatorio,
        'ordem', v_row.ordem,
        'valor_prefill', coalesce(v_prefill, '')
      ));
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'lead_id', v_lead.id,
    'cliente_nome', coalesce(v_lead.nome, ''),
    'empresa_nome', v_empresa_nome,
    'campos', v_campos
  );
END;
$function$

;
CREATE OR REPLACE FUNCTION public.me_projetos_buscar_leads(p_schema text, p_termo text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id bigint, nome text, telefone text, status text, regiao text, vendedor_responsavel_id uuid, data_chegada date, no_funil boolean, stage_id uuid, stage_nome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_termo text := btrim(COALESCE(p_termo, ''));
  v_digitos text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_schema IS NULL OR p_schema NOT LIKE 'emp\_%' ESCAPE '\' THEN
    RETURN;
  END IF;

  IF to_regclass(format('%I.leads', p_schema)) IS NULL
     OR to_regclass(format('%I.lead_projetos', p_schema)) IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.me_is_super_admin(v_uid)
    OR public.me_get_empresa_role(p_schema, v_uid) = 'admin'
    OR public.me_empresa_has_any_role(
         p_schema,
         ARRAY['vendedor', 'projetista', 'projetista_admin'],
         v_uid
       )
  ) THEN
    RAISE EXCEPTION 'Sem permissao para pesquisar leads nesta empresa' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_termo) < 2 THEN
    RETURN;
  END IF;

  v_digitos := regexp_replace(v_termo, '\D', '', 'g');

  RETURN QUERY EXECUTE format(
    'SELECT l.id,
            l.nome,
            l.telefone,
            l.status,
            l.regiao,
            l.vendedor_responsavel_id,
            l.data_chegada,
            (lp.id IS NOT NULL) AS no_funil,
            lp.stage_id,
            ps.nome AS stage_nome
       FROM %I.leads l
       LEFT JOIN %I.lead_projetos lp ON lp.lead_id = l.id
       LEFT JOIN %I.projeto_stages ps ON ps.id = lp.stage_id
      WHERE l.nome ILIKE $1
         OR (
              char_length($2) >= 3
              AND regexp_replace(COALESCE(l.telefone, ''''), ''\D'', '''', ''g'') LIKE $3
            )
      ORDER BY (l.nome ILIKE $4) DESC, l.nome ASC
      LIMIT $5',
    p_schema, p_schema, p_schema
  )
  USING '%' || v_termo || '%',
        v_digitos,
        '%' || v_digitos || '%',
        v_termo || '%',
        v_limit;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.submeter_form_inicio_orcamento(p_schema text, p_token text, p_valores jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF p_valores IS NULL OR jsonb_typeof(p_valores) <> 'object' THEN
    RAISE EXCEPTION 'Valores inválidos';
  END IF;

  IF public._form_orcamento_schema_ok(p_schema) THEN
    EXECUTE format(
      'SELECT id, nome, telefone, email
         FROM %I.leads
        WHERE token_form_orcamento = $1
        LIMIT 1',
      p_schema
    )
      INTO v_lead
      USING trim(p_token);

    IF v_lead IS NULL OR v_lead.id IS NULL THEN
      RAISE EXCEPTION 'Link inválido ou expirado';
    END IF;

    EXECUTE format(
      'SELECT coalesce(array_agg(nome ORDER BY ordem), ARRAY[]::text[]),
              coalesce(array_agg(nome) FILTER (WHERE obrigatorio), ARRAY[]::text[])
         FROM %I.contratos_variaveis
        WHERE mostrar_no_link_publico = true',
      p_schema
    )
      INTO v_allowed, v_required;

    BEGIN
      EXECUTE format(
        'SELECT id FROM %I.contratos_modelos
          WHERE ativo = true
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1',
        p_schema
      )
        INTO v_modelo_id;
    EXCEPTION WHEN undefined_table THEN
      v_modelo_id := NULL;
    END;

  ELSE
    SELECT id, nome, telefone, email
      INTO v_lead
      FROM public."CRM-multi-empresas>leads<"
     WHERE token_form_orcamento = trim(p_token)
     LIMIT 1;

    IF v_lead IS NULL OR v_lead.id IS NULL THEN
      RAISE EXCEPTION 'Link inválido ou expirado';
    END IF;

    SELECT coalesce(array_agg(nome ORDER BY ordem), ARRAY[]::text[]),
           coalesce(array_agg(nome) FILTER (WHERE obrigatorio), ARRAY[]::text[])
      INTO v_allowed, v_required
      FROM public."CRM-multi-empresas>contratos_variaveis<"
     WHERE mostrar_no_link_publico = true
       AND (schema_nome IS NULL OR schema_nome = coalesce(nullif(p_schema, ''), schema_nome));

    SELECT id INTO v_modelo_id
      FROM public."CRM-multi-empresas>contratos_modelos<"
     WHERE ativo = true
       AND (schema_nome IS NULL OR schema_nome = coalesce(nullif(p_schema, ''), schema_nome))
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
    RAISE EXCEPTION 'Nenhum campo configurado para o formulário público';
  END IF;

  FOREACH v_key IN ARRAY v_allowed
  LOOP
    v_val := nullif(trim(coalesce(p_valores->>v_key, '')), '');
    IF v_val IS NOT NULL THEN
      v_filtrado := v_filtrado || jsonb_build_object(v_key, v_val);
    END IF;
  END LOOP;

  IF v_required IS NOT NULL THEN
    FOREACH v_req IN ARRAY v_required
    LOOP
      IF nullif(trim(coalesce(v_filtrado->>v_req, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Campo obrigatório não preenchido: %', v_req;
      END IF;
    END LOOP;
  END IF;

  v_cliente_nome := coalesce(
    nullif(trim(coalesce(
      v_filtrado->>'nome',
      v_filtrado->>'cliente_nome',
      v_filtrado->>'nome_cliente',
      v_filtrado->>'contratante',
      ''
    )), ''),
    nullif(trim(coalesce(v_lead.nome, '')), ''),
    'Cliente'
  );

  v_identificador := 'ORC-FORM-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYMMDD-HH24MI')
    || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);

  v_identificador_contrato := 'Rascunho — ' || v_cliente_nome || ' — '
    || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  v_campos_contrato := v_filtrado || jsonb_build_object('__etapa', '1');
  IF v_modelo_id IS NOT NULL THEN
    v_campos_contrato := v_campos_contrato || jsonb_build_object('__modelo_id', v_modelo_id::text);
  END IF;

  v_dados := jsonb_build_object(
    '_meta', jsonb_build_object(
      'origem', 'formulario_publico_lead',
      'campos_contrato_preenchidos', v_filtrado,
      'etapa', 0
    )
  );

  IF public._form_orcamento_schema_ok(p_schema) THEN
    EXECUTE format(
      'UPDATE %I.leads SET
         nome = CASE WHEN $1 <> '''' THEN $1 ELSE nome END,
         telefone = CASE WHEN $2 <> '''' THEN $2 ELSE telefone END,
         email = CASE WHEN $3 <> '''' THEN $3 ELSE email END,
         atualizado_em = now()
       WHERE id = $4',
      p_schema
    )
    USING
      coalesce(nullif(trim(coalesce(
        v_filtrado->>'nome', v_filtrado->>'cliente_nome', v_filtrado->>'nome_cliente', v_filtrado->>'contratante', ''
      )), ''), ''),
      coalesce(nullif(trim(coalesce(
        v_filtrado->>'telefone', v_filtrado->>'whatsapp', v_filtrado->>'celular', ''
      )), ''), ''),
      coalesce(nullif(trim(coalesce(v_filtrado->>'email', '')), ''), ''),
      v_lead.id;

    EXECUTE format(
      'INSERT INTO %I.orcamento_slides
         (identificador, lead_id, cliente_nome, status, dados)
       VALUES ($1, $2, $3, ''rascunho'', $4)
       RETURNING id',
      p_schema
    )
      INTO v_orcamento_id
      USING v_identificador, v_lead.id, v_cliente_nome, v_dados;

    EXECUTE format(
      'INSERT INTO %I.contratos
         (identificador, cliente_nome, status, campos_valores, conteudo_final, criado_por, lead_id)
       VALUES ($1, $2, ''rascunho'', $3, '''', NULL, $4)
       RETURNING id',
      p_schema
    )
      INTO v_contrato_id
      USING v_identificador_contrato, v_cliente_nome, v_campos_contrato, v_lead.id;
  ELSE
    UPDATE public."CRM-multi-empresas>leads<" SET
      nome = CASE
        WHEN nullif(trim(coalesce(
          v_filtrado->>'nome', v_filtrado->>'cliente_nome', v_filtrado->>'nome_cliente', v_filtrado->>'contratante', ''
        )), '') IS NOT NULL
        THEN trim(coalesce(
          v_filtrado->>'nome', v_filtrado->>'cliente_nome', v_filtrado->>'nome_cliente', v_filtrado->>'contratante', ''
        ))
        ELSE nome
      END,
      telefone = CASE
        WHEN nullif(trim(coalesce(
          v_filtrado->>'telefone', v_filtrado->>'whatsapp', v_filtrado->>'celular', ''
        )), '') IS NOT NULL
        THEN trim(coalesce(
          v_filtrado->>'telefone', v_filtrado->>'whatsapp', v_filtrado->>'celular', ''
        ))
        ELSE telefone
      END,
      email = CASE
        WHEN nullif(trim(coalesce(v_filtrado->>'email', '')), '') IS NOT NULL
        THEN trim(v_filtrado->>'email')
        ELSE email
      END,
      atualizado_em = now()
    WHERE id = v_lead.id;

    INSERT INTO public."CRM-multi-empresas>orcamento_slides<" (
      identificador, lead_id, cliente_nome, status, dados, schema_nome
    )
    VALUES (
      v_identificador, v_lead.id, v_cliente_nome, 'rascunho', v_dados, p_schema
    )
    RETURNING id INTO v_orcamento_id;

    INSERT INTO public."CRM-multi-empresas>contratos<" (
      schema_nome, identificador, cliente_nome, status, campos_valores, conteudo_final, criado_por, lead_id
    )
    VALUES (
      p_schema, v_identificador_contrato, v_cliente_nome, 'rascunho', v_campos_contrato, '', NULL, v_lead.id
    )
    RETURNING id INTO v_contrato_id;
  END IF;

  RETURN jsonb_build_object(
    'orcamento_id', v_orcamento_id,
    'contrato_id', v_contrato_id,
    'lead_id', v_lead.id,
    'identificador', v_identificador_contrato,
    'cliente_nome', v_cliente_nome
  );
END;
$function$
