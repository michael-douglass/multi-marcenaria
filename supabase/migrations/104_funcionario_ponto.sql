-- ============================================================
-- GARBO Movelaria — Ponto Eletrônico REP-P
-- Migration 104
-- ============================================================

-- ── 1. Extensão categoria documentos ─────────────────────────
ALTER TABLE movelaria_funcionario_documentos
  DROP CONSTRAINT IF EXISTS movelaria_funcionario_documentos_categoria_check;

ALTER TABLE movelaria_funcionario_documentos
  ADD CONSTRAINT movelaria_funcionario_documentos_categoria_check
  CHECK (categoria IN ('admissao', 'rh', 'outros', 'ponto'));

-- ── 2. Config REP-P ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_rep_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social    TEXT NOT NULL DEFAULT 'GARBO MOVELARIA',
  cnpj            TEXT NOT NULL DEFAULT '',
  inpi_registro   TEXT,
  versao_software TEXT NOT NULL DEFAULT '1.0.0',
  certificado_valido_ate DATE,
  nsr_atual       BIGINT NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO movelaria_rep_config (razao_social, cnpj)
SELECT 'GARBO MOVELARIA', COALESCE((SELECT cnpj FROM movelaria_recibo_prestador_config WHERE ativo = true LIMIT 1), '')
WHERE NOT EXISTS (SELECT 1 FROM movelaria_rep_config LIMIT 1);

-- ── 3. Jornada ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_funcionario_jornada (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id          UUID NOT NULL UNIQUE REFERENCES movelaria_funcionarios(id) ON DELETE CASCADE,
  hora_entrada            TIME NOT NULL DEFAULT '08:00',
  hora_saida_intervalo    TIME NOT NULL DEFAULT '12:00',
  hora_retorno_intervalo  TIME NOT NULL DEFAULT '13:00',
  hora_saida              TIME NOT NULL DEFAULT '17:00',
  tolerancia_minutos      INT NOT NULL DEFAULT 5 CHECK (tolerancia_minutos >= 0 AND tolerancia_minutos <= 60),
  dias_uteis              INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  ativo                   BOOLEAN NOT NULL DEFAULT true,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_func_jornada_funcionario
  ON movelaria_funcionario_jornada(funcionario_id);

-- ── 4. NSR global ────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS movelaria_ponto_nsr_seq START 1;

-- ── 5. Marcações (imutáveis) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_funcionario_ponto_marcacoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nsr                   BIGINT NOT NULL UNIQUE DEFAULT nextval('movelaria_ponto_nsr_seq'),
  funcionario_id        UUID NOT NULL REFERENCES movelaria_funcionarios(id) ON DELETE CASCADE,
  usuario_id            UUID NOT NULL REFERENCES movelaria_usuarios(id) ON DELETE RESTRICT,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida')),
  registrado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  precisao_metros       DOUBLE PRECISION,
  foto_path             TEXT,
  assinatura_path       TEXT,
  comprovante_pdf_path  TEXT,
  documento_id          UUID REFERENCES movelaria_funcionario_documentos(id) ON DELETE SET NULL,
  hash_sha256           TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'normal'
    CHECK (status IN ('normal', 'atraso', 'irregular')),
  atraso_minutos        INT NOT NULL DEFAULT 0,
  offline               BOOLEAN NOT NULL DEFAULT false,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ponto_marc_funcionario
  ON movelaria_funcionario_ponto_marcacoes(funcionario_id, registrado_em DESC);

CREATE INDEX IF NOT EXISTS idx_ponto_marc_nsr
  ON movelaria_funcionario_ponto_marcacoes(nsr);

-- Imutabilidade AFD
CREATE OR REPLACE FUNCTION movelaria_ponto_marcacao_imutavel()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Marcações de ponto são imutáveis (REP-P).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ponto_marcacao_no_update ON movelaria_funcionario_ponto_marcacoes;
CREATE TRIGGER trg_ponto_marcacao_no_update
  BEFORE UPDATE ON movelaria_funcionario_ponto_marcacoes
  FOR EACH ROW EXECUTE FUNCTION movelaria_ponto_marcacao_imutavel();

DROP TRIGGER IF EXISTS trg_ponto_marcacao_no_delete ON movelaria_funcionario_ponto_marcacoes;
CREATE TRIGGER trg_ponto_marcacao_no_delete
  BEFORE DELETE ON movelaria_funcionario_ponto_marcacoes
  FOR EACH ROW EXECUTE FUNCTION movelaria_ponto_marcacao_imutavel();

-- ── 6. Ocorrências (folga, falta, abono) ─────────────────────
CREATE TABLE IF NOT EXISTS movelaria_funcionario_ponto_ocorrencias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id  UUID NOT NULL REFERENCES movelaria_funcionarios(id) ON DELETE CASCADE,
  data            DATE NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('folga', 'falta', 'abono')),
  observacao      TEXT,
  automatica      BOOLEAN NOT NULL DEFAULT false,
  registrado_por  UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funcionario_id, data, tipo)
);

