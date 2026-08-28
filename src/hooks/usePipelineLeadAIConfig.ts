import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresaTable } from '@/hooks/useEmpresaTable';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  PIPELINE_LEAD_AI_DEFAULTS,
  PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH,
  clampIrisSkyKnowledgeMaxItems,
  clampIrisSkyKnowledgeMaxPages,
  isValidPipelineLeadAIModel,
  isValidPipelineLeadAIImageModel,
  isValidPipelineLeadAIEmbeddingModel,
  type PipelineLeadAIModel,
  type PipelineLeadAIImageModel,
  type PipelineLeadAIEmbeddingModel,
} from '@/lib/pipeline-lead-ai-config';
import {
  isMissingDbRelationError,
  isPostgrestColumnError,
} from '@/lib/supabase-missing-relation';
import { toast } from 'sonner';

export interface PipelineLeadAIConfig {
  id: string;
  model: PipelineLeadAIModel;
  systemPrompt: string;
  briefingPrompt: string;
  ativo: boolean;
  renderAtivo: boolean;
  renderVisionModel: PipelineLeadAIModel;
  renderImageModel: PipelineLeadAIImageModel;
  renderAnalysisPrompt: string;
  renderPrompt: string;
  renderAmbienteAtivo: boolean;
  renderAmbienteAnalysisPrompt: string;
  renderAmbientePrompt: string;
  irisSkyAtivo: boolean;
  irisSkyModel: PipelineLeadAIModel;
  irisSkyKnowledgeAtivo: boolean;
  irisSkyEmbeddingModel: PipelineLeadAIEmbeddingModel;
  irisSkyIncludeMediaVision: boolean;
  irisSkyIncludeWhatsapp: boolean;
  irisSkyMatchCount: number;
  irisSkyChatPrompt: string;
  irisSkySpotPrompt: string;
  irisSkyAutoIndexAtivo: boolean;
  irisSkyKnowledgeMaxItems: number;
  irisSkyKnowledgeMaxPages: number;
  apiKeyConfigured: boolean;
  atualizadoEm: string | null;
}

interface DBPipelineLeadAIConfigPublic {
  id: string;
  singleton_key: string;
  model: string;
  system_prompt: string;
  briefing_prompt?: string | null;
  render_ativo?: boolean | null;
  render_vision_model?: string | null;
  render_image_model?: string | null;
  render_analysis_prompt?: string | null;
  render_prompt?: string | null;
  render_ambiente_ativo?: boolean | null;
  render_ambiente_analysis_prompt?: string | null;
  render_ambiente_prompt?: string | null;
  iris_sky_ativo?: boolean | null;
  iris_sky_model?: string | null;
  iris_sky_knowledge_ativo?: boolean | null;
  iris_sky_embedding_model?: string | null;
  iris_sky_include_media_vision?: boolean | null;
  iris_sky_include_whatsapp?: boolean | null;
  iris_sky_match_count?: number | null;
  iris_sky_chat_prompt?: string | null;
  iris_sky_spot_prompt?: string | null;
  iris_sky_auto_index_ativo?: boolean | null;
  iris_sky_knowledge_max_items?: number | null;
  iris_sky_knowledge_max_pages?: number | null;
  ativo: boolean;
  atualizado_em: string | null;
  api_key_configured?: boolean;
}

interface DBPipelineLeadAIConfigAdmin extends DBPipelineLeadAIConfigPublic {
  openai_api_key?: string | null;
}

