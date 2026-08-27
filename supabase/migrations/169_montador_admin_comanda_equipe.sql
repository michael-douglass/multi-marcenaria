-- ============================================================
-- GARBO Movelaria — Montador admin inicia/conclui para a equipe
-- Migration 169
-- Iniciar/concluir pelo admin marca todos os montadores da obra.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_registrar_inicio_todos_montadores(p_obra_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE movelaria_obra_responsaveis
  SET iniciado_em = COALESCE(iniciado_em, NOW())
  WHERE obra_id = p_obra_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION movelaria_registrar_fim_todos_montadores(p_obra_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE movelaria_obra_responsaveis
  SET finalizado_em = COALESCE(finalizado_em, NOW())
  WHERE obra_id = p_obra_id;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION movelaria_registrar_inicio_todos_montadores(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION movelaria_registrar_fim_todos_montadores(UUID) FROM PUBLIC;

DROP FUNCTION IF EXISTS movelaria_iniciar_obra(UUID);
CREATE OR REPLACE FUNCTION movelaria_iniciar_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
  v_comanda_equipe BOOLEAN;
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;

  IF v_perfil = 'montador_admin' AND NOT movelaria_montador_admin_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_comanda_equipe := v_perfil IN ('administrador', 'administrador_obras', 'montador_admin');

  IF v_comanda_equipe THEN
    PERFORM movelaria_registrar_inicio_todos_montadores(p_obra_id);
  ELSIF v_perfil = 'montador'
     AND v_uid IS NOT NULL
     AND movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    PERFORM movelaria_registrar_inicio_montador(p_obra_id, v_uid);
  END IF;

  UPDATE movelaria_obras
  SET iniciado_em   = COALESCE(iniciado_em, NOW()),
      status_kanban = CASE
        WHEN status_kanban NOT IN ('concluida', 'cancelada') THEN 'em_andamento'
        ELSE status_kanban
      END,
      atualizado_em = NOW()
  WHERE id = p_obra_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_iniciar_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_iniciar_obra(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_concluir_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
  v_inicio TIMESTAMPTZ;
  v_fim    TIMESTAMPTZ;
  v_fecha_obra BOOLEAN := false;
  v_comanda_equipe BOOLEAN;
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;

  IF v_perfil = 'montador_admin' AND NOT movelaria_montador_admin_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_comanda_equipe := v_perfil IN ('administrador', 'administrador_obras', 'montador_admin');

  IF v_comanda_equipe THEN
    PERFORM movelaria_registrar_fim_todos_montadores(p_obra_id);
    v_fecha_obra := true;
  ELSIF v_perfil = 'montador'
     AND v_uid IS NOT NULL
     AND movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    PERFORM movelaria_registrar_fim_montador(p_obra_id, v_uid);
    v_fecha_obra := movelaria_obra_todos_montadores_concluiram(p_obra_id);
  ELSE
    v_fecha_obra := true;
  END IF;

  IF v_fecha_obra THEN
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
