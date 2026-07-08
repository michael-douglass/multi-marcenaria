-- ============================================================
-- GARBO Movelaria — Funcionários RH + Recibos Assinados
-- Migration 097
-- ============================================================

-- ── 1. Tabela principal ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_funcionarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  cpf             TEXT,
  telefone        TEXT,
  email           TEXT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('montador', 'montador_admin', 'administrador_obras')),
  usuario_id      UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  admissao_token  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  admissao_status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (admissao_status IN ('pendente', 'preenchido_funcionario', 'completo')),
  admissao_dados  JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_usuario
  ON movelaria_funcionarios(usuario_id)
  WHERE usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_funcionarios_tipo ON movelaria_funcionarios(tipo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_admissao_token ON movelaria_funcionarios(admissao_token);

-- ── 2. Documentos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_funcionario_documentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id  UUID NOT NULL REFERENCES movelaria_funcionarios(id) ON DELETE CASCADE,
  categoria       TEXT NOT NULL DEFAULT 'rh'
    CHECK (categoria IN ('admissao', 'rh', 'outros')),
  tipo_documento  TEXT NOT NULL,
  nome_arquivo    TEXT NOT NULL,
  tipo_mime       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  preview_path    TEXT,
  preview_paths   JSONB,
  kind            TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'pdf')),
  origem          TEXT NOT NULL DEFAULT 'admin'
    CHECK (origem IN ('admin', 'funcionario_publico')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_func_doc_funcionario
  ON movelaria_funcionario_documentos(funcionario_id);

-- ── 3. Recibos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_funcionario_recibos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id        UUID NOT NULL REFERENCES movelaria_funcionarios(id) ON DELETE CASCADE,
  conta_pagar_id        UUID REFERENCES movelaria_contas_pagar(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'gerado'
    CHECK (status IN ('gerado', 'aguardando_assinatura', 'assinado')),
  texto_recibo          TEXT NOT NULL DEFAULT '',
  arquivo_original_path TEXT,
  arquivo_assinado_path TEXT,
  valor                 NUMERIC(12,2),
  data_pagamento        DATE,
  enviado_em            TIMESTAMPTZ,
  assinado_em           TIMESTAMPTZ,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_func_recibo_conta
  ON movelaria_funcionario_recibos(conta_pagar_id)
  WHERE conta_pagar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_func_recibo_funcionario
  ON movelaria_funcionario_recibos(funcionario_id);

-- ── 4. Template recibo prestador ──────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_recibo_prestador_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_texto TEXT NOT NULL DEFAULT
    'RECIBO DE PAGAMENTO

Recebi de {{nome_empresa}} a importância de {{valor_pagamento}} referente a {{descricao_pagamento}}.

Data do pagamento: {{data_pagamento}}

Prestador: {{nome_prestador}}
CPF: {{cpf_prestador}}

{{nome_empresa}}
CNPJ: {{cnpj}}',
  cnpj           TEXT NOT NULL DEFAULT '',
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO movelaria_recibo_prestador_config (template_texto, cnpj)
SELECT
  'RECIBO DE PAGAMENTO

Recebi de {{nome_empresa}} a importância de {{valor_pagamento}} referente a {{descricao_pagamento}}.

Data do pagamento: {{data_pagamento}}

Prestador: {{nome_prestador}}
CPF: {{cpf_prestador}}

{{nome_empresa}}
CNPJ: {{cnpj}}',
  COALESCE((SELECT cnpj FROM movelaria_recibo_config WHERE ativo = true LIMIT 1), '')
WHERE NOT EXISTS (SELECT 1 FROM movelaria_recibo_prestador_config LIMIT 1);

-- ── 5. Helpers ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_funcionario_por_usuario(p_usuario_id UUID)
RETURNS UUID AS $$
  SELECT id FROM movelaria_funcionarios
  WHERE usuario_id = p_usuario_id AND ativo = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_gerar_texto_recibo_prestador(
  p_prestador_id UUID,
  p_valor NUMERIC,
  p_data_pagamento DATE,
  p_descricao TEXT
)
RETURNS TEXT AS $$
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
  v_texto := replace(v_texto, '{{nome_empresa}}', 'GARBO MOVELARIA');
  v_texto := replace(v_texto, '{{cnpj}}', COALESCE(v_config.cnpj, ''));
  v_texto := replace(v_texto, '{{nome_prestador}}', COALESCE(v_nome, ''));
  v_texto := replace(v_texto, '{{cpf_prestador}}', COALESCE(v_cpf, ''));
  v_texto := replace(v_texto, '{{valor_pagamento}}', 'R$ ' || TO_CHAR(COALESCE(p_valor, 0), 'FM999G999G990D00'));
  v_texto := replace(v_texto, '{{data_pagamento}}', TO_CHAR(COALESCE(p_data_pagamento, CURRENT_DATE), 'DD/MM/YYYY'));
  v_texto := replace(v_texto, '{{descricao_pagamento}}', COALESCE(NULLIF(TRIM(p_descricao), ''), 'Pagamento de serviços'));
  RETURN v_texto;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
   SET search_path = public;

-- ── 6. Trigger recibo ao pagar CP ─────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_funcionario_recibo_ao_pagar_cp()
RETURNS TRIGGER AS $$
DECLARE
  v_funcionario_id UUID;
  v_texto TEXT;
  v_valor NUMERIC;
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('pago') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_funcionario_id
  FROM movelaria_funcionarios
  WHERE usuario_id = NEW.prestador_id AND ativo = true
  LIMIT 1;

  IF v_funcionario_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_recibos
    WHERE conta_pagar_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_valor := COALESCE(NEW.valor_pago, NEW.valor_parcela, NEW.valor_total, 0);

  v_texto := movelaria_gerar_texto_recibo_prestador(
    NEW.prestador_id,
    v_valor,
    COALESCE(NEW.data_pagamento, CURRENT_DATE),
    COALESCE(NEW.descricao, NEW.fornecedor_nome, 'Pagamento')
  );

  INSERT INTO movelaria_funcionario_recibos (
    funcionario_id,
    conta_pagar_id,
    status,
    texto_recibo,
    valor,
    data_pagamento
  ) VALUES (
    v_funcionario_id,
    NEW.id,
    'gerado',
    v_texto,
    v_valor,
    COALESCE(NEW.data_pagamento, CURRENT_DATE)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

DROP TRIGGER IF EXISTS trg_funcionario_recibo_ao_pagar_cp ON movelaria_contas_pagar;
CREATE TRIGGER trg_funcionario_recibo_ao_pagar_cp
  AFTER INSERT OR UPDATE OF status, valor_pago, data_pagamento ON movelaria_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_funcionario_recibo_ao_pagar_cp();

-- ── 7. RLS ────────────────────────────────────────────────────
ALTER TABLE movelaria_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_funcionario_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_funcionario_recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_recibo_prestador_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funcionarios_select" ON movelaria_funcionarios;
CREATE POLICY "funcionarios_select" ON movelaria_funcionarios
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS "funcionarios_insert" ON movelaria_funcionarios;
CREATE POLICY "funcionarios_insert" ON movelaria_funcionarios
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "funcionarios_update" ON movelaria_funcionarios;
CREATE POLICY "funcionarios_update" ON movelaria_funcionarios
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "funcionarios_delete" ON movelaria_funcionarios;
CREATE POLICY "funcionarios_delete" ON movelaria_funcionarios
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() = 'administrador');

DROP POLICY IF EXISTS "func_doc_select" ON movelaria_funcionario_documentos;
CREATE POLICY "func_doc_select" ON movelaria_funcionario_documentos
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "func_doc_insert" ON movelaria_funcionario_documentos;
CREATE POLICY "func_doc_insert" ON movelaria_funcionario_documentos
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "func_doc_delete" ON movelaria_funcionario_documentos;
CREATE POLICY "func_doc_delete" ON movelaria_funcionario_documentos
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "func_recibo_select" ON movelaria_funcionario_recibos;
CREATE POLICY "func_recibo_select" ON movelaria_funcionario_recibos
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "func_recibo_update" ON movelaria_funcionario_recibos;
CREATE POLICY "func_recibo_update" ON movelaria_funcionario_recibos
  FOR UPDATE TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR (
      status = 'aguardando_assinatura'
      AND EXISTS (
        SELECT 1 FROM movelaria_funcionarios f
        WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "recibo_prestador_config_select" ON movelaria_recibo_prestador_config;
CREATE POLICY "recibo_prestador_config_select" ON movelaria_recibo_prestador_config
  FOR SELECT TO authenticated USING (true);

-- ── 8. Storage bucket ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-funcionario-documentos',
  'movelaria-funcionario-documentos',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_func_doc_select" ON storage.objects;
CREATE POLICY "storage_func_doc_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-funcionario-documentos'
    AND movelaria_meu_perfil() IS NOT NULL
  );

DROP POLICY IF EXISTS "storage_func_doc_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-funcionario-documentos'
    AND movelaria_meu_perfil() IS NOT NULL
  );

DROP POLICY IF EXISTS "storage_func_doc_update" ON storage.objects;
CREATE POLICY "storage_func_doc_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-funcionario-documentos'
    AND movelaria_meu_perfil() IS NOT NULL
  );

DROP POLICY IF EXISTS "storage_func_doc_delete" ON storage.objects;
CREATE POLICY "storage_func_doc_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-funcionario-documentos'
    AND (
      movelaria_meu_perfil() IN ('administrador', 'financeiro')
      OR EXISTS (
        SELECT 1 FROM movelaria_funcionario_documentos d
        JOIN movelaria_funcionarios f ON f.id = d.funcionario_id
        WHERE d.storage_path = name AND f.usuario_id = auth.uid()
      )
    )
  );

