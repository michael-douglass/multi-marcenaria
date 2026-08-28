import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresaTable } from '@/hooks/useEmpresaTable';
import { isMissingDbRelationError } from '@/lib/supabase-missing-relation';
import { parseSupabaseFunctionError } from '@/lib/parse-supabase-function-error';
import { toast } from 'sonner';

export type LeadSkyChatRole = 'user' | 'assistant';

export interface LeadSkyChatMessage {
  id: string;
  leadId: number;
  userId: string;
  analiseId: string | null;
  role: LeadSkyChatRole;
  content: string;
  modelo: string | null;
  criadoEm: string;
  metadata: Record<string, unknown> | null;
}

interface DBLeadSkyChatMessage {
  id: string;
  lead_id: number;
  user_id: string;
  analise_id: string | null;
  role: LeadSkyChatRole;
  content: string;
  modelo: string | null;
  criado_em: string;
  metadata?: Record<string, unknown> | null;
}

function adaptMessage(row: DBLeadSkyChatMessage): LeadSkyChatMessage {
  return {
    id: row.id,
    leadId: row.lead_id,
    userId: row.user_id,
    analiseId: row.analise_id,
    role: row.role,
    content: row.content,
    modelo: row.modelo,
    criadoEm: row.criado_em,
    metadata: row.metadata ?? null,
  };
}

export const leadSkyChatQueryKey = (
  schema: string | null | undefined,
  leadId: number | null | undefined,
  userId: string | null | undefined,
) => ['lead-sky-chat', schema ?? 'master', leadId, userId] as const;

export const leadKnowledgeMetaQueryKey = (
  schema: string | null | undefined,
  leadId: number | null | undefined,
) => ['lead-knowledge-meta', schema ?? 'master', leadId] as const;

export function useLeadSkyChatMessages(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const { user } = useAuth();
  const db = useEmpresaSupabase();
  const { lead_ai_chat_messages: chatTable } = useEmpresaTable();

  return useQuery({
    queryKey: leadSkyChatQueryKey(schemaEmpresa, leadId, user?.id),
    enabled: queriesReady && !!leadId && !!user?.id,
    queryFn: async (): Promise<LeadSkyChatMessage[]> => {
      const { data, error } = await db
        .from(chatTable)
        .select('id, lead_id, user_id, analise_id, role, content, modelo, criado_em, metadata')
        .eq('lead_id', leadId!)
        .eq('user_id', user!.id)
        .order('criado_em', { ascending: true });

      if (error) {
        if (isMissingDbRelationError(error)) return [];
        throw error;
      }

      return (data ?? []).map((row) => adaptMessage(row as DBLeadSkyChatMessage));
    },
    staleTime: 15 * 1000,
  });
}

export interface IrisSpotContextPayload {
  mediaLabel: string;
  normalizedX: number;
  normalizedY: number;
  cropBase64?: string;
  pdfPageNumber?: number;
  spotDescription?: string;
}

export interface SendLeadSkyChatInput {
  leadId: number;
  analiseId?: string | null;
  message: string;
  leadName?: string;
  leadOrigin?: string;
  spotContext?: IrisSpotContextPayload;
  identifySpotOnly?: boolean;
}

export interface SendLeadSkyChatResult {
  assistantMessage: string;
  spotDescription: string | null;
  shortLabel: string | null;
  identifyOnly: boolean;
  messageId: string | null;
  criadoEm: string | null;
}