function adaptConfig(
  row: DBPipelineLeadAIConfigPublic | DBPipelineLeadAIConfigAdmin,
): PipelineLeadAIConfig {
  const apiKeyConfigured =
    'api_key_configured' in row && row.api_key_configured != null
      ? Boolean(row.api_key_configured)
      : Boolean(row.openai_api_key?.trim());

  return {
    id: row.id,
    model: isValidPipelineLeadAIModel(row.model) ? row.model : PIPELINE_LEAD_AI_DEFAULTS.model,
    systemPrompt: row.system_prompt,
    briefingPrompt: row.briefing_prompt?.trim() || PIPELINE_LEAD_AI_DEFAULTS.briefingPrompt,
    ativo: row.ativo,
    renderAtivo: row.render_ativo ?? PIPELINE_LEAD_AI_DEFAULTS.renderAtivo,
    renderVisionModel: isValidPipelineLeadAIModel(row.render_vision_model ?? '')
      ? (row.render_vision_model as PipelineLeadAIModel)
      : PIPELINE_LEAD_AI_DEFAULTS.renderVisionModel,
    renderImageModel: isValidPipelineLeadAIImageModel(row.render_image_model ?? '')
      ? (row.render_image_model as PipelineLeadAIImageModel)
      : PIPELINE_LEAD_AI_DEFAULTS.renderImageModel,
    renderAnalysisPrompt:
      row.render_analysis_prompt?.trim() || PIPELINE_LEAD_AI_DEFAULTS.renderAnalysisPrompt,
    renderPrompt: row.render_prompt?.trim() || PIPELINE_LEAD_AI_DEFAULTS.renderPrompt,
    renderAmbienteAtivo: row.render_ambiente_ativo ?? PIPELINE_LEAD_AI_DEFAULTS.renderAmbienteAtivo,
    renderAmbienteAnalysisPrompt:
      row.render_ambiente_analysis_prompt?.trim() ||
      PIPELINE_LEAD_AI_DEFAULTS.renderAmbienteAnalysisPrompt,
    renderAmbientePrompt:
      row.render_ambiente_prompt?.trim() || PIPELINE_LEAD_AI_DEFAULTS.renderAmbientePrompt,
    irisSkyAtivo: row.iris_sky_ativo ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyAtivo,
    irisSkyModel: isValidPipelineLeadAIModel(row.iris_sky_model ?? '')
      ? (row.iris_sky_model as PipelineLeadAIModel)
      : PIPELINE_LEAD_AI_DEFAULTS.irisSkyModel,
    irisSkyKnowledgeAtivo:
      row.iris_sky_knowledge_ativo ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyKnowledgeAtivo,
    irisSkyEmbeddingModel: isValidPipelineLeadAIEmbeddingModel(row.iris_sky_embedding_model ?? '')
      ? (row.iris_sky_embedding_model as PipelineLeadAIEmbeddingModel)
      : PIPELINE_LEAD_AI_DEFAULTS.irisSkyEmbeddingModel,
    irisSkyIncludeMediaVision:
      row.iris_sky_include_media_vision ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyIncludeMediaVision,
    irisSkyIncludeWhatsapp:
      row.iris_sky_include_whatsapp ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyIncludeWhatsapp,
    irisSkyMatchCount: Math.min(
      20,
      Math.max(4, Number(row.iris_sky_match_count ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyMatchCount)),
    ),
    irisSkyChatPrompt:
      row.iris_sky_chat_prompt?.trim() || PIPELINE_LEAD_AI_DEFAULTS.irisSkyChatPrompt,
    irisSkySpotPrompt:
      row.iris_sky_spot_prompt?.trim() || PIPELINE_LEAD_AI_DEFAULTS.irisSkySpotPrompt,
    irisSkyAutoIndexAtivo:
      row.iris_sky_auto_index_ativo ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyAutoIndexAtivo,
    irisSkyKnowledgeMaxItems: clampIrisSkyKnowledgeMaxItems(
      Number(row.iris_sky_knowledge_max_items ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyKnowledgeMaxItems),
    ),
    irisSkyKnowledgeMaxPages: clampIrisSkyKnowledgeMaxPages(
      Number(row.iris_sky_knowledge_max_pages ?? PIPELINE_LEAD_AI_DEFAULTS.irisSkyKnowledgeMaxPages),
    ),
    apiKeyConfigured,
    atualizadoEm: row.atualizado_em,
  };
}

const IRIS_SKY_FIELDS =
  'iris_sky_ativo, iris_sky_model, iris_sky_knowledge_ativo, iris_sky_embedding_model, iris_sky_include_media_vision, iris_sky_include_whatsapp, iris_sky_match_count, iris_sky_chat_prompt, iris_sky_spot_prompt, iris_sky_auto_index_ativo, iris_sky_knowledge_max_items, iris_sky_knowledge_max_pages';

const RENDER_FIELDS =
  'render_ativo, render_vision_model, render_image_model, render_analysis_prompt, render_prompt';
const RENDER_AMBIENTE_FIELDS =
  'render_ambiente_ativo, render_ambiente_analysis_prompt, render_ambiente_prompt';

const BASE_SELECT =
  'id, singleton_key, model, system_prompt, briefing_prompt, ativo, atualizado_em';

const ADMIN_SELECT =
  `id, singleton_key, model, system_prompt, briefing_prompt, ${RENDER_FIELDS}, ${RENDER_AMBIENTE_FIELDS}, ${IRIS_SKY_FIELDS}, ativo, atualizado_em, openai_api_key`;