-- Upload público de admissão (path: {funcionario_id}/...)
DROP POLICY IF EXISTS "storage_func_doc_anon_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'movelaria-funcionario-documentos'
    AND EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id::text = split_part(name, '/', 1)
        AND f.admissao_status IN ('pendente', 'preenchido_funcionario')
    )
  );

DROP POLICY IF EXISTS "storage_func_doc_anon_select" ON storage.objects;
CREATE POLICY "storage_func_doc_anon_select" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'movelaria-funcionario-documentos'
    AND EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id::text = split_part(name, '/', 1)
        AND f.admissao_status IN ('pendente', 'preenchido_funcionario', 'completo')
    )
  );

-- ── 9. RPCs ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_admissao_publica_obter(p_token UUID)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionarios%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM movelaria_funcionarios
  WHERE admissao_token = p_token AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link de admissão inválido ou expirado.';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'nome', v_row.nome,
    'tipo', v_row.tipo,
    'admissao_status', v_row.admissao_status,
    'admissao_dados', v_row.admissao_dados,
    'documentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tipo_documento', d.tipo_documento,
        'nome_arquivo', d.nome_arquivo,
        'criado_em', d.criado_em
      ) ORDER BY d.criado_em)
      FROM movelaria_funcionario_documentos d
      WHERE d.funcionario_id = v_row.id AND d.origem = 'funcionario_publico'
    ), '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_admissao_publica_salvar(
  p_token UUID,
  p_dados JSONB,
  p_finalizar BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionarios%ROWTYPE;
  v_status TEXT;
