-- M06 — Unicidades/singletons do núcleo por empresa + job de faltas por empresa.

-- 1. Chaves "por instalação" passam a ser por empresa ------------------------------------------
alter table public.movelaria_visualizacao_config drop constraint movelaria_visualizacao_config_pkey;
alter table public.movelaria_visualizacao_config add primary key (empresa_id, chave);

alter table public.movelaria_obra_lousa_text_config drop constraint movelaria_obra_lousa_text_config_pkey;
alter table public.movelaria_obra_lousa_text_config add primary key (empresa_id, singleton_key);

alter table public.movelaria_simulador_caixa drop constraint movelaria_simulador_caixa_pkey;
alter table public.movelaria_simulador_caixa add primary key (empresa_id, ano);

alter table public.movelaria_formas_pagamento_pagar drop constraint uq_forma_pagar_nome;
alter table public.movelaria_formas_pagamento_pagar add constraint uq_forma_pagar_nome unique (empresa_id, nome);

alter table public.movelaria_kanban_colunas_obra drop constraint movelaria_kanban_colunas_obra_status_key_key;
alter table public.movelaria_kanban_colunas_obra add constraint movelaria_kanban_colunas_obra_status_key_key unique (empresa_id, status_key);

alter table public.movelaria_funcionario_ponto_marcacoes drop constraint movelaria_funcionario_ponto_marcacoes_nsr_key;
alter table public.movelaria_funcionario_ponto_marcacoes add constraint movelaria_funcionario_ponto_marcacoes_nsr_key unique (empresa_id, nsr);

-- 2. Faltas automáticas: filtro explícito da empresa do contexto (não depende do dono da função)
create or replace function public.movelaria_ponto_detectar_faltas(
  p_data date default movelaria_ponto_data_local((now() - '1 day'::interval)))
returns integer language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
  v_hora_sp INT := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))::INT;
  v_minutos INT;
  v_emp UUID := public.app_empresa_atual();
BEGIN
  IF v_emp IS NULL THEN
    RETURN 0;
  END IF;
  IF p_data > movelaria_ponto_data_local() THEN
    RETURN 0;
  END IF;
  IF p_data = movelaria_ponto_data_local() AND v_hora_sp < 23 THEN
    RETURN 0;
  END IF;

  FOR v_rec IN
    SELECT j.funcionario_id
    FROM movelaria_funcionario_jornada j
    JOIN movelaria_funcionarios f ON f.id = j.funcionario_id AND f.ativo = true
    WHERE j.ativo = true
      AND f.empresa_id = v_emp
      AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
      AND EXTRACT(ISODOW FROM p_data)::INT = ANY(j.dias_uteis)
      AND p_data >= movelaria_ponto_data_inicio_vinculo(f.id)
      AND p_data <= movelaria_ponto_data_local()
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = j.funcionario_id
          AND movelaria_ponto_data_local(m.registrado_em) = p_data
      )
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = j.funcionario_id
          AND o.data = p_data
          AND o.tipo IN ('folga', 'abono', 'falta')
      )
  LOOP
    v_minutos := movelaria_jornada_minutos_no_dia(v_rec.funcionario_id, p_data);

    INSERT INTO movelaria_funcionario_ponto_ocorrencias (
      empresa_id, funcionario_id, data, tipo, observacao, automatica,
      abater_banco_horas, minutos_abatidos
    ) VALUES (
      v_emp, v_rec.funcionario_id, p_data, 'falta', 'Falta detectada automaticamente.', true,
      true, NULLIF(v_minutos, 0)
    )
    ON CONFLICT (funcionario_id, data, tipo) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

create or replace function public.movelaria_ponto_job_faltas()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_agora_sp timestamp := (now() at time zone 'America/Sao_Paulo');
  v_data date;
  v_emp uuid;
begin
  -- Cron sobe às 23:59 SP (02:59 UTC): fecha o dia que está terminando.
  -- Se o job atrasar e virar após meia-noite SP, fecha o dia que acabou.
  if extract(hour from v_agora_sp) < 6 then
    v_data := v_agora_sp::date - 1;
  else
    v_data := v_agora_sp::date;
  end if;

  for v_emp in
    select id from "CRM-multi-empresas>empresas<" where ativo and status = 'ativa'
  loop
    perform public.app_set_empresa_ctx(v_emp);
    perform public.movelaria_ponto_detectar_faltas(v_data);
  end loop;
  perform public.app_set_empresa_ctx(null);
end $$;
