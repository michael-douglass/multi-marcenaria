-- Adiciona 'video' ao check constraint da coluna kind nas tabelas de arquivos de obra

ALTER TABLE movelaria_obra_arquivos
  DROP CONSTRAINT movelaria_obra_arquivos_kind_check,
  ADD CONSTRAINT movelaria_obra_arquivos_kind_check
    CHECK (kind = ANY (ARRAY['image'::text, 'pdf'::text, 'video'::text]));

ALTER TABLE movelaria_obra_evolucao
  DROP CONSTRAINT movelaria_obra_evolucao_kind_check,
  ADD CONSTRAINT movelaria_obra_evolucao_kind_check
    CHECK (kind = ANY (ARRAY['image'::text, 'pdf'::text, 'video'::text]));