BEGIN
  SELECT * INTO v_row
  FROM movelaria_funcionarios
  WHERE admissao_token = p_token AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link de admissão inválido ou expirado.';
  END IF;

  IF v_row.admissao_status = 'completo' AND p_finalizar THEN
    RAISE EXCEPTION 'Formulário já foi enviado.';
  END IF;

  v_status := CASE
    WHEN p_finalizar THEN 'preenchido_funcionario'
    ELSE CASE WHEN v_row.admissao_status = 'completo' THEN 'completo' ELSE 'pendente' END
  END;

  UPDATE movelaria_funcionarios
  SET
    admissao_dados = COALESCE(admissao_dados, '{}'::jsonb) || COALESCE(p_dados, '{}'::jsonb),
    admissao_status = v_status,
    cpf = COALESCE(NULLIF(p_dados->>'cpf', ''), cpf),
    telefone = COALESCE(NULLIF(p_dados->>'telefone', ''), telefone),
    email = COALESCE(NULLIF(p_dados->>'email', ''), email),
    atualizado_em = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'admissao_status', v_row.admissao_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_admissao_publica_registrar_doc(
  p_token UUID,
  p_tipo_documento TEXT,
  p_nome_arquivo TEXT,
  p_tipo_mime TEXT,
  p_storage_path TEXT,
  p_kind TEXT DEFAULT 'image'
)
RETURNS UUID AS $$
DECLARE
  v_funcionario_id UUID;
  v_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_funcionario_id
  FROM movelaria_funcionarios
  WHERE admissao_token = p_token AND ativo = true;

  IF v_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Link de admissão inválido.';
  END IF;

  DELETE FROM movelaria_funcionario_documentos
  WHERE funcionario_id = v_funcionario_id
    AND tipo_documento = p_tipo_documento
    AND origem = 'funcionario_publico';

  INSERT INTO movelaria_funcionario_documentos (
    id, funcionario_id, categoria, tipo_documento,
    nome_arquivo, tipo_mime, storage_path, kind, origem
  ) VALUES (
    v_id, v_funcionario_id, 'admissao', p_tipo_documento,
    p_nome_arquivo, p_tipo_mime, p_storage_path, p_kind, 'funcionario_publico'
  );

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_funcionario_recibo_enviar_assinatura(p_recibo_id UUID)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE movelaria_funcionario_recibos
  SET status = 'aguardando_assinatura', enviado_em = NOW(), atualizado_em = NOW()
  WHERE id = p_recibo_id AND status IN ('gerado', 'aguardando_assinatura');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo não encontrado ou já assinado.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_funcionario_recibo_assinar(
  p_recibo_id UUID,
  p_assinatura_path TEXT
)
RETURNS void AS $$
DECLARE
  v_funcionario_id UUID;
