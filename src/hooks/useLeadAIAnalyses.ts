import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresaTable } from '@/hooks/useEmpresaTable';
import { useEmpresa } from '@/contexts/EmpresaContext';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import {
  invokeAnalyzeLeadPhotos,
  type AnalyzeLeadPhotosInput,
} from '@/lib/analyze-lead-photos-api';
import { isMissingDbRelationError } from '@/lib/supabase-missing-relation';
import { toast } from 'sonner';

export type { AnalyzeLeadPhotosInput, AnalyzeLeadPhotosResult } from '@/lib/analyze-lead-photos-api';

export interface LeadAIAnalise {
  id: string;
  leadId: number;
  conteudo: string;
  perguntasBriefing: string | null;
  modelo: string;
  promptSnapshot: string;
  itensSelecionados: LeadAIAnalysisItemPayload[];
  criadoPor: string | null;
  criadoEm: string;
}

interface DBLeadAIAnalise {
  id: string;
  lead_id: number;
  conteudo: string;
  perguntas_briefing: string | null;
  modelo: string;
  prompt_snapshot: string;
  itens_selecionados: LeadAIAnalysisItemPayload[] | null;
  criado_por: string | null;
  criado_em: string;
}

function adaptAnalise(row: DBLeadAIAnalise): LeadAIAnalise {
  return {
    id: row.id,
    leadId: row.lead_id,
    conteudo: row.conteudo,
    perguntasBriefing: row.perguntas_briefing,
    modelo: row.modelo,
    promptSnapshot: row.prompt_snapshot,
    itensSelecionados: row.itens_selecionados ?? [],
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
  };
}

export const leadAIAnalysesQueryKey = (
  schema: string | null | undefined,
  leadId: number | null | undefined,
) => ['lead-ai-analises', schema, leadId] as const;

export function useLeadAIAnalyses(leadId: number | null | undefined) {
  const client = useEmpresaSupabase();
  const { lead_ai_analises: table } = useEmpresaTable();
  const { schemaEmpresa, queriesReady } = useEmpresa();

  return useQuery({
    queryKey: leadAIAnalysesQueryKey(schemaEmpresa, leadId),
    enabled: queriesReady && !!leadId,
    queryFn: async (): Promise<LeadAIAnalise[]> => {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('lead_id', leadId!)
        .order('criado_em', { ascending: false });

      if (error) {
        if (isMissingDbRelationError(error)) return [];
        throw error;
      }
      return (data as DBLeadAIAnalise[]).map(adaptAnalise);
    },
    retry: (failureCount, err) => !isMissingDbRelationError(err) && failureCount < 2,
  });
}

export function useAnalyzeLeadPhotos(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: async (input: AnalyzeLeadPhotosInput) =>
      invokeAnalyzeLeadPhotos({ ...input, empresaSchema: schemaEmpresa }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: leadAIAnalysesQueryKey(schemaEmpresa, leadId),
      });
      toast.success(
        result.perguntasBriefing
          ? 'Análise e perguntas de briefing concluídas'
          : 'Análise concluída',
      );
    },
    onError: (err: Error) => {
      toast.error('Não foi possível analisar as imagens', {
        description: err.message,
      });
    },
  });
}

export function useDeleteLeadAIAnalysis(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const client = useEmpresaSupabase();
  const { lead_ai_analises: table } = useEmpresaTable();
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: async (analiseId: string) => {
      const { error } = await client.from(table).delete().eq('id', analiseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: leadAIAnalysesQueryKey(schemaEmpresa, leadId),
      });
      toast.success('Análise excluída do histórico');
    },
    onError: (err: Error) => {
      toast.error('Não foi possível excluir a análise', {
        description: err.message,
      });
    },
  });
}
