-- Migration 119: não marcar/bloquear falta automática no dia ainda em andamento
-- Problema: abrir o Resumo (ou sync) incluía HOJE e gravava "falta" de madrugada,
-- impedindo bater ponto. Falta automática só fecha o dia no job noturno (~23:59 SP).

CREATE OR REPLACE FUNCTION movelaria_ponto_data_faltas_ate()
RETURNS DATE AS $$
  SELECT CASE
    WHEN EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo')) >= 23
      THEN movelaria_ponto_data_local()
    ELSE movelaria_ponto_data_local() - 1
  END;
$$ LANGUAGE sql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_detectar_faltas(
  p_data DATE DEFAULT movelaria_ponto_data_local(NOW() - INTERVAL '1 day')
)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
  v_hora_sp INT := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))::INT;
BEGIN
  -- Dia corrente só pode fechar falta a partir das 23h (job noturno) ou dias passados
  IF p_data > movelaria_ponto_data_local() THEN
    RETURN 0;
  END IF;
  IF p_data = movelaria_ponto_data_local() AND v_hora_sp < 23 THEN
    RETURN 0;
  END IF;

  FOR v_rec IN
    SELECT j.funcionario_id
    FROM movelaria_funcionario_jornada j
    JOIN movelaria_funcionarios f ON f.id = j.funcionario_id AND f.ativo = true
    WHERE j.ativo = true
      AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
      AND EXTRACT(ISODOW FROM p_data)::INT = ANY(j.dias_uteis)
      AND p_data >= movelaria_ponto_data_inicio_vinculo(f.id)
      AND p_data <= movelaria_ponto_data_local()
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = j.funcionario_id
          AND movelaria_ponto_data_local(m.registrado_em) = p_data
      )
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = j.funcionario_id
          AND o.data = p_data
          AND o.tipo IN ('folga', 'abono', 'falta')
      )
  LOOP
    INSERT INTO movelaria_funcionario_ponto_ocorrencias (
      funcionario_id, data, tipo, observacao, automatica
    ) VALUES (
      v_rec.funcionario_id, p_data, 'falta', 'Falta detectada automaticamente.', true
    )
    ON CONFLICT (funcionario_id, data, tipo) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_sincronizar_faltas_periodo(
  p_inicio DATE,
  p_fim DATE
)
RETURNS INT AS $$
DECLARE
  v_dia DATE;
  v_total INT := 0;
  v_fim DATE := LEAST(p_fim, movelaria_ponto_data_faltas_ate());
BEGIN
  IF p_inicio IS NULL OR v_fim IS NULL OR p_inicio > v_fim THEN
    RETURN 0;
  END IF;

  v_dia := p_inicio;
  WHILE v_dia <= v_fim LOOP
    v_total := v_total + movelaria_ponto_detectar_faltas(v_dia);
    v_dia := v_dia + 1;
  END LOOP;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_status_dia(
  p_funcionario_id UUID DEFAULT NULL,
  p_data DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_func_id UUID;
  v_data DATE := COALESCE(p_data, movelaria_ponto_data_local());
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_proximo TEXT;
  v_ocorrencia TEXT;
  v_marcacoes JSONB;
  v_status_dia TEXT := 'pendente';
  v_hora_sp INT := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))::INT;
