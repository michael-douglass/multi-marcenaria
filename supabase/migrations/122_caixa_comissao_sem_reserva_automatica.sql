-- ============================================================
-- GARBO Movelaria — Comissão de obra NÃO reserva automaticamente no caixa
-- Migration 122
--
-- Problema: ao concluir obra (ou gerar comissão), o trigger criava
-- RESERVA no caixa do montador. A comissão deve ficar só em Contas a Pagar
-- para planejamento; o caixa recebe reserva+pagamento no pagamento real.
--
-- Correção (mesmo padrão do fixo montador — migration 115):
-- 1) Parar de criar reserva na geração da comissão
-- 2) Manter criação no pagamento (já em movelaria_sync_pagamento_para_caixa)
-- 3) Limpar reservas fantasma de comissão (conta pendente/órfã, sem pagamento)
-- ============================================================

-- ── 1. Geração: não reservar comissão nem fixo ───────────────
CREATE OR REPLACE FUNCTION movelaria_sync_comissao_gerada_para_caixa()
RETURNS TRIGGER AS $$
BEGIN
  -- Comissão e fixo: só criam conta a pagar.
  -- Reserva no caixa nasce apenas no pagamento real
  -- (movelaria_sync_pagamento_para_caixa).
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Limpeza: reservas fantasma de comissão ────────────────
DELETE FROM movelaria_caixa_movimentacoes m
WHERE m.tipo_movimentacao = 'reserva'
  AND COALESCE(m.descricao, '') LIKE 'Reserva comissão obra:%'
  AND NOT EXISTS (
    SELECT 1
    FROM movelaria_caixa_movimentacoes p
    WHERE p.conta_pagar_id IS NOT NULL
      AND p.conta_pagar_id = m.conta_pagar_id
      AND p.tipo_movimentacao = 'pagamento'
  )
  AND (
    m.conta_pagar_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM movelaria_contas_pagar cp WHERE cp.id = m.conta_pagar_id
    )
    OR EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.id = m.conta_pagar_id
        AND cp.status = 'pendente'
    )
  );

NOTIFY pgrst, 'reload schema';