const ADMIN_SELECT_NO_AMBIENTE =
  `id, singleton_key, model, system_prompt, briefing_prompt, ${RENDER_FIELDS}, ${IRIS_SKY_FIELDS}, ativo, atualizado_em, openai_api_key`;
const ADMIN_SELECT_LEGACY =
  `id, singleton_key, model, system_prompt, briefing_prompt, ${RENDER_FIELDS}, ativo, atualizado_em, openai_api_key`;
const PUBLIC_SELECT =
  `id, singleton_key, model, system_prompt, briefing_prompt, ${RENDER_FIELDS}, ${RENDER_AMBIENTE_FIELDS}, ${IRIS_SKY_FIELDS}, ativo, atualizado_em, api_key_configured`;
const PUBLIC_SELECT_NO_AMBIENTE =
  `id, singleton_key, model, system_prompt, briefing_prompt, ${RENDER_FIELDS}, ${IRIS_SKY_FIELDS}, ativo, atualizado_em, api_key_configured`;
const PUBLIC_SELECT_LEGACY =
  `id, singleton_key, model, system_prompt, briefing_prompt, ${RENDER_FIELDS}, ativo, atualizado_em, api_key_configured`;

async function loadPipelineLeadAIConfig(
  client: ReturnType<typeof useEmpresaSupabase>,
  table: string,
  admin: boolean,
) {
  const load = async (selectFields: string) =>
    client.from(table).select(selectFields).eq('singleton_key', 'default').maybeSingle();

  const variants = admin
    ? [ADMIN_SELECT, ADMIN_SELECT_NO_AMBIENTE, ADMIN_SELECT_LEGACY, `${BASE_SELECT}, openai_api_key`]
    : [PUBLIC_SELECT, PUBLIC_SELECT_NO_AMBIENTE, PUBLIC_SELECT_LEGACY, `${BASE_SELECT}, api_key_configured`];

  let lastError: { code?: string; message?: string; status?: number } | null = null;

  for (const selectFields of variants) {
    const { data, error: fetchError } = await load(selectFields);
    if (!fetchError) {
      if (!data) return fallbackConfig();
      return adaptConfig(data as DBPipelineLeadAIConfigAdmin);
    }
    lastError = fetchError;
    if (!isPostgrestColumnError(fetchError) && !isMissingDbRelationError(fetchError)) {
      throw fetchError;
    }
  }

  if (isMissingDbRelationError(lastError)) return fallbackConfig();
  if (lastError) throw lastError;
  return fallbackConfig();
}

const fallbackConfig = (): PipelineLeadAIConfig => ({
  id: 'default',
  model: PIPELINE_LEAD_AI_DEFAULTS.model,
  systemPrompt: PIPELINE_LEAD_AI_DEFAULTS.systemPrompt,
  briefingPrompt: PIPELINE_LEAD_AI_DEFAULTS.briefingPrompt,
  ativo: PIPELINE_LEAD_AI_DEFAULTS.ativo,
  renderAtivo: PIPELINE_LEAD_AI_DEFAULTS.renderAtivo,
  renderVisionModel: PIPELINE_LEAD_AI_DEFAULTS.renderVisionModel,
  renderImageModel: PIPELINE_LEAD_AI_DEFAULTS.renderImageModel,
  renderAnalysisPrompt: PIPELINE_LEAD_AI_DEFAULTS.renderAnalysisPrompt,
  renderPrompt: PIPELINE_LEAD_AI_DEFAULTS.renderPrompt,
  renderAmbienteAtivo: PIPELINE_LEAD_AI_DEFAULTS.renderAmbienteAtivo,
  renderAmbienteAnalysisPrompt: PIPELINE_LEAD_AI_DEFAULTS.renderAmbienteAnalysisPrompt,
  renderAmbientePrompt: PIPELINE_LEAD_AI_DEFAULTS.renderAmbientePrompt,
  irisSkyAtivo: PIPELINE_LEAD_AI_DEFAULTS.irisSkyAtivo,
  irisSkyModel: PIPELINE_LEAD_AI_DEFAULTS.irisSkyModel,
  irisSkyKnowledgeAtivo: PIPELINE_LEAD_AI_DEFAULTS.irisSkyKnowledgeAtivo,
  irisSkyEmbeddingModel: PIPELINE_LEAD_AI_DEFAULTS.irisSkyEmbeddingModel,
  irisSkyIncludeMediaVision: PIPELINE_LEAD_AI_DEFAULTS.irisSkyIncludeMediaVision,
  irisSkyIncludeWhatsapp: PIPELINE_LEAD_AI_DEFAULTS.irisSkyIncludeWhatsapp,
  irisSkyMatchCount: PIPELINE_LEAD_AI_DEFAULTS.irisSkyMatchCount,
  irisSkyChatPrompt: PIPELINE_LEAD_AI_DEFAULTS.irisSkyChatPrompt,
  irisSkySpotPrompt: PIPELINE_LEAD_AI_DEFAULTS.irisSkySpotPrompt,
  irisSkyAutoIndexAtivo: PIPELINE_LEAD_AI_DEFAULTS.irisSkyAutoIndexAtivo,
  irisSkyKnowledgeMaxItems: PIPELINE_LEAD_AI_DEFAULTS.irisSkyKnowledgeMaxItems,
  irisSkyKnowledgeMaxPages: PIPELINE_LEAD_AI_DEFAULTS.irisSkyKnowledgeMaxPages,
  apiKeyConfigured: false,
  atualizadoEm: null,
});

