-- Configurações IA: chave de Contratos separada, secrets Orçamentos IA, limpar chaves existentes

-- 1) Coluna de Contratos + limpar chave Lead (tabela pública multi-empresas)
ALTER TABLE public."CRM-multi-empresas>pipeline_lead_ai_config<"
  ADD COLUMN IF NOT EXISTS contrato_openai_api_key text;

UPDATE public."CRM-multi-empresas>pipeline_lead_ai_config<"
SET
  openai_api_key = NULL,
  contrato_openai_api_key = NULL,
  atualizado_em = now();

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
  (openai_api_key IS NOT NULL AND btrim(openai_api_key) <> '') AS api_key_configured,
  (contrato_openai_api_key IS NOT NULL AND btrim(contrato_openai_api_key) <> '') AS contrato_api_key_configured
FROM public."CRM-multi-empresas>pipeline_lead_ai_config<";

GRANT SELECT ON public."CRM-multi-empresas>pipeline_lead_ai_config_public<" TO authenticated, service_role;

-- 2) Schemas por empresa (emp_*)
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
      'ALTER TABLE %I.pipeline_lead_ai_config ADD COLUMN IF NOT EXISTS contrato_openai_api_key text',
      v_schema
    );

    EXECUTE format(
      'UPDATE %I.pipeline_lead_ai_config
       SET openai_api_key = NULL,
           contrato_openai_api_key = NULL,
           atualizado_em = now()',
      v_schema
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
         (openai_api_key IS NOT NULL AND btrim(openai_api_key) <> %L) AS api_key_configured,
         (contrato_openai_api_key IS NOT NULL AND btrim(contrato_openai_api_key) <> %L) AS contrato_api_key_configured
       FROM %I.pipeline_lead_ai_config',
      v_schema,
      '',
      '',
      v_schema
    );

    EXECUTE format(
      'GRANT SELECT ON %I.pipeline_lead_ai_config_public TO authenticated, service_role',
      v_schema
    );
  END LOOP;
END $$;

-- 3) Secrets Orçamentos IA (por company_id; sem valores iniciais)
CREATE TABLE IF NOT EXISTS public.orcamentos_ia_ai_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  openai_api_key text,
  anthropic_api_key text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS orcamentos_ia_ai_secrets_company_id_idx
  ON public.orcamentos_ia_ai_secrets (company_id);

ALTER TABLE public.orcamentos_ia_ai_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamentos_ia_ai_secrets_tenant ON public.orcamentos_ia_ai_secrets;
CREATE POLICY orcamentos_ia_ai_secrets_tenant
  ON public.orcamentos_ia_ai_secrets
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos_ia_ai_secrets TO authenticated;
GRANT ALL ON public.orcamentos_ia_ai_secrets TO service_role;

DROP VIEW IF EXISTS public.orcamentos_ia_ai_secrets_public;
CREATE VIEW public.orcamentos_ia_ai_secrets_public AS
SELECT
  id,
  company_id,
  atualizado_em,
  atualizado_por,
  (openai_api_key IS NOT NULL AND btrim(openai_api_key) <> '') AS openai_configured,
  (anthropic_api_key IS NOT NULL AND btrim(anthropic_api_key) <> '') AS anthropic_configured
FROM public.orcamentos_ia_ai_secrets;

GRANT SELECT ON public.orcamentos_ia_ai_secrets_public TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
