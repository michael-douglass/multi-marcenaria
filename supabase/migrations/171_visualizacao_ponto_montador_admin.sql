-- ============================================================
-- GARBO Movelaria — Montador admin vê o ponto na Visualização
-- Migration 171
-- Quem bateu, quem atrasou e quem faltou no painel do dia.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_ponto_controle_diario(p_data DATE DEFAULT movelaria_ponto_data_local())
RETURNS JSONB AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o controle de ponto.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row ORDER BY row->>'nome')
    FROM (
      SELECT jsonb_build_object(
        'funcionario_id', f.id,
        'nome', f.nome,
        'tipo', f.tipo,
        'hora_prevista', j.hora_entrada,
        'jornada', CASE WHEN j.id IS NOT NULL THEN jsonb_build_object(
          'hora_entrada', j.hora_entrada,
          'hora_saida_intervalo', j.hora_saida_intervalo,
          'hora_retorno_intervalo', j.hora_retorno_intervalo,
          'hora_saida', j.hora_saida
        ) ELSE NULL END,
        'status_dia', COALESCE(
          (movelaria_ponto_status_dia(f.id, p_data)->>'status_dia'),
          'pendente'
        ),
        'ocorrencia', (movelaria_ponto_status_dia(f.id, p_data)->>'ocorrencia'),
        'entrada', (
          SELECT to_jsonb(m)
          FROM movelaria_funcionario_ponto_marcacoes m
          WHERE m.funcionario_id = f.id
            AND m.tipo = 'entrada'
            AND movelaria_ponto_data_local(m.registrado_em) = p_data
          ORDER BY m.registrado_em DESC
          LIMIT 1
        ),
        'marcacoes', COALESCE((
          SELECT jsonb_agg(to_jsonb(m) ORDER BY m.registrado_em)
          FROM movelaria_funcionario_ponto_marcacoes m
          WHERE m.funcionario_id = f.id
            AND movelaria_ponto_data_local(m.registrado_em) = p_data
        ), '[]'::jsonb)
      ) AS row
      FROM movelaria_funcionarios f
      LEFT JOIN movelaria_funcionario_jornada j ON j.funcionario_id = f.id AND j.ativo = true
      WHERE f.ativo = true
        AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
    ) sub
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION movelaria_ponto_controle_diario(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_ponto_controle_diario(DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
