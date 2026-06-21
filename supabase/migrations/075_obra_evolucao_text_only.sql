-- Permite registros de evolução apenas com texto (observação), sem arquivo anexo.

ALTER TABLE movelaria_obra_evolucao
  DROP CONSTRAINT movelaria_obra_evolucao_kind_check,
  ADD CONSTRAINT movelaria_obra_evolucao_kind_check
    CHECK (kind = ANY (ARRAY['image'::text, 'pdf'::text, 'video'::text, 'text'::text]));

COMMENT ON COLUMN movelaria_obra_evolucao.observacao IS
  'Comentário do montador ao registrar progresso ou observação da obra.';
