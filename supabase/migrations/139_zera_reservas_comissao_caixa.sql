-- ============================================================
-- GARBO Movelaria — Zera reservas de comissão no Caixa
-- Migration 139
--
-- Pedido: nenhum valor de comissão foi reservado de verdade.
-- Remove reservas (e pagamento teste de R$ 1) de destinatários
-- "Comissão:%" no Caixa. Contas a Pagar das comissões permanecem.
-- ============================================================

DELETE FROM movelaria_caixa_movimentacoes m
USING movelaria_caixa_destinatarios d
WHERE m.destinatario_id = d.id
  AND d.nome LIKE 'Comissão:%'
  AND m.tipo_movimentacao IN ('reserva', 'pagamento');
