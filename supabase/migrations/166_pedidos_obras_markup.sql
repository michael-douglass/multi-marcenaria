-- ============================================================
-- Pedidos de obra: vínculo com markup, NF e colunas do fluxo
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_usuario_tem_qualquer_perfil(p_perfis TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil = ANY (p_perfis)
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(u.perfis_extras, '{}'::TEXT[])) AS extra(perfil)
          WHERE extra.perfil = ANY (p_perfis)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION movelaria_usuario_tem_qualquer_perfil(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_tem_qualquer_perfil(TEXT[]) TO authenticated;

-- ── Pedidos: colunas do fluxo de obra ─────────────────────────
ALTER TABLE movelaria_pedidos
  ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES movelaria_obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS markup_orcamento_id UUID,
  ADD COLUMN IF NOT EXISTS num_parcelas INTEGER,
  ADD COLUMN IF NOT EXISTS primeiro_vencimento DATE,
  ADD COLUMN IF NOT EXISTS observacao TEXT;

CREATE INDEX IF NOT EXISTS idx_mov_pedidos_obra
  ON movelaria_pedidos(obra_id)
  WHERE obra_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mov_pedidos_obra_ativa
  ON movelaria_pedidos(obra_id)
  WHERE obra_id IS NOT NULL AND status <> 'recusado';

ALTER TABLE movelaria_pedidos_itens
  ADD COLUMN IF NOT EXISTS markup_produto_id UUID,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS valor_unitario_markup NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS valor_unitario_feito NUMERIC(12, 2);

-- ── Anexos (notas fiscais) do pedido ──────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_pedidos_anexos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID        NOT NULL REFERENCES movelaria_pedidos(id) ON DELETE CASCADE,
  nome_arquivo TEXT        NOT NULL,
  tipo_mime    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  preview_path TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_pedidos_anexos_pedido
  ON movelaria_pedidos_anexos(pedido_id);

ALTER TABLE movelaria_pedidos_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anexos_pedido_select" ON movelaria_pedidos_anexos;
CREATE POLICY "anexos_pedido_select" ON movelaria_pedidos_anexos
  FOR SELECT TO authenticated
  USING (
    movelaria_usuario_tem_qualquer_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
    )
  );

DROP POLICY IF EXISTS "anexos_pedido_insert" ON movelaria_pedidos_anexos;
CREATE POLICY "anexos_pedido_insert" ON movelaria_pedidos_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_tem_qualquer_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
    )
  );

DROP POLICY IF EXISTS "anexos_pedido_delete" ON movelaria_pedidos_anexos;
CREATE POLICY "anexos_pedido_delete" ON movelaria_pedidos_anexos
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_tem_qualquer_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-pedidos-anexos',
  'movelaria-pedidos-anexos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_anexos_pedido_select" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-pedidos-anexos'
    AND movelaria_usuario_tem_qualquer_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
    )
  );

DROP POLICY IF EXISTS "storage_anexos_pedido_insert" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-pedidos-anexos'
    AND movelaria_usuario_tem_qualquer_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
    )
  );

DROP POLICY IF EXISTS "storage_anexos_pedido_update" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-pedidos-anexos'
    AND movelaria_usuario_tem_qualquer_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
    )
  );

DROP POLICY IF EXISTS "storage_anexos_pedido_delete" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-pedidos-anexos'
    AND movelaria_usuario_tem_qualquer_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
    )
  );

