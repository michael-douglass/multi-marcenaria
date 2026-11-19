-- Marca neutra (docs/marca-neutra, T09; ADR 0006): o esquema do banco deixa de citar uma empresa cliente.
-- Gerada por scripts/marca-neutra/gerar-migration-banco.mjs a partir do catálogo. Publicar junto com o
-- front e as edge functions (create-user-admin, register-public, rep-gerar-comprovante, orcamentos-ia-chat).

-- 1) Tabelas
alter table "crm"."pontua_garbo_comissao_liberacoes" rename to "pontua_comissao_liberacoes";
alter table "crm"."pontua_garbo_lancamentos" rename to "pontua_lancamentos";
alter table "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" rename to "CRM-multi-empresas>pontua_comissao_liberacoes<";
alter table "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" rename to "CRM-multi-empresas>pontua_lancamentos<";

-- 2) Colunas
alter table "crm"."lead_custom_field_definitions" rename column "config_pontua_garbo" to "config_pontua";
alter table "crm"."lead_custom_field_values" rename column "pontua_garbo_percentual" to "pontua_percentual";
alter table "crm"."leads" rename column "pontua_garbo_usuario_id" to "pontua_usuario_id";
alter table "public"."CRM-multi-empresas>lead_custom_field_definitions<" rename column "config_pontua_garbo" to "config_pontua";
alter table "public"."CRM-multi-empresas>lead_custom_field_values<" rename column "pontua_garbo_percentual" to "pontua_percentual";
alter table "public"."CRM-multi-empresas>leads<" rename column "pontua_garbo_usuario_id" to "pontua_usuario_id";

-- 3) Constraints (renomeiam também o índice que as sustenta)
alter table "crm"."leads" rename constraint "leads_pontua_garbo_usuario_id_fkey" to "leads_pontua_usuario_id_fkey";
alter table "crm"."pontua_comissao_liberacoes" rename constraint "pontua_garbo_comissao_liberacoes_lead_id_field_id_key" to "pontua_comissao_liberacoes_lead_id_field_id_key";
alter table "crm"."pontua_comissao_liberacoes" rename constraint "pontua_garbo_comissao_liberacoes_pkey" to "pontua_comissao_liberacoes_pkey";
alter table "crm"."pontua_comissao_liberacoes" rename constraint "pontua_garbo_comissao_liberacoes_status_check" to "pontua_comissao_liberacoes_status_check";
alter table "crm"."pontua_lancamentos" rename constraint "pontua_garbo_lancamentos_pkey" to "pontua_lancamentos_pkey";
alter table "crm"."pontua_lancamentos" rename constraint "pontua_garbo_lancamentos_tipo_check" to "pontua_lancamentos_tipo_check";
alter table "public"."CRM-multi-empresas>leads<" rename constraint "leads_pontua_garbo_usuario_id_fkey" to "leads_pontua_usuario_id_fkey";
alter table "public"."CRM-multi-empresas>pontua_comissao_liberacoes<" rename constraint "CRM-multi-empresas>pontua_garbo_comissao_l_lead_id_field_id_key" to "CRM-multi-empresas>pontua_comissao_l_lead_id_field_id_key";
alter table "public"."CRM-multi-empresas>pontua_comissao_liberacoes<" rename constraint "CRM-multi-empresas>pontua_garbo_comissao_liberacoe_status_check" to "CRM-multi-empresas>pontua_comissao_liberacoe_status_check";
alter table "public"."CRM-multi-empresas>pontua_comissao_liberacoes<" rename constraint "CRM-multi-empresas>pontua_garbo_comissao_liberacoes<_pkey" to "CRM-multi-empresas>pontua_comissao_liberacoes<_pkey";
alter table "public"."CRM-multi-empresas>pontua_lancamentos<" rename constraint "CRM-multi-empresas>pontua_garbo_lancamentos<_pkey" to "CRM-multi-empresas>pontua_lancamentos<_pkey";
alter table "public"."CRM-multi-empresas>pontua_lancamentos<" rename constraint "CRM-multi-empresas>pontua_garbo_lancamentos<_tipo_check" to "CRM-multi-empresas>pontua_lancamentos<_tipo_check";

