-- ============================================================
-- Projetos de produção: quadro paralelo à Agenda de Obras
-- Schema emp_garbo (mesmo padrão do ateliê lead_projetos)
-- ============================================================

CREATE OR REPLACE FUNCTION emp_garbo.me_can_access_producao(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
  SELECT
    p_uid IS NOT NULL
    AND (
      public.me_is_super_admin(p_uid)
      OR public.me_get_empresa_role('emp_garbo', p_uid) = 'admin'
      OR public.me_empresa_has_any_role('emp_garbo', ARRAY['vendedor','projetista','projetista_admin'], p_uid)
      OR public.movelaria_meu_perfil() = 'montador_admin'
    );
$$;

CREATE OR REPLACE FUNCTION emp_garbo.me_can_config_producao(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
  SELECT
    p_uid IS NOT NULL
    AND (
      public.me_is_super_admin(p_uid)
      OR public.me_get_empresa_role('emp_garbo', p_uid) = 'admin'
      OR public.me_empresa_has_any_role('emp_garbo', ARRAY['projetista_admin'], p_uid)
      OR public.movelaria_meu_perfil() = 'montador_admin'
    );
$$;

CREATE TABLE IF NOT EXISTS emp_garbo.producao_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emp_garbo.obra_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL UNIQUE REFERENCES public.movelaria_obras(id) ON DELETE CASCADE,
  lead_id BIGINT NOT NULL,
  stage_id UUID NOT NULL REFERENCES emp_garbo.producao_stages(id),
  responsavel_id UUID,
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_producao_stage ON emp_garbo.obra_producao(stage_id);
CREATE INDEX IF NOT EXISTS idx_obra_producao_lead ON emp_garbo.obra_producao(lead_id);

CREATE TABLE IF NOT EXISTS emp_garbo.obra_producao_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_producao_id UUID NOT NULL REFERENCES emp_garbo.obra_producao(id) ON DELETE CASCADE,
  lead_id BIGINT NOT NULL,
  autor_id UUID NOT NULL,
  canal TEXT NOT NULL DEFAULT 'obras' CHECK (canal IN ('obras', 'vendas')),
  mensagem TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'conversa' CHECK (tipo IN ('envio', 'reenvio', 'conversa')),
  imagem_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_producao_notas_card ON emp_garbo.obra_producao_notas(obra_producao_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_obra_producao_notas_lead_canal ON emp_garbo.obra_producao_notas(lead_id, canal, criado_em);

INSERT INTO emp_garbo.producao_stages (nome, cor, ordem, ativo, is_default)
SELECT * FROM (VALUES
  ('Projetos de produção pendentes', 'warning', 0, true, true),
  ('Projeto iniciado', 'primary', 1, true, false),
  ('Projetos concluídos', 'success', 2, true, false)
) AS v(nome, cor, ordem, ativo, is_default)
WHERE NOT EXISTS (SELECT 1 FROM emp_garbo.producao_stages LIMIT 1);

ALTER TABLE emp_garbo.producao_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE emp_garbo.obra_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE emp_garbo.obra_producao_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_stages_select ON emp_garbo.producao_stages;
CREATE POLICY producao_stages_select ON emp_garbo.producao_stages
  FOR SELECT TO authenticated USING (emp_garbo.me_can_access_producao(auth.uid()));

DROP POLICY IF EXISTS producao_stages_insert ON emp_garbo.producao_stages;
CREATE POLICY producao_stages_insert ON emp_garbo.producao_stages
  FOR INSERT TO authenticated WITH CHECK (emp_garbo.me_can_config_producao(auth.uid()));

DROP POLICY IF EXISTS producao_stages_update ON emp_garbo.producao_stages;
CREATE POLICY producao_stages_update ON emp_garbo.producao_stages
  FOR UPDATE TO authenticated
  USING (emp_garbo.me_can_config_producao(auth.uid()))
  WITH CHECK (emp_garbo.me_can_config_producao(auth.uid()));

DROP POLICY IF EXISTS producao_stages_delete ON emp_garbo.producao_stages;
CREATE POLICY producao_stages_delete ON emp_garbo.producao_stages
  FOR DELETE TO authenticated USING (emp_garbo.me_can_config_producao(auth.uid()));

DROP POLICY IF EXISTS obra_producao_select ON emp_garbo.obra_producao;
CREATE POLICY obra_producao_select ON emp_garbo.obra_producao
  FOR SELECT TO authenticated USING (emp_garbo.me_can_access_producao(auth.uid()));

DROP POLICY IF EXISTS obra_producao_insert ON emp_garbo.obra_producao;
CREATE POLICY obra_producao_insert ON emp_garbo.obra_producao
  FOR INSERT TO authenticated WITH CHECK (emp_garbo.me_can_access_producao(auth.uid()));

DROP POLICY IF EXISTS obra_producao_update ON emp_garbo.obra_producao;
CREATE POLICY obra_producao_update ON emp_garbo.obra_producao
  FOR UPDATE TO authenticated
  USING (emp_garbo.me_can_access_producao(auth.uid()))
  WITH CHECK (emp_garbo.me_can_access_producao(auth.uid()));

DROP POLICY IF EXISTS obra_producao_delete ON emp_garbo.obra_producao;
CREATE POLICY obra_producao_delete ON emp_garbo.obra_producao
  FOR DELETE TO authenticated USING (emp_garbo.me_can_config_producao(auth.uid()));

DROP POLICY IF EXISTS obra_producao_notas_select ON emp_garbo.obra_producao_notas;
CREATE POLICY obra_producao_notas_select ON emp_garbo.obra_producao_notas
  FOR SELECT TO authenticated USING (emp_garbo.me_can_access_producao(auth.uid()));

DROP POLICY IF EXISTS obra_producao_notas_insert ON emp_garbo.obra_producao_notas;
CREATE POLICY obra_producao_notas_insert ON emp_garbo.obra_producao_notas
  FOR INSERT TO authenticated WITH CHECK (
    emp_garbo.me_can_access_producao(auth.uid()) AND autor_id = auth.uid()
  );

DROP POLICY IF EXISTS obra_producao_notas_delete ON emp_garbo.obra_producao_notas;
CREATE POLICY obra_producao_notas_delete ON emp_garbo.obra_producao_notas
  FOR DELETE TO authenticated USING (
    emp_garbo.me_can_config_producao(auth.uid()) OR autor_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON emp_garbo.producao_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON emp_garbo.obra_producao TO authenticated;
GRANT SELECT, INSERT, DELETE ON emp_garbo.obra_producao_notas TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_criar_obra_producao(
  p_obra_id UUID,
  p_lead_id BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_id UUID;
  v_stage UUID;
BEGIN
  SELECT id INTO v_id FROM emp_garbo.obra_producao WHERE obra_id = p_obra_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id INTO v_stage
  FROM emp_garbo.producao_stages
  WHERE ativo = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'Nenhuma coluna de produção configurada';
  END IF;

  INSERT INTO emp_garbo.obra_producao (obra_id, lead_id, stage_id)
  VALUES (p_obra_id, p_lead_id, v_stage)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_criar_obra_producao(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_criar_obra_producao(UUID, BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_criar_obra_de_orcamento(
  p_orcamento_id uuid,
  p_cliente_id uuid,
  p_cliente_nome text,
  p_lead_id text DEFAULT NULL,
  p_lousa text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_id UUID;
  v_lead BIGINT;
BEGIN
  INSERT INTO movelaria_obras (
    origem_orcamento_id, origem_lead_id,
    cliente_id, cliente_nome, lousa, status_kanban
  ) VALUES (
    p_orcamento_id, p_lead_id,
    p_cliente_id, p_cliente_nome, p_lousa, 'datas_em_aberto'
  )
  RETURNING id INTO v_id;

  BEGIN
    IF p_lead_id IS NOT NULL AND btrim(p_lead_id) <> '' THEN
      v_lead := p_lead_id::BIGINT;
      PERFORM public.movelaria_criar_obra_producao(v_id, v_lead);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'obra_producao não criada: %', SQLERRM;
  END;

  RETURN v_id;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE emp_garbo.obra_producao;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE emp_garbo.obra_producao_notas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