interface UsePipelineLeadAIConfigOptions {
  admin?: boolean;
}

export function usePipelineLeadAIConfig(options: UsePipelineLeadAIConfigOptions = {}) {
  const { admin = false } = options;
  const client = useEmpresaSupabase();
  const { pipeline_lead_ai_config: adminTable, pipeline_lead_ai_config_public: publicTable } =
    useEmpresaTable();
  const table = admin ? adminTable : publicTable;
  const { schemaEmpresa } = useEmpresa();
  const queryClient = useQueryClient();

  const queryKey = ['pipeline-lead-ai-config', schemaEmpresa ?? 'master', admin ? 'admin' : 'public'] as const;

  const { data: config, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => loadPipelineLeadAIConfig(client, table, admin),
    staleTime: 60_000,
    retry: (failureCount, err) => !isMissingDbRelationError(err) && failureCount < 2,
  });

  const saveConfig = useMutation({
    mutationFn: async (updates: {
      model: PipelineLeadAIModel;
      systemPrompt: string;
      briefingPrompt: string;
      ativo: boolean;
      renderAtivo: boolean;
      renderVisionModel: PipelineLeadAIModel;
      renderImageModel: PipelineLeadAIImageModel;
      renderAnalysisPrompt: string;
      renderPrompt: string;
      renderAmbienteAtivo: boolean;
      renderAmbienteAnalysisPrompt: string;
      renderAmbientePrompt: string;
      irisSkyAtivo: boolean;
      irisSkyModel: PipelineLeadAIModel;
      irisSkyKnowledgeAtivo: boolean;
      irisSkyEmbeddingModel: PipelineLeadAIEmbeddingModel;
      irisSkyIncludeMediaVision: boolean;
      irisSkyIncludeWhatsapp: boolean;
      irisSkyMatchCount: number;
      irisSkyChatPrompt: string;
      irisSkySpotPrompt: string;
      irisSkyAutoIndexAtivo: boolean;
      irisSkyKnowledgeMaxItems: number;
      irisSkyKnowledgeMaxPages: number;
      apiKey?: string;
    }) => {
      const prompt = updates.systemPrompt.trim();
      if (!prompt) throw new Error('O prompt não pode estar vazio');
      if (prompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(`Prompt muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH} caracteres)`);
      }

      const briefingPrompt = updates.briefingPrompt.trim();
      if (briefingPrompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(
          `Prompt de briefing muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH} caracteres)`,
        );
      }

      const renderAnalysisPrompt = updates.renderAnalysisPrompt.trim();
      const renderPrompt = updates.renderPrompt.trim();
      if (renderAnalysisPrompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(`Prompt de análise de render muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH})`);
      }
      if (renderPrompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(`Prompt de renderização muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH})`);
      }

      const renderAmbienteAnalysisPrompt = updates.renderAmbienteAnalysisPrompt.trim();
      const renderAmbientePrompt = updates.renderAmbientePrompt.trim();
      if (renderAmbienteAnalysisPrompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(
          `Prompt de análise de ambiente muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH})`,
        );
      }
      if (renderAmbientePrompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(
          `Prompt de renderização de ambiente muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH})`,
        );
      }

      const irisSkyChatPrompt = updates.irisSkyChatPrompt.trim();
      if (!irisSkyChatPrompt) {
        throw new Error('O prompt da Íris Sky não pode estar vazio');
      }
      if (irisSkyChatPrompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(`Prompt da Íris Sky muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH})`);
      }

      const irisSkySpotPrompt = updates.irisSkySpotPrompt.trim();
      if (!irisSkySpotPrompt) {
        throw new Error('O prompt de análise por clique da Íris Sky não pode estar vazio');
      }
      if (irisSkySpotPrompt.length > PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH) {
        throw new Error(
          `Prompt de análise por clique muito longo (máx. ${PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH})`,
        );
      }

      const matchCount = Math.min(20, Math.max(4, updates.irisSkyMatchCount));
      const knowledgeMaxItems = clampIrisSkyKnowledgeMaxItems(updates.irisSkyKnowledgeMaxItems);
      const knowledgeMaxPages = clampIrisSkyKnowledgeMaxPages(updates.irisSkyKnowledgeMaxPages);
      const apiKeyTrimmed = updates.apiKey?.trim() ?? '';
      if (apiKeyTrimmed && !apiKeyTrimmed.startsWith('sk-')) {
        throw new Error('A chave da OpenAI deve começar com sk-');
      }

      const row: Record<string, unknown> = {
        singleton_key: 'default',
        model: updates.model,
        system_prompt: prompt,
        briefing_prompt: briefingPrompt,
        render_ativo: updates.renderAtivo,
        render_vision_model: updates.renderVisionModel,
        render_image_model: updates.renderImageModel,
        render_analysis_prompt: renderAnalysisPrompt,
        render_prompt: renderPrompt,
        render_ambiente_ativo: updates.renderAmbienteAtivo,
        render_ambiente_analysis_prompt: renderAmbienteAnalysisPrompt,
        render_ambiente_prompt: renderAmbientePrompt,
        iris_sky_ativo: updates.irisSkyAtivo,
        iris_sky_model: updates.irisSkyModel,
        iris_sky_knowledge_ativo: updates.irisSkyKnowledgeAtivo,
        iris_sky_embedding_model: updates.irisSkyEmbeddingModel,
        iris_sky_include_media_vision: updates.irisSkyIncludeMediaVision,
        iris_sky_include_whatsapp: updates.irisSkyIncludeWhatsapp,
        iris_sky_match_count: matchCount,
        iris_sky_chat_prompt: irisSkyChatPrompt,
        iris_sky_spot_prompt: irisSkySpotPrompt,
        iris_sky_auto_index_ativo: updates.irisSkyAutoIndexAtivo,
        iris_sky_knowledge_max_items: knowledgeMaxItems,
        iris_sky_knowledge_max_pages: knowledgeMaxPages,
        ativo: updates.ativo,
        atualizado_em: new Date().toISOString(),
      };

      if (apiKeyTrimmed) {
        row.openai_api_key = apiKeyTrimmed;
      }

      const persistRow = async (payload: Record<string, unknown>) => {
        if (config?.id && config.id !== 'default') {
          const { error: updateError } = await client
            .from(adminTable)
            .update(payload)
            .eq('id', config.id);
          if (updateError) throw updateError;
          return;
        }

        const { error: upsertError } = await client
          .from(adminTable)
          .upsert(payload, { onConflict: 'singleton_key' });
        if (upsertError) throw upsertError;
      };

      try {
        await persistRow(row);
      } catch (persistError) {
        if (!isPostgrestColumnError(persistError as { message?: string })) {
          throw persistError;
        }
        const {
          render_ambiente_ativo: _a,
          render_ambiente_analysis_prompt: _b,
          render_ambiente_prompt: _c,
          ...legacyRow
        } = row;
        await persistRow(legacyRow);
      }

      let { data, error: readError } = await client
        .from(adminTable)
        .select(ADMIN_SELECT)
        .eq('singleton_key', 'default')
        .maybeSingle();

      if (readError && isPostgrestColumnError(readError)) {
        ({ data, error: readError } = await client
          .from(adminTable)
          .select(ADMIN_SELECT_NO_AMBIENTE)
          .eq('singleton_key', 'default')
          .maybeSingle());
      }

      if (readError && isPostgrestColumnError(readError)) {
        ({ data, error: readError } = await client
          .from(adminTable)
          .select(ADMIN_SELECT_LEGACY)
          .eq('singleton_key', 'default')
          .maybeSingle());
      }

      if (readError) throw readError;
      if (!data) {
        throw new Error('Configuração salva, mas não foi possível recarregar. Atualize a página.');
      }
      return adaptConfig(data as DBPipelineLeadAIConfigAdmin);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-lead-ai-config', schemaEmpresa ?? 'master'] });
      toast.success('Configuração de IA salva');
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar a configuração de IA', {
        description: err.message,
      });
    },
  });

  return {
    config: config ?? fallbackConfig(),
    isLoading,
    error,
    refetch,
    saveConfig,
  };
}