-- 4) Índices
alter index "crm"."emp_garbo_marketing_media_folders_lead_id_idx" rename to "marketing_media_folders_lead_id_idx";
alter index "crm"."idx_garbo_evento_item_midias" rename to "idx_evento_item_midias";
alter index "crm"."idx_garbo_evento_itens_evento" rename to "idx_evento_itens_evento";
alter index "crm"."idx_garbo_evento_paginas_evento" rename to "idx_evento_paginas_evento";
alter index "crm"."idx_garbo_evento_part_evento" rename to "idx_evento_part_evento";
alter index "crm"."idx_garbo_evento_part_midias" rename to "idx_evento_part_midias";
alter index "crm"."idx_garbo_evento_tarefas_evento" rename to "idx_evento_tarefas_evento";
alter index "crm"."idx_garbo_eventos_data" rename to "idx_eventos_data";
alter index "crm"."idx_garbo_eventos_pin" rename to "idx_eventos_pin";
alter index "crm"."idx_garbo_lead_ai_analises_criado_em" rename to "idx_lead_ai_analises_criado_em";
alter index "crm"."idx_garbo_lead_ai_analises_lead_id" rename to "idx_lead_ai_analises_lead_id";
alter index "crm"."idx_garbo_lead_ai_chat_messages_thread" rename to "idx_lead_ai_chat_messages_thread";
alter index "crm"."idx_garbo_lead_ai_knowledge_embedding" rename to "idx_lead_ai_knowledge_embedding";
alter index "crm"."idx_garbo_lead_ai_knowledge_lead_id" rename to "idx_lead_ai_knowledge_lead_id";
alter index "crm"."idx_garbo_lead_ai_renders_lead_id" rename to "idx_lead_ai_renders_lead_id";
alter index "crm"."idx_garbo_lead_ai_renders_parent" rename to "idx_lead_ai_renders_parent";
alter index "crm"."idx_garbo_lead_projeto_notas_lead" rename to "idx_lead_projeto_notas_lead";
alter index "crm"."idx_garbo_lead_projetos_arquiteto" rename to "idx_lead_projetos_arquiteto";
alter index "crm"."idx_garbo_lead_projetos_stage" rename to "idx_lead_projetos_stage";
alter index "crm"."idx_garbo_lead_sinalizacoes_dest_aberto" rename to "idx_lead_sinalizacoes_dest_aberto";
alter index "crm"."idx_garbo_photo_checklists_lead_id" rename to "idx_photo_checklists_lead_id";
alter index "crm"."idx_garbo_projeto_stages_ordem" rename to "idx_projeto_stages_ordem";
alter index "crm"."idx_garbo_wb_drawings_lead_id" rename to "idx_wb_drawings_lead_id";
alter index "crm"."idx_garbo_wb_images_lead_id" rename to "idx_wb_images_lead_id";
alter index "crm"."idx_leads_pontua_garbo_usuario_id" rename to "idx_leads_pontua_usuario_id";
alter index "public"."idx_public_leads_pontua_garbo_usuario_id" rename to "idx_public_leads_pontua_usuario_id";

-- 5) Triggers
alter trigger "trg_proteger_campo_pontua_garbo" on "crm"."lead_custom_field_definitions" rename to "trg_proteger_campo_pontua";
alter trigger "trg_proteger_campo_pontua_garbo" on "public"."CRM-multi-empresas>lead_custom_field_definitions<" rename to "trg_proteger_campo_pontua";

-- 6) Nomes de função (grants e triggers acompanham o oid)
alter function "public"."me_garantir_campo_pontua_garbo"(p_schema text) rename to "me_garantir_campo_pontua";
alter function "public"."me_is_campo_pontua_garbo"(p_tipo text, p_nome text, p_config jsonb) rename to "me_is_campo_pontua";
alter function "public"."me_proteger_campo_pontua_garbo"() rename to "me_proteger_campo_pontua";
alter function "public"."movelaria_criar_conta_pagar_pontua_garbo"(p_liberacao_id uuid, p_prestador_id uuid, p_lead_id integer, p_valor_comissao numeric) rename to "movelaria_criar_conta_pagar_pontua";

