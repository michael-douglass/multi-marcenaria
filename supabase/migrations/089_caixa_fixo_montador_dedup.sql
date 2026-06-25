-- ============================================================
-- GARBO Movelaria — Corrigir reservas duplicadas do fixo montador
-- Migration 089
-- Remove reservas em meses inelegíveis e órfãs/duplicadas no caixa.
-- ============================================================

-- ── 1. Trigger: não criar reserva fixo em mês inelegível ou duplicada ──
CREATE OR REPLACE FUNCTION movelaria_sync_comissao_gerada_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
  v_destinatario_id       UUID;
  v_mes                   INTEGER;
  v_ano                   INTEGER;
  v_desc_reserva          TEXT;
  v_primeiro_vencimento   DATE;
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.obra_id IS NULL
     AND COALESCE(NEW.descricao, '') NOT LIKE 'Comissão:%'
     AND COALESCE(NEW.descricao, '') NOT LIKE 'Fixo montador:%' THEN
    RETURN NEW;
  END IF;

  v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
    NEW.fornecedor_nome,
    NEW.prestador_id
  );

  IF v_destinatario_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_mes := EXTRACT(MONTH FROM NEW.data_vencimento)::INTEGER;
  v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento)::INTEGER;

  IF COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%' THEN
    SELECT u.fixo_primeiro_vencimento
    INTO v_primeiro_vencimento
    FROM movelaria_usuarios u
    WHERE u.id = NEW.prestador_id;

    IF NOT movelaria_fixo_mes_elegivel(v_primeiro_vencimento, v_mes, v_ano) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM movelaria_caixa_movimentacoes
    WHERE conta_pagar_id = NEW.id
      AND tipo_movimentacao = 'reserva'
  ) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
     AND EXISTS (
       SELECT 1
       FROM movelaria_caixa_movimentacoes
       WHERE destinatario_id = v_destinatario_id
         AND mes_referencia = v_mes
         AND ano_referencia = v_ano
         AND tipo_movimentacao = 'reserva'
         AND COALESCE(descricao, '') LIKE 'Reserva fixo montador:%'
     ) THEN
    RETURN NEW;
  END IF;

  v_desc_reserva := CASE
    WHEN COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
      THEN 'Reserva fixo montador: ' || COALESCE(NEW.descricao, 'Sem descrição')
    ELSE 'Reserva comissão obra: ' || COALESCE(NEW.descricao, 'Sem descrição')
  END;

  INSERT INTO movelaria_caixa_movimentacoes (
    destinatario_id,
    tipo_movimentacao,
    valor,
    data_movimentacao,
    data_vencimento,
    mes_referencia,
    ano_referencia,
    descricao,
    conta_pagar_id
  ) VALUES (
    v_destinatario_id,
    'reserva',
    NEW.valor_parcela,
    CURRENT_DATE,
    NEW.data_vencimento,
    v_mes,
    v_ano,
    v_desc_reserva,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Limpeza: fixo em mês anterior ao primeiro vencimento ────────────
DELETE FROM movelaria_caixa_movimentacoes cm
USING movelaria_caixa_destinatarios d
JOIN movelaria_usuarios u
  ON LOWER(TRIM(u.nome)) = LOWER(TRIM(d.nome))
  AND u.perfil IN ('montador', 'montador_admin')
WHERE cm.destinatario_id = d.id
  AND cm.tipo_movimentacao = 'reserva'
  AND COALESCE(cm.descricao, '') LIKE 'Reserva fixo montador:%'
  AND u.fixo_primeiro_vencimento IS NOT NULL
  AND NOT movelaria_fixo_mes_elegivel(
    u.fixo_primeiro_vencimento,
    cm.mes_referencia,
    cm.ano_referencia
  );

-- ── 3. Limpeza: duplicatas de fixo no mesmo mês (mantém com conta válida) ─
WITH ranked AS (
  SELECT
    cm.id,
    ROW_NUMBER() OVER (
      PARTITION BY cm.destinatario_id, cm.mes_referencia, cm.ano_referencia
      ORDER BY
        CASE
          WHEN cm.conta_pagar_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM movelaria_contas_pagar cp
              WHERE cp.id = cm.conta_pagar_id
            ) THEN 0
          WHEN cm.conta_pagar_id IS NOT NULL THEN 1
          ELSE 2
        END,
        cm.criado_em ASC,
        cm.id ASC
    ) AS rn
  FROM movelaria_caixa_movimentacoes cm
  WHERE cm.tipo_movimentacao = 'reserva'
    AND COALESCE(cm.descricao, '') LIKE 'Reserva fixo montador:%'
)
DELETE FROM movelaria_caixa_movimentacoes cm
USING ranked r
WHERE cm.id = r.id
  AND r.rn > 1;

NOTIFY pgrst, 'reload schema';
