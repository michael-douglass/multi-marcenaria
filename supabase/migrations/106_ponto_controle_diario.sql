-- Migration 106: RPC controle diário de ponto (RH)

CREATE OR REPLACE FUNCTION movelaria_ponto_controle_diario(p_data DATE DEFAULT movelaria_ponto_data_local())
RETURNS JSONB AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
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
        'status_dia', COALESCE(
          (movelaria_ponto_status_dia(f.id)->>'status_dia'),
          'pendente'
        ),
        'ocorrencia', (movelaria_ponto_status_dia(f.id)->>'ocorrencia'),
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
