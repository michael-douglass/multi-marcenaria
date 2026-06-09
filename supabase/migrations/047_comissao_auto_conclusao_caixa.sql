-- ============================================================
-- GARBO Movelaria — Comissão automática ao concluir obra + Caixa
-- Migration 047
-- ============================================================

-- ── 1. Resolver destinatário do caixa para prestador ─────────
CREATE OR REPLACE FUNCTION movelaria_resolver_caixa_destinatario_prestador(
  p_nome TEXT,
  p_prestador_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_nome TEXT := NULLIF(TRIM(p_nome), '');
BEGIN
  IF v_nome IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM movelaria_caixa_destinatarios
  WHERE LOWER(TRIM(nome)) = LOWER(v_nome)
    AND ativo = true
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO movelaria_caixa_destinatarios (nome, tipo, observacoes)
    VALUES (
      v_nome,
      'marceneiro',
      CASE WHEN p_prestador_id IS NOT NULL
        THEN 'Prestador obra — ' || p_prestador_id::TEXT
        ELSE 'Prestador obra'
      END
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Sincronizar comissão gerada (INSERT contas_pagar) ─────
CREATE OR REPLACE FUNCTION movelaria_sync_comissao_gerada_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
  v_destinatario_id UUID;
  v_mes INTEGER;
  v_ano INTEGER;
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.obra_id IS NULL AND COALESCE(NEW.descricao, '') NOT LIKE 'Comissão:%' THEN
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
    'Reserva comissão obra: ' || COALESCE(NEW.descricao, 'Sem descrição'),
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_movelaria_sync_comissao_gerada_caixa ON movelaria_contas_pagar;
CREATE TRIGGER trg_movelaria_sync_comissao_gerada_caixa
  AFTER INSERT ON movelaria_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_sync_comissao_gerada_para_caixa();

-- ── 3. Ajustar trigger de pagamento (evitar reserva duplicada) ─
CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
    v_destinatario_id UUID;
    v_mes INTEGER;
    v_ano INTEGER;
    v_descricao_reserva TEXT;
    v_descricao_old TEXT;
    v_tipo_dest TEXT;
BEGIN
    v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');
    v_descricao_old := 'Reserva automática via pagamento: ' || COALESCE(OLD.descricao, 'Sem descrição');

    IF (OLD.status = 'pago' AND NEW.status = 'pendente') THEN
        DELETE FROM movelaria_caixa_movimentacoes
        WHERE id IN (
            SELECT m.id
            FROM movelaria_caixa_movimentacoes m
            WHERE m.tipo_movimentacao IN ('reserva', 'pagamento')
              AND (
                m.conta_pagar_id = OLD.id
                OR (
                  m.conta_pagar_id IS NULL
                  AND m.valor = OLD.valor_parcela
                  AND m.descricao = v_descricao_old
                  AND m.mes_referencia = EXTRACT(MONTH FROM OLD.data_vencimento)::INTEGER
                  AND m.ano_referencia = EXTRACT(YEAR FROM OLD.data_vencimento)::INTEGER
                  AND m.destinatario_id IN (
                    SELECT id FROM movelaria_caixa_destinatarios
                    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(COALESCE(OLD.fornecedor_nome, '')))
                      AND ativo = true
                  )
                )
              )
            ORDER BY
              CASE WHEN m.conta_pagar_id = OLD.id THEN 0 ELSE 1 END,
              m.criado_em DESC
            LIMIT 1
        );
        RETURN NEW;
    END IF;

    IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago')) THEN
        -- Comissão de prestador: se já existe reserva na geração, registrar pagamento
        IF NEW.prestador_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
        ) THEN
          SELECT id INTO v_destinatario_id
          FROM movelaria_caixa_destinatarios
          WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
            AND ativo = true
          LIMIT 1;

          IF v_destinatario_id IS NOT NULL THEN
            v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
            v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

            INSERT INTO movelaria_caixa_movimentacoes (
              destinatario_id,
              tipo_movimentacao,
              valor,
              data_movimentacao,
              mes_referencia,
              ano_referencia,
              descricao,
              conta_pagar_id
            ) VALUES (
              v_destinatario_id,
              'pagamento',
              NEW.valor_parcela,
              COALESCE(NEW.data_pagamento, CURRENT_DATE),
              v_mes,
              v_ano,
              'Pagamento comissão: ' || COALESCE(NEW.descricao, 'Sem descrição'),
              NEW.id
            );
          END IF;
          RETURN NEW;
        END IF;

        SELECT id INTO v_destinatario_id
        FROM movelaria_caixa_destinatarios
        WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
          AND ativo = true
        LIMIT 1;

        v_tipo_dest := CASE WHEN NEW.prestador_id IS NOT NULL THEN 'marceneiro' ELSE 'fornecedor' END;

        IF (v_destinatario_id IS NULL AND NEW.fornecedor_nome IS NOT NULL AND TRIM(NEW.fornecedor_nome) != '') THEN
            INSERT INTO movelaria_caixa_destinatarios (nome, tipo)
            VALUES (TRIM(NEW.fornecedor_nome), v_tipo_dest)
            RETURNING id INTO v_destinatario_id;
        END IF;

        IF (v_destinatario_id IS NOT NULL) THEN
            v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
            v_ano := EXTRACT(YEAR FROM NEW.data_vencimento);

            INSERT INTO movelaria_caixa_movimentacoes (
                destinatario_id,
                tipo_movimentacao,
                valor,
                data_movimentacao,
                mes_referencia,
                ano_referencia,
                descricao,
                conta_pagar_id
            ) VALUES (
                v_destinatario_id,
                'reserva',
                NEW.valor_parcela,
                COALESCE(NEW.data_pagamento, CURRENT_DATE),
                v_mes,
                v_ano,
                v_descricao_reserva,
                NEW.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Aplicar comissão (interno, sem checagem de perfil) ────
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra_interno(p_obra_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_habilitada   BOOLEAN;
  v_gerada       BOOLEAN;
  v_cliente_nome TEXT;
  v_qtd_itens    INTEGER;
  r              RECORD;
BEGIN
  SELECT comissao_habilitada, comissao_gerada, cliente_nome
  INTO v_habilitada, v_gerada, v_cliente_nome
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF NOT FOUND OR NOT v_habilitada OR v_gerada THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_qtd_itens
  FROM movelaria_obra_comissao_itens
  WHERE obra_id = p_obra_id AND valor > 0;

  IF v_qtd_itens = 0 THEN
    RETURN false;
  END IF;

  FOR r IN
    SELECT ci.prestador_id, ci.valor, u.nome, u.email
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_usuarios u ON u.id = ci.prestador_id
    WHERE ci.obra_id = p_obra_id AND ci.valor > 0
  LOOP
    INSERT INTO movelaria_contas_pagar (
      prestador_id,
      obra_id,
      fornecedor_nome,
      descricao,
      valor_total,
      numero_parcela,
      total_parcelas,
      valor_parcela,
      data_vencimento,
      status
    ) VALUES (
      r.prestador_id,
      p_obra_id,
      COALESCE(NULLIF(TRIM(r.nome), ''), split_part(r.email, '@', 1)),
      'Comissão: ' || v_cliente_nome,
      r.valor,
      1,
      1,
      r.valor,
      CURRENT_DATE,
      'pendente'
    );
  END LOOP;

  UPDATE movelaria_obras
  SET comissao_gerada = true,
      atualizado_em = NOW()
  WHERE id = p_obra_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_aplicar_comissao_obra_interno(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_aplicar_comissao_obra_interno(UUID) TO authenticated;

-- ── 5. Aplicar comissão (admin — delega ao interno) ────────────
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_ok     BOOLEAN;
BEGIN
  IF v_perfil NOT IN ('administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem aplicar comissões';
  END IF;

  v_ok := movelaria_aplicar_comissao_obra_interno(p_obra_id);

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Não foi possível gerar comissão: verifique se está habilitada e possui valores definidos';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Concluir obra (unificado) + comissão automática ─────────
CREATE OR REPLACE FUNCTION movelaria_concluir_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
BEGIN
  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;

  UPDATE movelaria_obras
  SET iniciado_em   = COALESCE(iniciado_em, NOW()),
      finalizado_em = NOW(),
      status_kanban = 'concluida',
      atualizado_em = NOW()
  WHERE id = p_obra_id
    AND finalizado_em IS NULL;

  PERFORM movelaria_aplicar_comissao_obra_interno(p_obra_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_concluir_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_concluir_obra(UUID) TO authenticated;

-- Atualiza finalizar_obra para também gerar comissão
CREATE OR REPLACE FUNCTION movelaria_finalizar_obra(p_obra_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM movelaria_concluir_obra(p_obra_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Retroativo: obras já concluídas sem comissão gerada ────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id
    FROM movelaria_obras o
    WHERE o.status_kanban = 'concluida'
      AND o.comissao_habilitada = true
      AND o.comissao_gerada = false
      AND EXISTS (
        SELECT 1 FROM movelaria_obra_comissao_itens ci
        WHERE ci.obra_id = o.id AND ci.valor > 0
      )
  LOOP
    PERFORM movelaria_aplicar_comissao_obra_interno(r.id);
  END LOOP;
END $$;