BEGIN
  SELECT r.funcionario_id INTO v_funcionario_id
  FROM movelaria_funcionario_recibos r
  JOIN movelaria_funcionarios f ON f.id = r.funcionario_id
  WHERE r.id = p_recibo_id
    AND r.status = 'aguardando_assinatura'
    AND f.usuario_id = auth.uid();

  IF v_funcionario_id IS NULL AND movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Recibo não disponível para assinatura.';
  END IF;

  UPDATE movelaria_funcionario_recibos
  SET
    status = 'assinado',
    arquivo_assinado_path = p_assinatura_path,
    assinado_em = NOW(),
    atualizado_em = NOW()
  WHERE id = p_recibo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_listar_recibos_prestador()
RETURNS SETOF movelaria_funcionario_recibos AS $$
DECLARE
  v_funcionario_id UUID;
BEGIN
  SELECT id INTO v_funcionario_id
  FROM movelaria_funcionarios
  WHERE usuario_id = auth.uid() AND ativo = true;

  IF v_funcionario_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.*
  FROM movelaria_funcionario_recibos r
  WHERE r.funcionario_id = v_funcionario_id
  ORDER BY r.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

REVOKE ALL ON FUNCTION movelaria_admissao_publica_obter(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_admissao_publica_obter(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION movelaria_admissao_publica_salvar(UUID, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_admissao_publica_salvar(UUID, JSONB, BOOLEAN) TO anon, authenticated;

REVOKE ALL ON FUNCTION movelaria_admissao_publica_registrar_doc(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_admissao_publica_registrar_doc(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION movelaria_funcionario_recibo_enviar_assinatura(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_funcionario_recibo_enviar_assinatura(UUID) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_funcionario_recibo_assinar(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_funcionario_recibo_assinar(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_listar_recibos_prestador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_recibos_prestador() TO authenticated;

-- Recarrega cache da API Supabase para reconhecer as novas tabelas
NOTIFY pgrst, 'reload schema';