-- 7) Corpos de função recriados com os nomes e valores novos
CREATE OR REPLACE FUNCTION crm.trg_pontua_comissao_cria_conta_pagar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_conta_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aguardando_liberacao' THEN
    RETURN NEW;
  END IF;

  IF NEW.conta_pagar_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_conta_id := public.movelaria_criar_conta_pagar_pontua(
    NEW.id,
    NEW.prestador_id,
    NEW.lead_id,
    NEW.valor_comissao
  );

  IF v_conta_id IS NOT NULL THEN
    NEW.conta_pagar_id := v_conta_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.me_garantir_campo_pontua(p_schema text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_table text;
  v_relname text;
BEGIN
  IF p_schema = 'public' THEN
    v_table := 'public."CRM-multi-empresas>lead_custom_field_definitions<"';
    v_relname := 'CRM-multi-empresas>lead_custom_field_definitions<';
  ELSE
    v_table := format('%I.lead_custom_field_definitions', p_schema);
    v_relname := 'lead_custom_field_definitions';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = p_schema
      AND c.relname = v_relname
      AND c.relkind = 'r'
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    $sql$
    UPDATE %s
    SET
      ativo = true,
      tipo = 'usuario_sistema',
      config_pontua = COALESCE(
        config_pontua || jsonb_build_object('ativo', true),
        jsonb_build_object('ativo', true, 'percentual_padrao', 10)
      )
    WHERE public.me_is_campo_pontua(tipo, nome, config_pontua)
    $sql$,
    v_table
  );

  EXECUTE format(
    $sql$
    INSERT INTO %s (nome, tipo, opcoes, ordem, ativo, config_pontua)
    SELECT
      'Pontua',
      'usuario_sistema',
      NULL,
      0,
      true,
      jsonb_build_object('ativo', true, 'percentual_padrao', 10)
    WHERE NOT EXISTS (
      SELECT 1 FROM %s
      WHERE public.me_is_campo_pontua(tipo, nome, config_pontua)
    )
    $sql$,
    v_table,
    v_table
  );

  EXECUTE format('DROP TRIGGER IF EXISTS trg_proteger_campo_pontua ON %s', v_table);
  EXECUTE format(
    'CREATE TRIGGER trg_proteger_campo_pontua
       BEFORE UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION public.me_proteger_campo_pontua()',
    v_table
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.me_is_campo_pontua(p_tipo text, p_nome text, p_config jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    (
      lower(trim(COALESCE(p_nome, ''))) = 'pontua'
    )
    OR (
      COALESCE(p_tipo, 'usuario_sistema') = 'usuario_sistema'
      AND p_config IS NOT NULL
      AND COALESCE((p_config->>'ativo')::boolean, false) = true
    )
    OR (
      COALESCE(p_tipo, 'usuario_sistema') = 'usuario_sistema'
      AND p_config IS NULL
      AND (
        lower(trim(COALESCE(p_nome, ''))) LIKE '%pontua%'
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.me_lead_linked_to_prestador(_schema text, _lead_id bigint, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_linked BOOLEAN;
BEGIN
  IF _schema IS NULL OR _lead_id IS NULL OR _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _schema !~ '^(crm|emp_[a-z0-9_]+)$' THEN
    RETURN FALSE;
  END IF;

  EXECUTE format(
    $q$
    SELECT EXISTS (
      SELECT 1
      FROM %I.usuarios u
      WHERE u.id = $2
        AND u.tipo_usuario = 'prestador_servico'
    )
    AND EXISTS (
      SELECT 1
      FROM %I.lead_custom_field_values v
      INNER JOIN %I.lead_custom_field_definitions d ON d.id = v.field_id
      WHERE v.lead_id = $1
        AND d.tipo = 'usuario_sistema'
        AND d.ativo = true
        AND v.valor = $2::text
        AND (
          d.config_pontua IS NULL
          OR COALESCE((d.config_pontua->>'ativo')::boolean, true) IS TRUE
        )
    )
    $q$,
    _schema,
    _schema,
    _schema
  )
  INTO v_linked
  USING _lead_id, _user_id;

  RETURN COALESCE(v_linked, FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.me_proteger_campo_pontua()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.me_is_campo_pontua(OLD.tipo, OLD.nome, OLD.config_pontua) THEN
      RAISE EXCEPTION 'O campo Pontua é do sistema e não pode ser excluído dos cards.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF public.me_is_campo_pontua(OLD.tipo, OLD.nome, OLD.config_pontua)
       OR public.me_is_campo_pontua(NEW.tipo, NEW.nome, NEW.config_pontua) THEN
      IF NEW.ativo IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'O campo Pontua é do sistema e não pode ser excluído dos cards.';
      END IF;
      NEW.tipo := 'usuario_sistema';
      NEW.nome := COALESCE(NULLIF(btrim(OLD.nome), ''), 'Pontua');
      IF NEW.config_pontua IS NULL
         OR COALESCE((NEW.config_pontua->>'ativo')::boolean, false) IS NOT TRUE THEN
        NEW.config_pontua := jsonb_build_object(
          'ativo', true,
          'percentual_padrao', COALESCE(
            NULLIF(NEW.config_pontua->>'percentual_padrao', '')::numeric,
            NULLIF(OLD.config_pontua->>'percentual_padrao', '')::numeric,
            10
          )
        );
      ELSE
        NEW.config_pontua := NEW.config_pontua || jsonb_build_object('ativo', true);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_criar_conta_pagar_pontua(p_liberacao_id uuid, p_prestador_id uuid, p_lead_id integer, p_valor_comissao numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_arquiteto TEXT;
  v_lead_nome TEXT;
  v_descricao TEXT;
  v_valor NUMERIC(12, 2);
  v_conta_id UUID;
  v_obs TEXT;
BEGIN
  IF p_liberacao_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_valor := ROUND(COALESCE(p_valor_comissao, 0)::NUMERIC, 2);
  IF v_valor <= 0 THEN
    RETURN NULL;
  END IF;

  -- Já existe conta ligada a esta liberação?
  SELECT id INTO v_conta_id
  FROM movelaria_contas_pagar
  WHERE observacao LIKE '%pontua_liberacao:' || p_liberacao_id::TEXT || '%'
  LIMIT 1;

  IF v_conta_id IS NOT NULL THEN
    RETURN v_conta_id;
  END IF;

  SELECT NULLIF(btrim(u.nome), '') INTO v_arquiteto
  FROM crm.usuarios u
  WHERE u.id = p_prestador_id;

  SELECT NULLIF(btrim(l.nome), '') INTO v_lead_nome
  FROM crm.leads l
  WHERE l.id = p_lead_id;

  v_arquiteto := COALESCE(v_arquiteto, 'Arquiteto');
  v_descricao := v_arquiteto || ' — Pontua';
  v_obs := 'Lead: ' || COALESCE(v_lead_nome, '#' || p_lead_id::TEXT)
        || E'\npontua_liberacao:' || p_liberacao_id::TEXT;

  INSERT INTO movelaria_contas_pagar (
    fornecedor_nome,
    descricao,
    observacao,
    valor_total,
    numero_parcela,
    total_parcelas,
    valor_parcela,
    data_vencimento,
    status,
    valor_pago,
    grupo_lancamento_id
  ) VALUES (
    v_arquiteto,
    v_descricao,
    v_obs,
    v_valor,
    1,
    1,
    v_valor,
    CURRENT_DATE,
    'pendente',
    0,
    gen_random_uuid()
  )
  RETURNING id INTO v_conta_id;

  RETURN v_conta_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_admin_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prest JSONB;
  v_saques JSONB;
  v_libs JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pontua_fin() THEN
    RAISE EXCEPTION 'Acesso negado ao financeiro Pontua';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id, 'nome', u.nome, 'email', u.email, 'titulo', COALESCE(u.titulo, 'Prestador de Serviço'),
    'telefone', u.telefone
  ) ORDER BY u.nome), '[]'::JSONB)
  INTO v_prest
  FROM crm.usuarios u
  WHERE u.tipo_usuario = 'prestador_servico' AND u.status_convite = 'ATIVO';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'prestador_id', s.prestador_id,
    'valor_solicitado', s.valor_solicitado,
    'chave_pix', s.chave_pix,
    'tipo_chave_pix', s.tipo_chave_pix,
    'status', s.status,
    'criado_em', s.criado_em,
    'processado_em', s.processado_em
  ) ORDER BY s.criado_em DESC), '[]'::JSONB)
  INTO v_saques
  FROM crm.prestador_saque_pedidos s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'lead_id', l.lead_id, 'prestador_id', l.prestador_id, 'status', l.status, 'field_id', l.field_id
  ) ORDER BY l.criado_em DESC NULLS LAST), '[]'::JSONB)
  INTO v_libs
  FROM crm.pontua_comissao_liberacoes l
  WHERE l.status = 'aguardando_liberacao';

  RETURN jsonb_build_object(
    'prestadores', COALESCE(v_prest, '[]'::JSONB),
    'saques', COALESCE(v_saques, '[]'::JSONB),
    'liberacoes', COALESCE(v_libs, '[]'::JSONB)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_aprovar_saque(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row crm.prestador_saque_pedidos%ROWTYPE;
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM aprova saque';
  END IF;
  SELECT * INTO v_row FROM crm.prestador_saque_pedidos WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_row.status IS DISTINCT FROM 'pendente' THEN RAISE EXCEPTION 'Pedido já processado'; END IF;

  INSERT INTO crm.pontua_lancamentos (prestador_id, tipo, valor, descricao, criado_por, saque_pedido_id)
  VALUES (v_row.prestador_id, 'saque', v_row.valor_solicitado,
          'Retirada PIX: ' || COALESCE(v_row.chave_pix, ''), auth.uid(), v_row.id);

  UPDATE crm.prestador_saque_pedidos
  SET status = 'aprovado', processado_em = NOW(), processado_por = auth.uid()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_liberar_comissao(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM libera comissão';
  END IF;
  UPDATE crm.pontua_comissao_liberacoes
  SET status = 'liberada'
  WHERE id = p_id AND status = 'aguardando_liberacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Liberação não encontrada'; END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid          UUID := auth.uid();
  v_perfil       JSONB;
  v_leads        JSONB;
  v_permissoes   JSONB;
  v_lancamentos  JSONB;
  v_saques       JSONB;
  v_titulos      JSONB;
  v_defs         JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_prestador() THEN
    RAISE EXCEPTION 'Acesso negado ao portal do parceiro';
  END IF;

  SELECT jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'email', c.email,
    'telefone', c.telefone,
    'avatar_url', c.avatar_url,
    'titulo', COALESCE(c.titulo, 'Prestador de Serviço'),
    'comissao_ativa', COALESCE(c.comissao_ativa, FALSE),
    'chave_pix', c.chave_pix,
    'tipo_chave_pix', COALESCE(c.tipo_chave_pix, 'cpf')
  )
  INTO v_perfil
  FROM crm.usuarios c
  WHERE c.id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'nome', d.nome,
    'ativo', d.ativo,
    'config_pontua', COALESCE(d.config_pontua, '{}'::JSONB)
  ) ORDER BY d.ordem, d.nome), '[]'::JSONB)
  INTO v_defs
  FROM crm.lead_custom_field_definitions d
  WHERE d.tipo = 'usuario_sistema';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', l.id,
    'lead_nome', l.nome,
    'lead_status', l.status,
    'valor_orcamento', COALESCE(l.valor_orcamento, 0),
    'valor_negocio', COALESCE(l.valor_negocio, 0),
    'field_id', v.field_id,
    'field_nome', d.nome,
    'percentual', COALESCE(v.pontua_percentual, NULLIF((d.config_pontua->>'percentual_padrao')::NUMERIC, 0), 5),
    'venda_realizada_em', l.venda_realizada_em,
    'data_chegada', l.data_chegada,
    'criado_em', l.criado_em,
    'lead_email', l.email,
    'lead_telefone', l.telefone,
    'lead_empresa', l.empresa,
    'lead_origem', l.origem,
    'lead_regiao', l.regiao,
    'liberacao_id', lib.id,
    'liberacao_status', lib.status
  ) ORDER BY COALESCE(l.venda_realizada_em, l.criado_em) DESC NULLS LAST), '[]'::JSONB)
  INTO v_leads
  FROM crm.lead_custom_field_values v
  JOIN crm.lead_custom_field_definitions d ON d.id = v.field_id
  JOIN crm.leads l ON l.id = v.lead_id
  LEFT JOIN crm.pontua_comissao_liberacoes lib
    ON lib.lead_id = v.lead_id
   AND lib.field_id = v.field_id
   AND lib.prestador_id = v_uid
  WHERE v.valor = v_uid::TEXT
    AND d.tipo = 'usuario_sistema'
    AND COALESCE(d.ativo, TRUE);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', p.lead_id,
    'prestador_id', p.prestador_id,
    'pode_ver_detalhes', COALESCE(p.pode_ver_detalhes, FALSE),
    'pode_ver_lousa', COALESCE(p.pode_ver_lousa, FALSE),
    'pode_ver_anotacoes', COALESCE(p.pode_ver_anotacoes, FALSE),
    'pode_ver_anexos', COALESCE(p.pode_ver_anexos, FALSE),
    'pode_ver_fotos', COALESCE(p.pode_ver_fotos, FALSE),
    'pode_ver_pdfs', COALESCE(p.pode_ver_pdfs, FALSE),
    'anexos_visiveis', p.anexos_visiveis,
    'pode_ver_orcamento', COALESCE(p.pode_ver_orcamento, FALSE),
    'orcamentos_visiveis', p.orcamentos_visiveis
  )), '[]'::JSONB)
  INTO v_permissoes
  FROM crm.lead_prestador_permissoes p
  WHERE p.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.id, 'tipo', x.tipo, 'valor', x.valor, 'descricao', x.descricao, 'criado_em', x.criado_em
  ) ORDER BY x.criado_em DESC), '[]'::JSONB)
  INTO v_lancamentos
  FROM crm.pontua_lancamentos x
  WHERE x.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'valor_solicitado', s.valor_solicitado,
    'chave_pix', s.chave_pix,
    'tipo_chave_pix', s.tipo_chave_pix,
    'status', s.status,
    'obs_admin', s.obs_admin,
    'criado_em', s.criado_em,
    'processado_em', s.processado_em
  ) ORDER BY s.criado_em DESC), '[]'::JSONB)
  INTO v_saques
  FROM crm.prestador_saque_pedidos s
  WHERE s.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome) ORDER BY t.nome), '[]'::JSONB)
  INTO v_titulos
  FROM crm.prestador_titulos t;

  RETURN jsonb_build_object(
    'perfil', v_perfil,
    'defs', COALESCE(v_defs, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB),
    'permissoes', COALESCE(v_permissoes, '[]'::JSONB),
    'lancamentos', COALESCE(v_lancamentos, '[]'::JSONB),
    'saques', COALESCE(v_saques, '[]'::JSONB),
    'titulos', COALESCE(v_titulos, '[]'::JSONB)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_saldo_sacar(p_uid uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_liberado NUMERIC := 0;
  v_ajustes  NUMERIC := 0;
  v_saques   NUMERIC := 0;
BEGIN
  IF p_uid IS DISTINCT FROM auth.uid() OR NOT public.movelaria_crm_pode_prestador() THEN
    RAISE EXCEPTION 'Acesso negado ao portal do parceiro';
  END IF;

  SELECT COALESCE(SUM(
    (
      CASE
        WHEN public.movelaria_crm_portal_status_e_ganho(l.status)
          THEN COALESCE(NULLIF(l.valor_negocio, 0), COALESCE(l.valor_orcamento, 0), 0)
        ELSE COALESCE(l.valor_orcamento, 0)
      END
      * COALESCE(v.pontua_percentual, NULLIF((d.config_pontua->>'percentual_padrao')::NUMERIC, 0), 5)
      / 100.0
    )
  ), 0)
  INTO v_liberado
  FROM crm.lead_custom_field_values v
  JOIN crm.lead_custom_field_definitions d ON d.id = v.field_id
  JOIN crm.leads l ON l.id = v.lead_id
  JOIN crm.pontua_comissao_liberacoes lib
    ON lib.lead_id = v.lead_id
   AND lib.field_id = v.field_id
   AND lib.prestador_id = p_uid
   AND lib.status = 'liberada'
  WHERE v.valor = p_uid::TEXT
    AND d.tipo = 'usuario_sistema'
    AND COALESCE(d.ativo, TRUE)
    AND COALESCE((d.config_pontua->>'ativo')::BOOLEAN, TRUE)
    AND public.movelaria_crm_portal_status_e_ganho(l.status);

  SELECT COALESCE(SUM(CASE WHEN tipo = 'ajuste' THEN valor ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN tipo = 'saque' THEN valor ELSE 0 END), 0)
  INTO v_ajustes, v_saques
  FROM crm.pontua_lancamentos
  WHERE prestador_id = p_uid;

  RETURN GREATEST(0, ROUND((v_liberado + v_ajustes - v_saques)::NUMERIC, 2));
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_gerar_texto_recibo_prestador(p_prestador_id uuid, p_valor numeric, p_data_pagamento date, p_descricao text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config movelaria_recibo_prestador_config%ROWTYPE;
  v_nome TEXT;
  v_cpf TEXT;
  v_texto TEXT;
BEGIN
  SELECT * INTO v_config FROM movelaria_recibo_prestador_config WHERE ativo = true LIMIT 1;
  IF NOT FOUND THEN
    v_config.template_texto := 'RECIBO — {{valor_pagamento}} — {{descricao_pagamento}}';
    v_config.cnpj := '';
  END IF;

  SELECT COALESCE(u.nome, u.email), COALESCE(f.cpf, '')
  INTO v_nome, v_cpf
  FROM movelaria_usuarios u
  LEFT JOIN movelaria_funcionarios f ON f.usuario_id = u.id
  WHERE u.id = p_prestador_id;

  v_texto := v_config.template_texto;
  v_texto := replace(v_texto, '{{nome_empresa}}', upper(coalesce((select e.nome from public."CRM-multi-empresas>empresas<" e where e.id = public.app_empresa_atual()), '')));
  v_texto := replace(v_texto, '{{cnpj}}', COALESCE(v_config.cnpj, ''));
  v_texto := replace(v_texto, '{{nome_prestador}}', COALESCE(v_nome, ''));
  v_texto := replace(v_texto, '{{cpf_prestador}}', COALESCE(v_cpf, ''));
  v_texto := replace(v_texto, '{{valor_pagamento}}', 'R$ ' || TO_CHAR(COALESCE(p_valor, 0), 'FM999G999G990D00'));
  v_texto := replace(v_texto, '{{data_pagamento}}', TO_CHAR(COALESCE(p_data_pagamento, CURRENT_DATE), 'DD/MM/YYYY'));
  v_texto := replace(v_texto, '{{descricao_pagamento}}', COALESCE(NULLIF(TRIM(p_descricao), ''), 'Pagamento de serviços'));
  RETURN v_texto;
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_sync_clientes_from_leads()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  -- Atualiza clientes já existentes (match por telefone ou email).
  WITH leads_norm AS (
    SELECT
      trim(nome) AS nome,
      NULLIF(trim(telefone), '') AS telefone,
      NULLIF(trim(email), '') AS email,
      COALESCE(NULLIF(trim(origem), ''), 'Lead') AS origem,
      COALESCE(data_chegada, criado_em::date, CURRENT_DATE) AS data_cadastro
    FROM crm.leads
    WHERE NULLIF(trim(nome), '') IS NOT NULL
  ),
  updated_rows AS (
    UPDATE movelaria_clientes c
    SET
      nome = COALESCE(NULLIF(ln.nome, ''), c.nome),
      telefone = COALESCE(ln.telefone, c.telefone),
      email = COALESCE(ln.email, c.email),
      origem = COALESCE(ln.origem, c.origem),
      data_cadastro = COALESCE(ln.data_cadastro, c.data_cadastro),
      atualizado_em = NOW()
    FROM leads_norm ln
    WHERE (
      (ln.telefone IS NOT NULL AND c.telefone = ln.telefone)
      OR (ln.email IS NOT NULL AND c.email = ln.email)
    )
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_updated FROM updated_rows;

  -- Insere apenas quem ainda não existe por telefone/email.
  WITH leads_norm AS (
    SELECT
      trim(nome) AS nome,
      NULLIF(trim(telefone), '') AS telefone,
      NULLIF(trim(email), '') AS email,
      COALESCE(NULLIF(trim(origem), ''), 'Lead') AS origem,
      COALESCE(data_chegada, criado_em::date, CURRENT_DATE) AS data_cadastro
    FROM crm.leads
    WHERE NULLIF(trim(nome), '') IS NOT NULL
  ),
  inserted_rows AS (
    INSERT INTO movelaria_clientes (
      nome,
      telefone,
      email,
      origem,
      data_cadastro
    )
    SELECT
      ln.nome,
      ln.telefone,
      ln.email,
      ln.origem,
      ln.data_cadastro
    FROM leads_norm ln
    WHERE NOT EXISTS (
      SELECT 1
      FROM movelaria_clientes c
      WHERE
        (ln.telefone IS NOT NULL AND c.telefone = ln.telefone)
        OR (ln.email IS NOT NULL AND c.email = ln.email)
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted_rows;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_upsert_cliente_from_lead(p_nome text, p_telefone text, p_email text, p_origem text, p_data_cadastro date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NULLIF(trim(p_nome), '') IS NULL THEN
    RETURN;
  END IF;

  UPDATE movelaria_clientes c
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), c.nome),
    telefone = COALESCE(NULLIF(trim(p_telefone), ''), c.telefone),
    email = COALESCE(NULLIF(trim(p_email), ''), c.email),
    origem = COALESCE(NULLIF(trim(p_origem), ''), c.origem),
    data_cadastro = COALESCE(p_data_cadastro, c.data_cadastro),
    atualizado_em = NOW()
  WHERE (
    (NULLIF(trim(p_telefone), '') IS NOT NULL AND c.telefone = NULLIF(trim(p_telefone), ''))
    OR (NULLIF(trim(p_email), '') IS NOT NULL AND c.email = NULLIF(trim(p_email), ''))
  );

  IF NOT FOUND THEN
    INSERT INTO movelaria_clientes (nome, telefone, email, origem, data_cadastro)
    VALUES (
      trim(p_nome),
      NULLIF(trim(p_telefone), ''),
      NULLIF(trim(p_email), ''),
      COALESCE(NULLIF(trim(p_origem), ''), 'Lead'),
      COALESCE(p_data_cadastro, CURRENT_DATE)
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.plataforma_copiar_pontua(p_origem uuid, p_destino uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- campo já existente: a empresa pode ter ajustado o percentual — não sobrescreve.
  end if;

  return jsonb_build_object('copiado', v_n > 0, 'percentual_padrao', case when v_pct_ok then v_pct end);
end $function$;

-- 8) Comentários
comment on function "public"."me_is_campo_pontua"(p_tipo text, p_nome text, p_config jsonb) is 'Identifica o campo de sistema Pontua nos cards de lead.';
comment on function "public"."me_lead_linked_to_prestador"(_schema text, _lead_id bigint, _user_id uuid) is 'True se o lead pertence ao prestador (valor no campo usuario_sistema / Pontua).';
comment on function "public"."me_proteger_campo_pontua"() is 'Impede exclusão ou desativação do campo Pontua nos cards de lead.';

-- 9) Defaults
alter table "public"."movelaria_rep_config" alter column "razao_social" set default '';

-- 10) Valores gravados: o programa é "Pontua" e o lead sem origem é "Lead".
update crm.lead_custom_field_definitions set nome = 'Pontua' where nome = 'Pontua Garbo';
update crm.markup_servico_templates set nome = 'Pontua' where nome = 'Pontua Garbo';
update crm.leads set origem = 'Pontua' where origem = 'Pontua Garbo';
update crm.lead_origins set nome = 'Pontua' where nome = 'Pontua Garbo'
  and not exists (select 1 from crm.lead_origins o2 where o2.empresa_id = crm.lead_origins.empresa_id and o2.nome = 'Pontua');
update public.movelaria_contas_pagar set descricao = replace(descricao, ' — Pontua Garbo', ' — Pontua') where descricao like '%— Pontua Garbo%';
update public.movelaria_clientes set origem = 'Lead' where origem = 'Lead Garbo';