-- ── Itens reais do markup (não só totais) ─────────────────────
CREATE OR REPLACE FUNCTION movelaria_markup_itens_por_leads(p_lead_ids TEXT[])
RETURNS TABLE (
  lead_id          TEXT,
  orcamento_id     UUID,
  titulo           TEXT,
  custo_materiais  NUMERIC,
  custo_servicos   NUMERIC,
  custo_despesas   NUMERIC,
  preco_final      NUMERIC,
  linhas           JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, emp_garbo
AS $$
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
  ) THEN
    RETURN;
  END IF;

  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (m.lead_id)
    m.lead_id::TEXT,
    m.id,
    m.titulo,
    COALESCE((m.modulos->'totais'->>'custo_materiais')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_servicos')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_despesas')::NUMERIC, 0),
    COALESCE(
      NULLIF((m.modulos->'totais'->>'preco_final')::NUMERIC, NULL),
      m.preco_final,
      0
    ),
    COALESCE(m.modulos->'materiais'->'linhas', '[]'::JSONB)
  FROM emp_garbo.markup_orcamentos m
  WHERE m.lead_id IS NOT NULL
    AND m.lead_id::TEXT = ANY (p_lead_ids)
  ORDER BY m.lead_id, m.atualizado_em DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_markup_itens_por_leads(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_markup_itens_por_leads(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_salvar_markup_itens(
  p_orcamento_id UUID,
  p_linhas JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_modulos JSONB;
  v_linhas JSONB;
  v_sum NUMERIC;
  v_fator NUMERIC;
  v_ajustado NUMERIC;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro editam o markup.';
  END IF;

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'Linhas inválidas.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      (elem
        || jsonb_build_object(
          'quantidade', COALESCE((elem->>'quantidade')::NUMERIC, 0),
          'valor_unitario', COALESCE((elem->>'valor_unitario')::NUMERIC, 0),
          'valor_total', ROUND(
            COALESCE((elem->>'quantidade')::NUMERIC, 0)
            * COALESCE((elem->>'valor_unitario')::NUMERIC, 0)
          , 2),
          'ativo', COALESCE((elem->>'ativo')::BOOLEAN, true)
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_linhas
  FROM jsonb_array_elements(p_linhas) AS elem;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE((elem->>'ativo')::BOOLEAN, true)
        THEN COALESCE((elem->>'valor_total')::NUMERIC, 0)
      ELSE 0
    END
  ), 0)
  INTO v_sum
  FROM jsonb_array_elements(v_linhas) AS elem;

  SELECT COALESCE(fator_sobras, 1) INTO v_fator
  FROM emp_garbo.markup_config
  LIMIT 1;

  v_ajustado := ROUND(v_sum * COALESCE(v_fator, 1), 2);

  SELECT COALESCE(modulos, '{}'::JSONB)
  INTO v_modulos
  FROM emp_garbo.markup_orcamentos
  WHERE id = p_orcamento_id;

  IF v_modulos IS NULL THEN
    RAISE EXCEPTION 'Orçamento de markup não encontrado.';
  END IF;

  IF v_modulos->'materiais' IS NULL THEN
    v_modulos := jsonb_set(v_modulos, '{materiais}', '{"linhas":[]}'::JSONB, true);
  END IF;
  IF v_modulos->'totais' IS NULL THEN
    v_modulos := jsonb_set(v_modulos, '{totais}', '{}'::JSONB, true);
  END IF;

  v_modulos := jsonb_set(v_modulos, '{materiais,linhas}', v_linhas, true);
  v_modulos := jsonb_set(v_modulos, '{totais,custo_materiais}', to_jsonb(v_sum), true);
  v_modulos := jsonb_set(v_modulos, '{totais,custo_materiais_ajustado}', to_jsonb(v_ajustado), true);

  UPDATE emp_garbo.markup_orcamentos
  SET
    modulos = v_modulos,
    atualizado_em = NOW()
  WHERE id = p_orcamento_id;

  RETURN jsonb_build_object(
    'orcamento_id', p_orcamento_id,
    'custo_materiais', v_sum,
    'custo_materiais_ajustado', v_ajustado,
    'linhas', v_linhas
  );
END;
$$;

REVOKE ALL ON FUNCTION movelaria_salvar_markup_itens(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_salvar_markup_itens(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_criar_markup_orcamento_lead(
  p_lead_id TEXT,
  p_titulo TEXT,
  p_linhas JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_id UUID;
  v_linhas JSONB;
  v_sum NUMERIC;
  v_fator NUMERIC;
  v_ajustado NUMERIC;
  v_modulos JSONB;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro criam markup.';
  END IF;

  IF p_lead_id IS NULL OR btrim(p_lead_id) = '' THEN
    RAISE EXCEPTION 'Lead obrigatório.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      (elem
        || jsonb_build_object(
          'quantidade', COALESCE((elem->>'quantidade')::NUMERIC, 0),
          'valor_unitario', COALESCE((elem->>'valor_unitario')::NUMERIC, 0),
          'valor_total', ROUND(
            COALESCE((elem->>'quantidade')::NUMERIC, 0)
            * COALESCE((elem->>'valor_unitario')::NUMERIC, 0)
          , 2),
          'ativo', COALESCE((elem->>'ativo')::BOOLEAN, true)
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_linhas
  FROM jsonb_array_elements(COALESCE(p_linhas, '[]'::JSONB)) AS elem;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE((elem->>'ativo')::BOOLEAN, true)
        THEN COALESCE((elem->>'valor_total')::NUMERIC, 0)
      ELSE 0
    END
  ), 0)
  INTO v_sum
  FROM jsonb_array_elements(v_linhas) AS elem;

  SELECT COALESCE(fator_sobras, 1) INTO v_fator
  FROM emp_garbo.markup_config
  LIMIT 1;

  v_ajustado := ROUND(v_sum * COALESCE(v_fator, 1), 2);
  v_modulos := jsonb_build_object(
    'materiais', jsonb_build_object('linhas', v_linhas),
    'totais', jsonb_build_object(
      'custo_materiais', v_sum,
      'custo_materiais_ajustado', v_ajustado,
      'custo_servicos', 0,
      'custo_despesas', 0,
      'preco_final', 0
    )
  );

  INSERT INTO emp_garbo.markup_orcamentos (
    lead_id, titulo, status, modulos, preco_final, atualizado_em
  )
  VALUES (
    p_lead_id::BIGINT,
    COALESCE(NULLIF(btrim(p_titulo), ''), 'Pedido de materiais'),
    'rascunho',
    v_modulos,
    0,
    NOW()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_criar_markup_orcamento_lead(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_criar_markup_orcamento_lead(TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_markup_catalogo_listar()
RETURNS TABLE (
  id                UUID,
  categoria_id      UUID,
  categoria_nome    TEXT,
  nome              TEXT,
  variacao          TEXT,
  preco_unitario    NUMERIC,
  unidade           TEXT,
  quantidade_padrao NUMERIC,
  ativo             BOOLEAN,
  ordem             INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, emp_garbo
AS $$
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.categoria_id,
    c.nome,
    p.nome,
    p.variacao,
    p.preco_unitario,
    p.unidade,
    p.quantidade_padrao,
    p.ativo,
    p.ordem
  FROM emp_garbo.markup_produtos p
  LEFT JOIN emp_garbo.markup_categorias c ON c.id = p.categoria_id
  ORDER BY COALESCE(c.ordem, 999), p.ordem, p.nome;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_markup_catalogo_listar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_markup_catalogo_listar() TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_markup_catalogo_categorias()
RETURNS TABLE (
  id     UUID,
  nome   TEXT,
  ordem  INTEGER,
  ativo  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, emp_garbo
AS $$
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.nome, c.ordem, c.ativo
  FROM emp_garbo.markup_categorias c
  ORDER BY c.ordem, c.nome;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_markup_catalogo_categorias() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_markup_catalogo_categorias() TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_markup_catalogo_salvar_produto(
  p_id                UUID,
  p_categoria_id      UUID,
  p_nome              TEXT,
  p_variacao          TEXT,
  p_preco_unitario    NUMERIC,
  p_unidade           TEXT,
  p_quantidade_padrao NUMERIC,
  p_ativo             BOOLEAN,
  p_ordem             INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro editam o catálogo.';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.markup_produtos (
      categoria_id, nome, variacao, preco_unitario, unidade,
      quantidade_padrao, ativo, ordem, atualizado_em
    )
    VALUES (
      p_categoria_id,
      btrim(p_nome),
      NULLIF(btrim(COALESCE(p_variacao, '')), ''),
      COALESCE(p_preco_unitario, 0),
      COALESCE(NULLIF(btrim(p_unidade), ''), 'un'),
      p_quantidade_padrao,
      COALESCE(p_ativo, true),
      COALESCE(p_ordem, 0),
      NOW()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.markup_produtos
    SET
      categoria_id = p_categoria_id,
      nome = btrim(p_nome),
      variacao = NULLIF(btrim(COALESCE(p_variacao, '')), ''),
      preco_unitario = COALESCE(p_preco_unitario, 0),
      unidade = COALESCE(NULLIF(btrim(p_unidade), ''), 'un'),
      quantidade_padrao = p_quantidade_padrao,
      ativo = COALESCE(p_ativo, true),
      ordem = COALESCE(p_ordem, 0),
      atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado.';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_markup_catalogo_salvar_produto(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_markup_catalogo_salvar_produto(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BOOLEAN, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_markup_catalogo_salvar_categoria(
  p_id    UUID,
  p_nome  TEXT,
  p_ordem INTEGER,
  p_ativo BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_id UUID;
  v_slug TEXT;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro editam categorias.';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome da categoria é obrigatório.';
  END IF;

  v_slug := lower(regexp_replace(btrim(p_nome), '[^a-zA-Z0-9]+', '-', 'g'));

  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.markup_categorias (nome, slug, ordem, ativo)
    VALUES (
      btrim(p_nome),
      NULLIF(v_slug, ''),
      COALESCE(p_ordem, 0),
      COALESCE(p_ativo, true)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.markup_categorias
    SET
      nome = btrim(p_nome),
      ordem = COALESCE(p_ordem, 0),
      ativo = COALESCE(p_ativo, true)
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_markup_catalogo_salvar_categoria(UUID, TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_markup_catalogo_salvar_categoria(UUID, TEXT, INTEGER, BOOLEAN) TO authenticated;
