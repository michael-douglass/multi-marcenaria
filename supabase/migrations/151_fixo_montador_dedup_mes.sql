-- ============================================================
-- GARBO Movelaria — Deduplica fixo no mesmo mês
-- Migration 151
-- Mantém a cobrança paga (ou a do dia do 1º vencimento).
-- ============================================================

-- Remove reservas de caixa das duplicatas
WITH ranked AS (
  SELECT
    cp.id,
    ROW_NUMBER() OVER (
      PARTITION BY cp.prestador_id,
        EXTRACT(YEAR  FROM cp.data_vencimento),
        EXTRACT(MONTH FROM cp.data_vencimento)
      ORDER BY
        CASE cp.status WHEN 'pago' THEN 0 WHEN 'parcialmente_pago' THEN 1 ELSE 2 END,
        CASE
          WHEN u.fixo_primeiro_vencimento IS NOT NULL
            AND EXTRACT(DAY FROM cp.data_vencimento)
              = EXTRACT(DAY FROM u.fixo_primeiro_vencimento)
          THEN 0 ELSE 1
        END,
        cp.criado_em ASC,
        cp.id ASC
    ) AS rn
  FROM movelaria_contas_pagar cp
  LEFT JOIN movelaria_usuarios u ON u.id = cp.prestador_id
  WHERE COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
    AND cp.prestador_id IS NOT NULL
)
DELETE FROM movelaria_caixa_movimentacoes cm
WHERE cm.conta_pagar_id IN (
  SELECT id FROM ranked WHERE rn > 1
);

WITH ranked AS (
  SELECT
    cp.id,
    ROW_NUMBER() OVER (
      PARTITION BY cp.prestador_id,
        EXTRACT(YEAR  FROM cp.data_vencimento),
        EXTRACT(MONTH FROM cp.data_vencimento)
      ORDER BY
        CASE cp.status WHEN 'pago' THEN 0 WHEN 'parcialmente_pago' THEN 1 ELSE 2 END,
        CASE
          WHEN u.fixo_primeiro_vencimento IS NOT NULL
            AND EXTRACT(DAY FROM cp.data_vencimento)
              = EXTRACT(DAY FROM u.fixo_primeiro_vencimento)
          THEN 0 ELSE 1
        END,
        cp.criado_em ASC,
        cp.id ASC
    ) AS rn
  FROM movelaria_contas_pagar cp
  LEFT JOIN movelaria_usuarios u ON u.id = cp.prestador_id
  WHERE COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
    AND cp.prestador_id IS NOT NULL
)
DELETE FROM movelaria_contas_pagar cp
USING ranked r
WHERE cp.id = r.id
  AND r.rn > 1;

-- Garante horizonte completo após limpeza
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM movelaria_usuarios
    WHERE ativo
      AND COALESCE(valor_fixo_mensal, 0) > 0
      AND perfil IN ('montador', 'montador_admin')
      AND fixo_primeiro_vencimento IS NOT NULL
  LOOP
    BEGIN
      PERFORM movelaria_expandir_fixo_montador(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao expandir fixo de %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
