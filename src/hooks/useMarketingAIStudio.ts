import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type MarketingAIGenerationType =
  | 'Criar aleatoriamente'
  | 'Criar com Script'
  | 'Criar com sugestão';

export interface MarketingAIStudioStatus {
  id: string;
  ativo: boolean;
  model_pesquisa: string;
  model_copy: string;
  openai_configured: boolean;
  openai_key_hint: string | null;
  serp_configured: boolean;
  serp_key_hint: string | null;
  atualizado_em: string;
}

export interface MarketingAIAgent {
  id: string;
  slug: 'pesquisa' | 'copy';
  nome: string;
  descricao: string | null;
  system_prompt: string;
  user_prompt_template: string;
  model: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface MarketingAIPersonality {
  id: string;
  nome: string;
  descricao: string | null;
  system_prompt: string;
  user_prompt_template: string;
  model: string | null;
  ativo: boolean;
  is_default: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface GenerateMarketingCopyInput {
  id?: string;
  titulo?: string;
  script_copy?: string | null;
  column_id?: string;
  tipo_geracao: MarketingAIGenerationType;
  sugestao?: string;
  /** Obrigatório: a voz escolhida no Atelier deve ir para o prompt */
  personality_id: string;
}

export interface GenerateMarketingCopyResult {
  titulo?: string | null;
  conteudo: string;
  warning?: string | null;
  model_used?: string;
  personality_id?: string | null;
  personality_nome?: string | null;
}

async function extractFunctionsError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const ctx = error.context as Response;
      const body = await ctx.json();
      if (body && typeof body.error === 'string') return body.error;
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Erro desconhecido';
}

const STATUS_KEY = ['marketing-ai-studio-status'] as const;
const AGENTS_KEY = ['marketing-ai-agents'] as const;
const PERSONALITIES_KEY = ['marketing-ai-personalities'] as const;

/** Tabelas do Studio — sempre prefixo crm_multiempresas_ (CRM multi empresas). */
type StudioTable =
  | 'crm_multiempresas_marketing_ai_agents'
  | 'crm_multiempresas_marketing_ai_personalities'
  | 'crm_multiempresas_marketing_ai_studio_config';

function studioFrom(table: StudioTable) {
  return supabase.from(table);
}

export function useMarketingAIStudio() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_crm_multiempresas_marketing_ai_studio_status',
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as MarketingAIStudioStatus | null) ?? null;
    },
  });

  const agentsQuery = useQuery({
    queryKey: AGENTS_KEY,
    queryFn: async () => {
      const { data, error } = await studioFrom('crm_multiempresas_marketing_ai_agents')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as MarketingAIAgent[];
    },
  });

  const personalitiesQuery = useQuery({
    queryKey: PERSONALITIES_KEY,
    queryFn: async () => {
      const { data, error } = await studioFrom('crm_multiempresas_marketing_ai_personalities')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as MarketingAIPersonality[];
    },
  });

  const setStudioActive = useMutation({
    mutationFn: async (ativo: boolean) => {
      const status = statusQuery.data;
      if (!status?.id) throw new Error('Configuração do Studio não encontrada');
      const { error } = await studioFrom('crm_multiempresas_marketing_ai_studio_config')
        .update({ ativo, atualizado_em: new Date().toISOString() } as never)
        .eq('id', status.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      toast.success('Studio atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar Studio', { description: error.message });
    },
  });

  const saveModels = useMutation({
    mutationFn: async (models: { model_pesquisa?: string; model_copy?: string }) => {
      const status = statusQuery.data;
      if (!status?.id) throw new Error('Configuração do Studio não encontrada');
      const { error } = await studioFrom('crm_multiempresas_marketing_ai_studio_config')
        .update({ ...models, atualizado_em: new Date().toISOString() } as never)
        .eq('id', status.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      toast.success('Modelos salvos');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar modelos', { description: error.message });
    },
  });

  const saveSecrets = useMutation({
    mutationFn: async (keys: { openai_api_key?: string; serp_api_key?: string }) => {
      const { data, error } = await supabase.functions.invoke(
        'salvar-marketing-ai-secrets',
        { body: keys },
      );
      if (error) {
        const msg = await extractFunctionsError(error);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(String(data.error));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      toast.success('Chaves salvas com segurança');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar chaves', { description: error.message });
    },
  });

  const saveAgent = useMutation({
    mutationFn: async (
      agent: Partial<MarketingAIAgent> & { id: string },
    ) => {
      const { id, ...rest } = agent;
      const { error } = await studioFrom('crm_multiempresas_marketing_ai_agents')
        .update({ ...rest, atualizado_em: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_KEY });
      toast.success('Agente atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar agente', { description: error.message });
    },
  });

  const createPersonality = useMutation({
    mutationFn: async (input: {
      nome: string;
      descricao?: string;
      system_prompt: string;
      user_prompt_template: string;
      model?: string | null;
      is_default?: boolean;
    }) => {
      const maxOrdem = Math.max(
        0,
        ...(personalitiesQuery.data || []).map((p) => p.ordem),
      );
      if (input.is_default) {
        await studioFrom('crm_multiempresas_marketing_ai_personalities')
          .update({ is_default: false } as never)
          .eq('is_default', true);
      }
      const { data, error } = await studioFrom('crm_multiempresas_marketing_ai_personalities')
        .insert({
          nome: input.nome,
          descricao: input.descricao ?? null,
          system_prompt: input.system_prompt,
          user_prompt_template: input.user_prompt_template,
          model: input.model ?? null,
          is_default: input.is_default ?? false,
          ativo: true,
          ordem: maxOrdem + 1,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MarketingAIPersonality;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERSONALITIES_KEY });
      toast.success('Personalidade criada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar personalidade', { description: error.message });
    },
  });

  const savePersonality = useMutation({
    mutationFn: async (
      personality: Partial<MarketingAIPersonality> & { id: string },
    ) => {
      const { id, ...rest } = personality;
      const { error } = await studioFrom('crm_multiempresas_marketing_ai_personalities')
        .update({ ...rest, atualizado_em: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERSONALITIES_KEY });
      toast.success('Personalidade salva');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar personalidade', { description: error.message });
    },
  });

  const setDefaultPersonality = useMutation({
    mutationFn: async (id: string) => {
      await studioFrom('crm_multiempresas_marketing_ai_personalities')
        .update({ is_default: false } as never)
        .eq('is_default', true);
      const { error } = await studioFrom('crm_multiempresas_marketing_ai_personalities')
        .update({ is_default: true, atualizado_em: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERSONALITIES_KEY });
      toast.success('Personalidade padrão definida');
    },
    onError: (error: Error) => {
      toast.error('Erro ao definir padrão', { description: error.message });
    },
  });

  const togglePersonalityActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await studioFrom('crm_multiempresas_marketing_ai_personalities')
        .update({ ativo, atualizado_em: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERSONALITIES_KEY });
    },
    onError: (error: Error) => {
      toast.error('Erro ao alterar status', { description: error.message });
    },
  });

  const deletePersonality = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await studioFrom('crm_multiempresas_marketing_ai_personalities')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERSONALITIES_KEY });
      toast.success('Personalidade removida');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover personalidade', { description: error.message });
    },
  });

  return {
    status: statusQuery.data ?? null,
    isLoadingStatus: statusQuery.isLoading,
    agents: agentsQuery.data ?? [],
    isLoadingAgents: agentsQuery.isLoading,
    personalities: personalitiesQuery.data ?? [],
    isLoadingPersonalities: personalitiesQuery.isLoading,
    setStudioActive,
    saveModels,
    saveSecrets,
    saveAgent,
    createPersonality,
    savePersonality,
    setDefaultPersonality,
    togglePersonalityActive,
    deletePersonality,
  };
}

export async function generateMarketingCopy(
  input: GenerateMarketingCopyInput,
): Promise<GenerateMarketingCopyResult> {
  if (!input.personality_id?.trim()) {
    throw new Error('Selecione uma personalidade no Gerar com IA');
  }

  const { data, error } = await supabase.functions.invoke('gerar-marketing-copy', {
    body: {
      tipo_geracao: input.tipo_geracao,
      titulo: input.titulo ?? null,
      script_copy: input.script_copy ?? null,
      sugestao: input.sugestao,
      card_id: input.id,
      personality_id: input.personality_id,
    },
  });

  if (error) {
    const msg = await extractFunctionsError(error);
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  if (!data?.conteudo || typeof data.conteudo !== 'string') {
    throw new Error('A IA não retornou conteúdo');
  }

  return {
    titulo: data.titulo ?? null,
    conteudo: data.conteudo,
    warning: data.warning ?? null,
    model_used: data.model_used,
    personality_id: data.personality_id ?? null,
    personality_nome: data.personality_nome ?? null,
  };
}
