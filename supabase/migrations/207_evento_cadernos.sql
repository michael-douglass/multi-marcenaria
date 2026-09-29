-- Vários cadernos por pasta de evento (cada caderno = um tipo de conteúdo).
-- Migra as abas antigas (detalhes / discurso / palestra) para 3 cadernos iniciais.

DO $$
DECLARE
  v_schema text;
  v_eventos text;
  v_paginas text;
  v_cadernos text;
  v_fk text;
BEGIN
  -- public (legado multiempresas) + schemas emp_*
  FOR v_schema, v_eventos, v_paginas, v_cadernos IN
    SELECT * FROM (
      VALUES
        ('public', 'crm_multiempresas_eventos', 'crm_multiempresas_evento_paginas', 'crm_multiempresas_evento_cadernos')
    ) AS t(schema_name, eventos, paginas, cadernos)
    UNION ALL
    SELECT s.schema_name, 'eventos', 'evento_paginas', 'evento_cadernos'
    FROM information_schema.schemata s
    WHERE s.schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.%I', v_schema, v_eventos)) IS NULL THEN
      CONTINUE;
    END IF;
    IF to_regclass(format('%I.%I', v_schema, v_paginas)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %I.%I (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        evento_id uuid NOT NULL REFERENCES %I.%I(id) ON DELETE CASCADE,
        titulo text NOT NULL DEFAULT '',
        dica text,
        ordem integer NOT NULL DEFAULT 0,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now()
      )
    $sql$, v_schema, v_cadernos, v_schema, v_eventos);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (evento_id, ordem, criado_em)',
      left(replace(v_cadernos, '-', '_'), 40) || '_ev_idx',
      v_schema,
      v_cadernos
    );

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_schema, v_cadernos);
    EXECUTE format('DROP POLICY IF EXISTS me_evento_cadernos_all ON %I.%I', v_schema, v_cadernos);
    EXECUTE format(
      'CREATE POLICY me_evento_cadernos_all ON %I.%I FOR ALL USING (true) WITH CHECK (true)',
      v_schema,
      v_cadernos
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO authenticated, anon, service_role',
      v_schema,
      v_cadernos
    );

    EXECUTE format(
      'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS caderno_id uuid',
      v_schema,
      v_paginas
    );

    -- 3 cadernos padrão por evento que ainda não tem nenhum
    EXECUTE format($sql$
      INSERT INTO %I.%I (evento_id, titulo, dica, ordem)
      SELECT e.id, seed.titulo, seed.dica, seed.ordem
      FROM %I.%I e
      CROSS JOIN (
        VALUES
          (0, 'Detalhes', 'Roteiro, horários e observações do dia'),
          (1, 'Discursos', 'Textos para quem vai falar'),
          (2, 'Palestras', 'Pauta e anotações de palco')
      ) AS seed(ordem, titulo, dica)
      WHERE NOT EXISTS (
        SELECT 1 FROM %I.%I c WHERE c.evento_id = e.id
      )
    $sql$, v_schema, v_cadernos, v_schema, v_eventos, v_schema, v_cadernos);

    -- Liga folhas antigas ao caderno da seção correspondente
    EXECUTE format($sql$
      UPDATE %I.%I p
      SET caderno_id = c.id
      FROM %I.%I c
      WHERE p.caderno_id IS NULL
        AND c.evento_id = p.evento_id
        AND (
          (p.secao = 'detalhes' AND c.titulo = 'Detalhes')
          OR (p.secao = 'discurso' AND c.titulo = 'Discursos')
          OR (p.secao = 'palestra' AND c.titulo = 'Palestras')
        )
    $sql$, v_schema, v_paginas, v_schema, v_cadernos);

    -- Folhas órfãs → primeiro caderno do evento
    EXECUTE format($sql$
      UPDATE %I.%I p
      SET caderno_id = sub.id
      FROM (
        SELECT DISTINCT ON (c.evento_id) c.evento_id, c.id
        FROM %I.%I c
        ORDER BY c.evento_id, c.ordem, c.criado_em
      ) sub
      WHERE p.caderno_id IS NULL
        AND p.evento_id = sub.evento_id
    $sql$, v_schema, v_paginas, v_schema, v_cadernos);

    -- Remove CHECK antigo (só 3 seções)
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS evento_paginas_secao_check',
      v_schema,
      v_paginas
    );
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS crm_multiempresas_evento_paginas_secao_check',
      v_schema,
      v_paginas
    );

    v_fk := left(replace(v_paginas, '-', '_'), 40) || '_caderno_fkey';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = v_fk
        AND conrelid = to_regclass(format('%I.%I', v_schema, v_paginas))
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (caderno_id) REFERENCES %I.%I(id) ON DELETE CASCADE',
        v_schema, v_paginas, v_fk, v_schema, v_cadernos
      );
    END IF;

    -- Só força NOT NULL se não restou órfã
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = v_schema
        AND table_name = v_paginas
        AND column_name = 'caderno_id'
        AND is_nullable = 'NO'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN caderno_id SET NOT NULL',
        v_schema,
        v_paginas
      );
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (caderno_id, ordem, criado_em)',
      left(replace(v_paginas, '-', '_'), 40) || '_cad_idx',
      v_schema,
      v_paginas
    );
  END LOOP;
END $$;
