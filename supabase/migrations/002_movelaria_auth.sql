-- ============================================================
-- GARBO Movelaria — Tabela de usuários e perfis
-- Prefixo: movelaria_
-- ============================================================

-- ── Tabela de perfis de usuário ───────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_usuarios (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL UNIQUE,
  nome          TEXT,
  perfil        TEXT        NOT NULL DEFAULT 'marceneiro'
                              CHECK (perfil IN ('administrador', 'financeiro', 'marceneiro')),
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Função: retorna o perfil do usuário logado ────────────────
CREATE OR REPLACE FUNCTION movelaria_meu_perfil()
RETURNS TEXT AS $$
  SELECT perfil
  FROM   movelaria_usuarios
  WHERE  id = auth.uid()
    AND  ativo = true
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Trigger: cria perfil automático ao registrar ──────────────
CREATE OR REPLACE FUNCTION movelaria_ao_criar_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO movelaria_usuarios (id, email, perfil)
  VALUES (NEW.id, NEW.email, 'marceneiro')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_movelaria_novo_usuario ON auth.users;
CREATE TRIGGER trg_movelaria_novo_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION movelaria_ao_criar_usuario();

-- ── RLS para movelaria_usuarios ───────────────────────────────
ALTER TABLE movelaria_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_proprio" ON movelaria_usuarios;
CREATE POLICY "usuarios_select_proprio" ON movelaria_usuarios
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admin pode ver todos (via função abaixo, não via policy direta)
-- INSERT/UPDATE via scripts server-side (service_role) apenas

-- ── Função SECURITY DEFINER: lista todos os usuários (admin) ──
CREATE OR REPLACE FUNCTION movelaria_listar_usuarios()
RETURNS TABLE (
  id            UUID,
  email         TEXT,
  nome          TEXT,
  perfil        TEXT,
  ativo         BOOLEAN,
  criado_em     TIMESTAMPTZ
) AS $$
BEGIN
  -- Só executa se o usuário logado for administrador
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem listar usuários';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email, u.nome, u.perfil, u.ativo, u.criado_em
    FROM   movelaria_usuarios u
    ORDER BY u.criado_em ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── Função SECURITY DEFINER: atualiza perfil de usuário (admin)
CREATE OR REPLACE FUNCTION movelaria_atualizar_perfil_usuario(
  p_id     UUID,
  p_perfil TEXT,
  p_ativo  BOOLEAN DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar perfis';
  END IF;

  UPDATE movelaria_usuarios
  SET
    perfil        = COALESCE(p_perfil, perfil),
    ativo         = COALESCE(p_ativo, ativo),
    atualizado_em = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS das outras tabelas: somente usuários ativos ───────────
-- Reaplica policies exigindo auth.uid() válido + ativo
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'movelaria_fornecedores','movelaria_produtos','movelaria_pedidos',
    'movelaria_pedidos_itens','movelaria_contas_pagar',
    'movelaria_clientes','movelaria_contas_receber'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "read_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "write_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "delete_%s" ON %I', t, t);
    -- Leitura: qualquer usuário ativo autenticado
    EXECUTE format(
      'CREATE POLICY "read_%s" ON %I FOR SELECT TO authenticated USING (movelaria_meu_perfil() IS NOT NULL)',
      t, t
    );
    -- Escrita: somente administrador e financeiro
    EXECUTE format(
      'CREATE POLICY "write_%s" ON %I FOR INSERT TO authenticated WITH CHECK (movelaria_meu_perfil() IN (''administrador'',''financeiro''))',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "update_%s" ON %I FOR UPDATE TO authenticated USING (movelaria_meu_perfil() IN (''administrador'',''financeiro'')) WITH CHECK (movelaria_meu_perfil() IN (''administrador'',''financeiro''))',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "delete_%s" ON %I FOR DELETE TO authenticated USING (movelaria_meu_perfil() = ''administrador'')',
      t, t
    );
  END LOOP;
END $$;
