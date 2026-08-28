-- Renderização com ambiente (prompt + foto → composição de cena)

ALTER TABLE public."CRM-multi-empresas>pipeline_lead_ai_config<"
  ADD COLUMN IF NOT EXISTS render_ambiente_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS render_ambiente_analysis_prompt text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS render_ambiente_prompt text NOT NULL DEFAULT '';

DROP VIEW IF EXISTS public."CRM-multi-empresas>pipeline_lead_ai_config_public<";

CREATE VIEW public."CRM-multi-empresas>pipeline_lead_ai_config_public<" AS
SELECT
  id,
  singleton_key,
  model,
  system_prompt,
  briefing_prompt,
  render_ativo,
  render_vision_model,
  render_image_model,
  render_analysis_prompt,
  render_prompt,
  render_ambiente_ativo,
  render_ambiente_analysis_prompt,
  render_ambiente_prompt,
  iris_sky_ativo,
  iris_sky_model,
  iris_sky_knowledge_ativo,
  iris_sky_embedding_model,
  iris_sky_include_media_vision,
  iris_sky_include_whatsapp,
  iris_sky_match_count,
  iris_sky_chat_prompt,
  iris_sky_spot_prompt,
  iris_sky_auto_index_ativo,
  iris_sky_knowledge_max_items,
  iris_sky_knowledge_max_pages,
  ativo,
  atualizado_em,
  atualizado_por,
  (openai_api_key IS NOT NULL AND btrim(openai_api_key) <> '') AS api_key_configured
FROM public."CRM-multi-empresas>pipeline_lead_ai_config<";

GRANT SELECT ON public."CRM-multi-empresas>pipeline_lead_ai_config_public<" TO authenticated, service_role;

DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.pipeline_lead_ai_config ADD COLUMN IF NOT EXISTS render_ambiente_ativo boolean NOT NULL DEFAULT true',
      v_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.pipeline_lead_ai_config ADD COLUMN IF NOT EXISTS render_ambiente_analysis_prompt text NOT NULL DEFAULT %L',
      v_schema,
      ''
    );
    EXECUTE format(
      'ALTER TABLE %I.pipeline_lead_ai_config ADD COLUMN IF NOT EXISTS render_ambiente_prompt text NOT NULL DEFAULT %L',
      v_schema,
      ''
    );

    EXECUTE format('DROP VIEW IF EXISTS %I.pipeline_lead_ai_config_public', v_schema);

    EXECUTE format(
      'CREATE VIEW %I.pipeline_lead_ai_config_public AS
       SELECT id, singleton_key, model, system_prompt, briefing_prompt,
         render_ativo, render_vision_model, render_image_model, render_analysis_prompt, render_prompt,
         render_ambiente_ativo, render_ambiente_analysis_prompt, render_ambiente_prompt,
         iris_sky_ativo, iris_sky_model, iris_sky_knowledge_ativo, iris_sky_embedding_model,
         iris_sky_include_media_vision, iris_sky_include_whatsapp, iris_sky_match_count, iris_sky_chat_prompt,
         iris_sky_spot_prompt, iris_sky_auto_index_ativo, iris_sky_knowledge_max_items, iris_sky_knowledge_max_pages,
         ativo, atualizado_em, atualizado_por,
         (openai_api_key IS NOT NULL AND btrim(openai_api_key) <> %L) AS api_key_configured
       FROM %I.pipeline_lead_ai_config',
      v_schema,
      '',
      v_schema
    );

    EXECUTE format(
      'GRANT SELECT ON %I.pipeline_lead_ai_config_public TO authenticated, service_role',
      v_schema
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