CREATE INDEX IF NOT EXISTS idx_ponto_ocor_funcionario
  ON movelaria_funcionario_ponto_ocorrencias(funcionario_id, data DESC);

-- ── 7. Arquivos fiscais REP ───────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_rep_arquivos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL CHECK (tipo IN ('afd', 'aej', 'espelho')),
  periodo_inicio  DATE NOT NULL,
  periodo_fim     DATE NOT NULL,
  arquivo_path    TEXT NOT NULL,
  assinatura_path TEXT,
  hash_sha256     TEXT,
  gerado_por      UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. Helpers ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_ponto_data_local(p_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE AS $$
  SELECT (p_ts AT TIME ZONE 'America/Sao_Paulo')::DATE;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION movelaria_ponto_hora_local(p_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS TIME AS $$
  SELECT (p_ts AT TIME ZONE 'America/Sao_Paulo')::TIME;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION movelaria_ponto_dia_semana_local(p_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS INT AS $$
  SELECT EXTRACT(ISODOW FROM (p_ts AT TIME ZONE 'America/Sao_Paulo'))::INT;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION movelaria_ponto_proximo_tipo(
  p_funcionario_id UUID,
  p_data DATE DEFAULT movelaria_ponto_data_local()
)
RETURNS TEXT AS $$
DECLARE
  v_tipos TEXT[] := ARRAY['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];
  v_feito TEXT[];
  v_t TEXT;
BEGIN
  SELECT COALESCE(array_agg(tipo ORDER BY registrado_em), ARRAY[]::TEXT[])
  INTO v_feito
  FROM movelaria_funcionario_ponto_marcacoes
  WHERE funcionario_id = p_funcionario_id
    AND movelaria_ponto_data_local(registrado_em) = p_data;

  FOREACH v_t IN ARRAY v_tipos LOOP
    IF NOT (v_t = ANY(v_feito)) THEN
      RETURN v_t;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ── 9. RLS ───────────────────────────────────────────────────
ALTER TABLE movelaria_funcionario_jornada ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_funcionario_ponto_marcacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_funcionario_ponto_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_rep_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_rep_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ponto_jornada_select" ON movelaria_funcionario_jornada;
CREATE POLICY "ponto_jornada_select" ON movelaria_funcionario_jornada
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ponto_jornada_write" ON movelaria_funcionario_jornada;
CREATE POLICY "ponto_jornada_write" ON movelaria_funcionario_jornada
  FOR ALL TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "ponto_marc_select" ON movelaria_funcionario_ponto_marcacoes;
CREATE POLICY "ponto_marc_select" ON movelaria_funcionario_ponto_marcacoes
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ponto_ocor_select" ON movelaria_funcionario_ponto_ocorrencias;
CREATE POLICY "ponto_ocor_select" ON movelaria_funcionario_ponto_ocorrencias
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ponto_ocor_write" ON movelaria_funcionario_ponto_ocorrencias;
CREATE POLICY "ponto_ocor_write" ON movelaria_funcionario_ponto_ocorrencias
  FOR ALL TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "rep_config_select" ON movelaria_rep_config;
CREATE POLICY "rep_config_select" ON movelaria_rep_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rep_config_write" ON movelaria_rep_config;
CREATE POLICY "rep_config_write" ON movelaria_rep_config
  FOR ALL TO authenticated
  USING (movelaria_meu_perfil() = 'administrador')
  WITH CHECK (movelaria_meu_perfil() = 'administrador');

DROP POLICY IF EXISTS "rep_arquivos_select" ON movelaria_rep_arquivos;
CREATE POLICY "rep_arquivos_select" ON movelaria_rep_arquivos
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "rep_arquivos_write" ON movelaria_rep_arquivos;
CREATE POLICY "rep_arquivos_write" ON movelaria_rep_arquivos
  FOR ALL TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

-- Storage: ponto paths dentro da pasta do funcionário
DROP POLICY IF EXISTS "storage_func_doc_ponto_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_ponto_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-funcionario-documentos'
    AND (
      movelaria_meu_perfil() IN ('administrador', 'financeiro')
      OR EXISTS (
        SELECT 1 FROM movelaria_funcionarios f
        WHERE f.id::text = split_part(name, '/', 1) AND f.usuario_id = auth.uid()
      )
    )
  );

-- ── 10. RPC: salvar jornada ───────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_ponto_salvar_jornada(
  p_funcionario_id UUID,
  p_hora_entrada TIME,
  p_hora_saida_intervalo TIME,
  p_hora_retorno_intervalo TIME,
  p_hora_saida TIME,
  p_tolerancia_minutos INT DEFAULT 5,
  p_dias_uteis INT[] DEFAULT ARRAY[1,2,3,4,5],
  p_ativo BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionario_jornada%ROWTYPE;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para configurar jornada.';
  END IF;

  INSERT INTO movelaria_funcionario_jornada (
    funcionario_id, hora_entrada, hora_saida_intervalo,
    hora_retorno_intervalo, hora_saida, tolerancia_minutos, dias_uteis, ativo
  ) VALUES (
    p_funcionario_id, p_hora_entrada, p_hora_saida_intervalo,
    p_hora_retorno_intervalo, p_hora_saida, p_tolerancia_minutos, p_dias_uteis, p_ativo
  )
  ON CONFLICT (funcionario_id) DO UPDATE SET
    hora_entrada = EXCLUDED.hora_entrada,
    hora_saida_intervalo = EXCLUDED.hora_saida_intervalo,
    hora_retorno_intervalo = EXCLUDED.hora_retorno_intervalo,
    hora_saida = EXCLUDED.hora_saida,
    tolerancia_minutos = EXCLUDED.tolerancia_minutos,
    dias_uteis = EXCLUDED.dias_uteis,
    ativo = EXCLUDED.ativo,
    atualizado_em = NOW()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 11. RPC: bater ponto ──────────────────────────────────────
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

  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias
    WHERE funcionario_id = v_funcionario.id AND data = v_data AND tipo IN ('folga', 'falta')
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

-- ── 12. RPC: status do dia ────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_ponto_status_dia(p_funcionario_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_func_id UUID;
  v_data DATE := movelaria_ponto_data_local();
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_proximo TEXT;
  v_ocorrencia TEXT;
  v_marcacoes JSONB;
  v_status_dia TEXT := 'pendente';
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

  SELECT tipo INTO v_ocorrencia FROM movelaria_funcionario_ponto_ocorrencias
  WHERE funcionario_id = v_func_id AND data = v_data
  ORDER BY criado_em DESC LIMIT 1;

  v_proximo := movelaria_ponto_proximo_tipo(v_func_id, v_data);

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.registrado_em), '[]'::jsonb)
  INTO v_marcacoes
  FROM movelaria_funcionario_ponto_marcacoes m
  WHERE m.funcionario_id = v_func_id AND movelaria_ponto_data_local(m.registrado_em) = v_data;

  IF v_ocorrencia = 'folga' THEN v_status_dia := 'folga';
  ELSIF v_ocorrencia = 'falta' THEN v_status_dia := 'falta';
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_marcacoes) e WHERE e->>'status' = 'atraso') THEN v_status_dia := 'atraso';
  ELSIF v_proximo IS NULL THEN v_status_dia := 'completo';
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

-- ── 13. RPC: ocorrências ──────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_ponto_salvar_ocorrencia(
  p_funcionario_id UUID,
  p_data DATE,
  p_tipo TEXT,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionario_ponto_ocorrencias%ROWTYPE;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  IF p_tipo NOT IN ('folga', 'falta', 'abono') THEN
    RAISE EXCEPTION 'Tipo de ocorrência inválido.';
  END IF;

  INSERT INTO movelaria_funcionario_ponto_ocorrencias (
    funcionario_id, data, tipo, observacao, registrado_por
  ) VALUES (
    p_funcionario_id, p_data, p_tipo, p_observacao, auth.uid()
  )
  ON CONFLICT (funcionario_id, data, tipo) DO UPDATE SET
    observacao = EXCLUDED.observacao,
    registrado_por = auth.uid()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_remover_ocorrencia(p_id UUID)
RETURNS VOID AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  DELETE FROM movelaria_funcionario_ponto_ocorrencias WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 14. RPC: atualizar path comprovante ───────────────────────
CREATE OR REPLACE FUNCTION movelaria_ponto_atualizar_comprovante(
  p_marcacao_id UUID,
  p_comprovante_path TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Permite service role / edge function via SECURITY DEFINER
  UPDATE movelaria_funcionario_ponto_marcacoes
  SET comprovante_pdf_path = p_comprovante_path
  WHERE id = p_marcacao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bypass imutabilidade para comprovante path only — drop old trigger approach
DROP TRIGGER IF EXISTS trg_ponto_marcacao_no_update ON movelaria_funcionario_ponto_marcacoes;

CREATE OR REPLACE FUNCTION movelaria_ponto_marcacao_guard_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nsr IS DISTINCT FROM NEW.nsr
    OR OLD.funcionario_id IS DISTINCT FROM NEW.funcionario_id
    OR OLD.usuario_id IS DISTINCT FROM NEW.usuario_id
    OR OLD.tipo IS DISTINCT FROM NEW.tipo
    OR OLD.registrado_em IS DISTINCT FROM NEW.registrado_em
    OR OLD.latitude IS DISTINCT FROM NEW.latitude
    OR OLD.longitude IS DISTINCT FROM NEW.longitude
    OR OLD.foto_path IS DISTINCT FROM NEW.foto_path
    OR OLD.assinatura_path IS DISTINCT FROM NEW.assinatura_path
    OR OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.atraso_minutos IS DISTINCT FROM NEW.atraso_minutos
  THEN
    RAISE EXCEPTION 'Marcações de ponto são imutáveis (REP-P).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ponto_marcacao_guard_update
  BEFORE UPDATE ON movelaria_funcionario_ponto_marcacoes
  FOR EACH ROW EXECUTE FUNCTION movelaria_ponto_marcacao_guard_update();

-- ── 15. Job: faltas automáticas ───────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_ponto_detectar_faltas(p_data DATE DEFAULT movelaria_ponto_data_local(NOW() - INTERVAL '1 day'))
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT j.funcionario_id
    FROM movelaria_funcionario_jornada j
    JOIN movelaria_funcionarios f ON f.id = j.funcionario_id AND f.ativo = true
    WHERE j.ativo = true
      AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
      AND EXTRACT(ISODOW FROM p_data) = ANY(j.dias_uteis)
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = j.funcionario_id
          AND movelaria_ponto_data_local(m.registrado_em) = p_data
      )
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = j.funcionario_id AND o.data = p_data
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

-- ── 16. View resumo para cards ────────────────────────────────
CREATE OR REPLACE VIEW movelaria_funcionario_ponto_resumo AS
SELECT
  f.id AS funcionario_id,
  j.hora_entrada,
  j.hora_saida,
  j.ativo AS jornada_ativa,
  (
    SELECT movelaria_ponto_status_dia(f.id)->>'status_dia'
  ) AS status_hoje,
  (
    SELECT COUNT(*)::INT FROM movelaria_funcionario_ponto_marcacoes m
    WHERE m.funcionario_id = f.id
      AND movelaria_ponto_data_local(m.registrado_em) >= date_trunc('month', movelaria_ponto_data_local())::DATE
  ) AS batidas_mes
FROM movelaria_funcionarios f
LEFT JOIN movelaria_funcionario_jornada j ON j.funcionario_id = f.id;

GRANT SELECT ON movelaria_funcionario_ponto_resumo TO authenticated;