BEGIN
  IF p_funcionario_id IS NULL THEN
    SELECT id INTO v_func_id FROM movelaria_funcionarios
    WHERE usuario_id = auth.uid() AND ativo = true;
  ELSE
    v_func_id := p_funcionario_id;
  END IF;

  IF v_func_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_jornada FROM movelaria_funcionario_jornada
  WHERE funcionario_id = v_func_id;

  -- Falta automática no dia corrente (antes das 23h) não bloqueia nem aparece como ocorrência
  SELECT tipo INTO v_ocorrencia FROM movelaria_funcionario_ponto_ocorrencias
  WHERE funcionario_id = v_func_id AND data = v_data
    AND NOT (
      tipo = 'falta'
      AND COALESCE(automatica, false) = true
      AND v_data = movelaria_ponto_data_local()
      AND v_hora_sp < 23
    )
  ORDER BY criado_em DESC LIMIT 1;

  v_proximo := movelaria_ponto_proximo_tipo(v_func_id, v_data);

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.registrado_em), '[]'::jsonb)
  INTO v_marcacoes
  FROM movelaria_funcionario_ponto_marcacoes m
  WHERE m.funcionario_id = v_func_id AND movelaria_ponto_data_local(m.registrado_em) = v_data;

  IF v_ocorrencia = 'folga' THEN v_status_dia := 'folga';
  ELSIF v_ocorrencia = 'falta' THEN v_status_dia := 'falta';
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_marcacoes) e WHERE e->>'status' = 'atraso') THEN v_status_dia := 'atraso';
  ELSIF v_proximo IS NULL AND jsonb_array_length(v_marcacoes) > 0 THEN v_status_dia := 'completo';
  ELSIF jsonb_array_length(v_marcacoes) > 0 THEN v_status_dia := 'em_dia';
  END IF;

  RETURN jsonb_build_object(
    'funcionario_id', v_func_id,
    'data', v_data,
    'jornada', CASE WHEN v_jornada.id IS NOT NULL THEN to_jsonb(v_jornada) ELSE NULL END,
    'proximo_tipo', v_proximo,
    'ocorrencia', v_ocorrencia,
    'status_dia', v_status_dia,
    'marcacoes', v_marcacoes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_bater(
  p_marcacao_id UUID,
  p_foto_path TEXT,
  p_assinatura_path TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_precisao_metros DOUBLE PRECISION,
  p_hash_sha256 TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_funcionario movelaria_funcionarios%ROWTYPE;
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_tipo TEXT;
  v_data DATE := movelaria_ponto_data_local();
  v_hora TIME := movelaria_ponto_hora_local();
  v_dow INT := movelaria_ponto_dia_semana_local();
  v_hora_ref TIME;
  v_atraso INT := 0;
  v_status TEXT := 'normal';
  v_marc movelaria_funcionario_ponto_marcacoes%ROWTYPE;
  v_doc_id UUID;
  v_comprovante_path TEXT;
  v_nome_comprovante TEXT;
BEGIN
  SELECT * INTO v_funcionario
  FROM movelaria_funcionarios
  WHERE usuario_id = auth.uid() AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum cadastro de funcionário vinculado ao seu usuário.';
  END IF;

  IF v_funcionario.tipo NOT IN ('montador', 'montador_admin', 'administrador_obras') THEN
    RAISE EXCEPTION 'Seu perfil não está habilitado para bater ponto.';
  END IF;

  SELECT * INTO v_jornada
  FROM movelaria_funcionario_jornada
  WHERE funcionario_id = v_funcionario.id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada de trabalho não configurada. Contate o RH.';
  END IF;

  IF NOT (v_dow = ANY(v_jornada.dias_uteis)) THEN
    RAISE EXCEPTION 'Hoje não é dia útil na sua jornada.';
  END IF;

  -- Se a pessoa está batendo ponto, remove falta automática indevida do dia
  DELETE FROM movelaria_funcionario_ponto_ocorrencias
  WHERE funcionario_id = v_funcionario.id
    AND data = v_data
    AND tipo = 'falta'
    AND COALESCE(automatica, false) = true;

  -- Só bloqueia folga ou falta MANUAL (lançada pelo RH)
  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias
    WHERE funcionario_id = v_funcionario.id
      AND data = v_data
      AND (
        tipo = 'folga'
        OR (tipo = 'falta' AND COALESCE(automatica, false) = false)
      )
  ) THEN
    RAISE EXCEPTION 'Não é possível bater ponto: folga ou falta registrada para hoje.';
  END IF;

  v_tipo := movelaria_ponto_proximo_tipo(v_funcionario.id, v_data);
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Todas as batidas de hoje já foram registradas.';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'Localização é obrigatória para registrar o ponto.';
  END IF;

  IF p_foto_path IS NULL OR p_assinatura_path IS NULL THEN
    RAISE EXCEPTION 'Foto e assinatura são obrigatórias.';
  END IF;

  IF v_tipo = 'entrada' THEN
    v_hora_ref := v_jornada.hora_entrada;
  ELSIF v_tipo = 'retorno_intervalo' THEN
    v_hora_ref := v_jornada.hora_retorno_intervalo;
  END IF;

  IF v_hora_ref IS NOT NULL THEN
    v_atraso := GREATEST(0,
      EXTRACT(EPOCH FROM (v_hora - v_hora_ref)) / 60 - v_jornada.tolerancia_minutos
    )::INT;
    IF v_atraso > 0 THEN v_status := 'atraso'; END IF;
  END IF;

  v_comprovante_path := v_funcionario.id::text || '/ponto/' || p_marcacao_id::text || '/comprovante.pdf';
  v_nome_comprovante := 'Comprovante Ponto ' || TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.pdf';

  INSERT INTO movelaria_funcionario_documentos (
    id, funcionario_id, categoria, tipo_documento, nome_arquivo,
    tipo_mime, storage_path, preview_path, kind, origem
  ) VALUES (
    gen_random_uuid(), v_funcionario.id, 'ponto', 'comprovante_ponto', v_nome_comprovante,
    'application/pdf', v_comprovante_path, p_foto_path, 'pdf', 'funcionario_sistema'
  )
  RETURNING id INTO v_doc_id;

  INSERT INTO movelaria_funcionario_ponto_marcacoes (
    id, funcionario_id, usuario_id, tipo,
    latitude, longitude, precisao_metros,
    foto_path, assinatura_path, comprovante_pdf_path, documento_id,
    hash_sha256, status, atraso_minutos
  ) VALUES (
    p_marcacao_id, v_funcionario.id, auth.uid(), v_tipo,
    p_latitude, p_longitude, p_precisao_metros,
    p_foto_path, p_assinatura_path, v_comprovante_path, v_doc_id,
    COALESCE(p_hash_sha256, ''), v_status, v_atraso
  )
  RETURNING * INTO v_marc;

  UPDATE movelaria_rep_config SET nsr_atual = v_marc.nsr, atualizado_em = NOW()
  WHERE ativo = true;

  RETURN jsonb_build_object(
    'marcacao', to_jsonb(v_marc),
    'documento_id', v_doc_id,
    'funcionario_id', v_funcionario.id,
    'funcionario_nome', v_funcionario.nome,
    'comprovante_path', v_comprovante_path
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_resumo_periodo(p_periodo TEXT DEFAULT 'mes')
RETURNS JSONB AS $$
DECLARE
  v_hoje DATE := movelaria_ponto_data_local();
  v_faltas_ate DATE := movelaria_ponto_data_faltas_ate();
  v_inicio DATE;
  v_fim DATE;
  v_periodo TEXT := lower(trim(COALESCE(p_periodo, 'mes')));
  v_funcionarios JSONB;
  v_he_empresa INT;
  v_faltas_empresa INT;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o resumo de ponto.';
  END IF;

  IF v_periodo NOT IN ('semana', 'mes', 'ano') THEN
    RAISE EXCEPTION 'Período inválido. Use semana, mes ou ano.';
  END IF;

  IF v_periodo = 'semana' THEN
    v_inicio := v_hoje - ((EXTRACT(ISODOW FROM v_hoje)::INT) - 1);
    v_fim := v_inicio + 6;
  ELSIF v_periodo = 'mes' THEN
    v_inicio := date_trunc('month', v_hoje)::DATE;
    v_fim := (date_trunc('month', v_hoje) + INTERVAL '1 month - 1 day')::DATE;
  ELSE
    v_inicio := date_trunc('year', v_hoje)::DATE;
    v_fim := (date_trunc('year', v_hoje) + INTERVAL '1 year - 1 day')::DATE;
  END IF;

  -- Só sincroniza faltas até o dia já fechado (não o dia em andamento)
  PERFORM movelaria_ponto_sincronizar_faltas_periodo(v_inicio, v_fim);

  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'nome'), '[]'::jsonb)
  INTO v_funcionarios
  FROM (
    SELECT jsonb_build_object(
      'funcionario_id', f.id,
      'nome', f.nome,
      'tipo', f.tipo,
      'hora_extra_minutos', COALESCE((
        SELECT SUM(
          GREATEST(
            0,
            FLOOR(
              EXTRACT(
                EPOCH FROM (
                  movelaria_ponto_hora_local(m.registrado_em) - j.hora_saida
                )
              ) / 60
            )::INT
          )
        )::INT
        FROM movelaria_funcionario_ponto_marcacoes m
        INNER JOIN movelaria_funcionario_jornada j
          ON j.funcionario_id = f.id AND j.ativo = true
        WHERE m.funcionario_id = f.id
          AND m.tipo = 'saida'
          AND movelaria_ponto_data_local(m.registrado_em) BETWEEN v_inicio AND v_fim
      ), 0),
      'faltas_datas', COALESCE((
        SELECT jsonb_agg(to_char(d.dia, 'YYYY-MM-DD') ORDER BY d.dia)
        FROM generate_series(
          GREATEST(
            v_inicio,
            COALESCE(
              NULLIF(f.admissao_dados->>'data_admissao', '')::DATE,
              movelaria_ponto_data_local(f.criado_em)
            )
          ),
          LEAST(v_fim, v_faltas_ate),
          INTERVAL '1 day'
        ) AS d(dia)
        INNER JOIN movelaria_funcionario_jornada j
          ON j.funcionario_id = f.id AND j.ativo = true
        WHERE EXTRACT(ISODOW FROM d.dia)::INT = ANY(j.dias_uteis)
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
            WHERE m.funcionario_id = f.id
              AND movelaria_ponto_data_local(m.registrado_em) = d.dia
          )
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
            WHERE o.funcionario_id = f.id
              AND o.data = d.dia
              AND o.tipo IN ('folga', 'abono')
          )
      ), '[]'::jsonb),
      'faltas', COALESCE((
        SELECT COUNT(*)::INT
        FROM generate_series(
          GREATEST(
            v_inicio,
            COALESCE(
              NULLIF(f.admissao_dados->>'data_admissao', '')::DATE,
              movelaria_ponto_data_local(f.criado_em)
            )
          ),
          LEAST(v_fim, v_faltas_ate),
          INTERVAL '1 day'
        ) AS d(dia)
        INNER JOIN movelaria_funcionario_jornada j
          ON j.funcionario_id = f.id AND j.ativo = true
        WHERE EXTRACT(ISODOW FROM d.dia)::INT = ANY(j.dias_uteis)
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
            WHERE m.funcionario_id = f.id
              AND movelaria_ponto_data_local(m.registrado_em) = d.dia
          )
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
            WHERE o.funcionario_id = f.id
              AND o.data = d.dia
              AND o.tipo IN ('folga', 'abono')
          )
      ), 0),
      'chegadas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', to_char(movelaria_ponto_data_local(m.registrado_em), 'YYYY-MM-DD'),
            'hora', to_char(movelaria_ponto_hora_local(m.registrado_em), 'HH24:MI'),
            'atraso_minutos', COALESCE(m.atraso_minutos, 0),
            'tipo', m.tipo
          )
          ORDER BY m.registrado_em
        )
        FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = f.id
          AND m.tipo IN ('entrada', 'retorno_intervalo')
          AND movelaria_ponto_data_local(m.registrado_em) BETWEEN v_inicio AND v_fim
      ), '[]'::jsonb),
      'saidas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', to_char(movelaria_ponto_data_local(m.registrado_em), 'YYYY-MM-DD'),
            'hora', to_char(movelaria_ponto_hora_local(m.registrado_em), 'HH24:MI'),
            'atraso_minutos', COALESCE(m.atraso_minutos, 0),
            'tipo', m.tipo
          )
          ORDER BY m.registrado_em
        )
        FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = f.id
          AND m.tipo IN ('saida_intervalo', 'saida')
          AND movelaria_ponto_data_local(m.registrado_em) BETWEEN v_inicio AND v_fim
      ), '[]'::jsonb)
    ) AS row
    FROM movelaria_funcionarios f
    WHERE f.ativo = true
      AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
  ) sub;

  SELECT COALESCE(SUM((f->>'hora_extra_minutos')::INT), 0)::INT
  INTO v_he_empresa
  FROM jsonb_array_elements(v_funcionarios) f;

  SELECT COALESCE(SUM((f->>'faltas')::INT), 0)::INT
  INTO v_faltas_empresa
  FROM jsonb_array_elements(v_funcionarios) f;

  RETURN jsonb_build_object(
    'periodo', v_periodo,
    'inicio', to_char(v_inicio, 'YYYY-MM-DD'),
    'fim', to_char(v_fim, 'YYYY-MM-DD'),
    'empresa', jsonb_build_object(
      'hora_extra_minutos', v_he_empresa,
      'faltas_total', v_faltas_empresa
    ),
    'funcionarios', v_funcionarios
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Libera quem ficou bloqueado hoje por falta automática prematura
DELETE FROM movelaria_funcionario_ponto_ocorrencias
WHERE tipo = 'falta'
  AND COALESCE(automatica, false) = true
  AND data = movelaria_ponto_data_local();

NOTIFY pgrst, 'reload schema';
