-- ============================================================
-- GARBO Movelaria — Horário real início/fim por montador
-- Migration 073
-- Concluir NÃO preenche início automaticamente (só o botão Iniciar).
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_concluir_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
  v_inicio TIMESTAMPTZ;
  v_fim    TIMESTAMPTZ;
  v_montador_conclui BOOLEAN := false;
BEGIN
  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;

  IF v_perfil IN ('montador', 'montador_admin')
     AND v_uid IS NOT NULL
     AND movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    PERFORM movelaria_registrar_fim_montador(p_obra_id, v_uid);
    v_montador_conclui := true;
  END IF;

  IF NOT v_montador_conclui OR movelaria_obra_todos_montadores_concluiram(p_obra_id) THEN
    SELECT MIN(r.iniciado_em), MAX(r.finalizado_em)
    INTO v_inicio, v_fim
    FROM movelaria_obra_responsaveis r
    WHERE r.obra_id = p_obra_id
      AND (r.iniciado_em IS NOT NULL OR r.finalizado_em IS NOT NULL);

    IF v_inicio IS NULL THEN
      SELECT iniciado_em INTO v_inicio FROM movelaria_obras WHERE id = p_obra_id;
    END IF;

    UPDATE movelaria_obras
    SET iniciado_em        = COALESCE(v_inicio, iniciado_em),
        finalizado_em      = COALESCE(v_fim, NOW()),
        status_kanban      = 'concluida',
        duracao_real_horas = CASE
          WHEN v_inicio IS NOT NULL AND v_fim IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (v_fim - v_inicio)) / 3600.0, 4)
          WHEN v_inicio IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (COALESCE(v_fim, NOW()) - v_inicio)) / 3600.0, 4)
          ELSE duracao_real_horas
        END,
        atualizado_em      = NOW()
    WHERE id = p_obra_id
      AND finalizado_em IS NULL;

    PERFORM movelaria_aplicar_comissao_obra_interno(p_obra_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_concluir_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_concluir_obra(UUID) TO authenticated;

-- Remove início fictício criado junto com o fim (mesmo instante = concluiu sem iniciar antes)
UPDATE movelaria_obra_responsaveis
SET iniciado_em = NULL
WHERE iniciado_em IS NOT NULL
  AND finalizado_em IS NOT NULL
  AND iniciado_em = finalizado_em;
