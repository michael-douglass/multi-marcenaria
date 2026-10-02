-- Remove tarefas pessoais ÚNICAS abertas duplicadas no mesmo slot
-- (mesmo titular + título + data + horário), mantendo a mais antiga.
-- Causa típica: adiar várias ocorrências de uma recorrente para o mesmo dia.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        titular_id,
        titulo,
        data,
        COALESCE(NULLIF(TRIM(hora), ''), '')
      ORDER BY criado_em ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.crm_multiempresas_agenda_pessoal_tarefas
  WHERE tipo_agendamento = 'unica'
    AND concluida = false
)
DELETE FROM public.crm_multiempresas_agenda_pessoal_tarefas t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- Se já existe cópia única aberta no mesmo slot de uma série recorrente,
-- exclui essa data na série para não aparecerem as duas no calendário.

WITH unicas AS (
  SELECT
    titular_id,
    titulo,
    data::text AS data_txt,
    COALESCE(NULLIF(TRIM(hora), ''), '') AS hora_norm
  FROM public.crm_multiempresas_agenda_pessoal_tarefas
  WHERE tipo_agendamento = 'unica'
    AND concluida = false
),
to_fix AS (
  SELECT DISTINCT ON (t.id, u.data_txt)
    t.id,
    COALESCE(
      (
        SELECT ARRAY(SELECT jsonb_array_elements_text(t.exclusoes_ocorrencias))
      ),
      ARRAY[]::text[]
    ) AS exclusoes_atuais,
    u.data_txt
  FROM public.crm_multiempresas_agenda_pessoal_tarefas t
  JOIN unicas u
    ON u.titular_id = t.titular_id
   AND u.titulo = t.titulo
   AND u.hora_norm = COALESCE(NULLIF(TRIM(t.hora), ''), '')
  WHERE t.tipo_agendamento = 'recorrente'
  ORDER BY t.id, u.data_txt
),
aggregated AS (
  SELECT
    id,
    exclusoes_atuais || ARRAY_AGG(data_txt) AS novas_exclusoes
  FROM to_fix
  WHERE NOT (data_txt = ANY(exclusoes_atuais))
  GROUP BY id, exclusoes_atuais
)
UPDATE public.crm_multiempresas_agenda_pessoal_tarefas t
SET exclusoes_ocorrencias = to_jsonb(
      (
        SELECT ARRAY(SELECT DISTINCT x FROM unnest(a.novas_exclusoes) AS x ORDER BY 1)
      )
    ),
    atualizado_em = now()
FROM aggregated a
WHERE t.id = a.id;