export function useSendLeadSkyChatMessage() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SendLeadSkyChatInput): Promise<SendLeadSkyChatResult> => {
      const { data, error } = await supabase.functions.invoke('chat-iris-sky', {
        body: {
          leadId: input.leadId,
          empresaSchema: schemaEmpresa,
          analiseId: input.analiseId ?? null,
          message: input.message,
          leadName: input.leadName,
          leadOrigin: input.leadOrigin,
          spotContext: input.spotContext ?? null,
          identifySpotOnly: input.identifySpotOnly ?? false,
        },
      });

      if (error) {
        const msg = error.message ?? '';
        const isUnreachable =
          msg.includes('Failed to send') ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          error.name === 'FunctionsFetchError';
        if (isUnreachable) {
          throw new Error(
            'Chat Íris Sky indisponível. A função chat-iris-sky ainda não foi publicada no Supabase.',
          );
        }
        throw error;
      }
      if (data?.error) throw new Error(String(data.error));

      return {
        assistantMessage: data.assistantMessage as string,
        spotDescription: (data.spotDescription as string | null) ?? null,
        shortLabel: (data.shortLabel as string | null) ?? null,
        identifyOnly: Boolean(data.identifyOnly),
        messageId: (data.messageId as string | null) ?? null,
        criadoEm: (data.criadoEm as string | null) ?? null,
      };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: leadSkyChatQueryKey(schemaEmpresa, variables.leadId, user?.id),
      });
    },
    onError: (error) => {
      console.error('Erro no chat Íris Sky:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar mensagem');
    },
  });
}

export interface LeadKnowledgeMeta {
  status: 'pending' | 'indexing' | 'ready' | 'error';
  chunkCount: number;
  indexedAt: string | null;
  sourcesFingerprint: string | null;
}

export function useLeadKnowledgeMeta(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const { lead_ai_knowledge_meta: metaTable } = useEmpresaTable();

  return useQuery({
    queryKey: leadKnowledgeMetaQueryKey(schemaEmpresa, leadId),
    enabled: queriesReady && !!leadId,
    queryFn: async (): Promise<LeadKnowledgeMeta | null> => {
      const { data, error } = await db
        .from(metaTable)
        .select('status, chunk_count, indexed_at, sources_fingerprint')
        .eq('lead_id', leadId!)
        .maybeSingle();

      if (error) {
        if (isMissingDbRelationError(error)) return null;
        throw error;
      }
      if (!data) return null;

      return {
        status: data.status as LeadKnowledgeMeta['status'],
        chunkCount: Number(data.chunk_count ?? 0),
        indexedAt: (data.indexed_at as string | null) ?? null,
        sourcesFingerprint: (data.sources_fingerprint as string | null) ?? null,
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: (query) =>
      query.state.data?.status === 'indexing' ? 2_000 : false,
  });
}

export function useIndexLeadKnowledge() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: async (input: {
      leadId: number;
      force?: boolean;
      includeMediaVision?: boolean;
      clientMedia?: Array<{
        source: string;
        id: string;
        label: string;
        imageUrl?: string;
        pagesBase64?: string[];
      }>;
    }) => {
      const { data, error } = await supabase.functions.invoke('index-lead-knowledge', {
        body: {
          leadId: input.leadId,
          empresaSchema: schemaEmpresa,
          force: input.force ?? false,
          includeMediaVision: input.includeMediaVision ?? true,
          clientMedia: input.clientMedia?.length ? input.clientMedia : undefined,
        },
      });

      if (error) {
        throw new Error(await parseSupabaseFunctionError(error, data));
      }
      if (data?.error) throw new Error(String(data.error));
      return data as {
        skipped: boolean;
        chunkCount: number;
        status: string;
        indexedAt: string | null;
      };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: leadKnowledgeMetaQueryKey(schemaEmpresa, variables.leadId),
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      const isResourceLimit =
        message.includes('non-2xx') ||
        message.includes('546') ||
        message.toLowerCase().includes('resource');
      if (!isResourceLimit) {
        console.error('Erro ao indexar conhecimento do lead:', error);
      }
    },
  });
}

export function useClearLeadSkyChat(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const { user } = useAuth();
  const db = useEmpresaSupabase();
  const { lead_ai_chat_messages: chatTable } = useEmpresaTable();

  return useMutation({
    mutationFn: async () => {
      if (!leadId || !user?.id) return;

      const { error } = await db
        .from(chatTable)
        .delete()
        .eq('lead_id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: leadSkyChatQueryKey(schemaEmpresa, leadId, user?.id),
      });
      toast.success('Histórico do chat limpo.');
    },
    onError: (error) => {
      console.error('Erro ao limpar chat:', error);
      toast.error('Não foi possível limpar o histórico.');
    },
  });
}
