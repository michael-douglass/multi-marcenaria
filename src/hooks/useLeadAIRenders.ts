import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresaTable } from '@/hooks/useEmpresaTable';
import { useEmpresa } from '@/contexts/EmpresaContext';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import type { LeadAIRenderEditPonto } from '@/lib/lead-ai-render-edit-markers';
import { deleteAiRenderAttachment } from '@/lib/lead-ai-render-attachments';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import { isMissingDbRelationError } from '@/lib/supabase-missing-relation';
import { toast } from 'sonner';
import {
  invokeRenderLeadProject,
  type RenderLeadProjectInput,
  type RenderLeadProjectResult,
} from '@/lib/render-lead-project-api';
import {
  invokeEditLeadRender,
  type EditLeadRenderInput as EditLeadRenderApiInput,
} from '@/lib/edit-lead-render-api';

export interface LeadAIRender {
  id: string;
  leadId: number;
  inputSnapshot: LeadAIAnalysisItemPayload;
  analiseTexto: string;
  outputStoragePath: string;
  outputPublicUrl: string;
  visionModel: string;
  imageModel: string;
  renderPromptSnapshot: string;
  parentRenderId: string | null;
  editNotas: string | null;
  editPontos: LeadAIRenderEditPonto[] | null;
  criadoPor: string | null;
  criadoEm: string;
}

interface DBLeadAIRender {
  id: string;
  lead_id: number;
  input_snapshot: LeadAIAnalysisItemPayload;
  analise_texto: string;
  output_storage_path: string;
  output_public_url: string;
  vision_model: string;
  image_model: string;
  render_prompt_snapshot?: string;
  parent_render_id?: string | null;
  edit_notas?: string | null;
  edit_pontos?: LeadAIRenderEditPonto[] | null;
  criado_por: string | null;
  criado_em: string;
}

function adaptRender(row: DBLeadAIRender): LeadAIRender {
  return {
    id: row.id,
    leadId: row.lead_id,
    inputSnapshot: row.input_snapshot ?? { source: 'anexo', id: '', label: '' },
    analiseTexto: row.analise_texto,
    outputStoragePath: row.output_storage_path,
    outputPublicUrl: row.output_public_url,
    visionModel: row.vision_model,
    imageModel: row.image_model,
    renderPromptSnapshot: row.render_prompt_snapshot ?? '',
    parentRenderId: row.parent_render_id ?? null,
    editNotas: row.edit_notas ?? null,
    editPontos: row.edit_pontos ?? null,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
  };
}

export const leadAIRendersQueryKey = (
  schema: string | null | undefined,
  leadId: number | null | undefined,
) => ['lead-ai-renders', schema, leadId] as const;

export function useLeadAIRenders(leadId: number | null | undefined) {
  const client = useEmpresaSupabase();
  const { lead_ai_renders: table } = useEmpresaTable();
  const { schemaEmpresa, queriesReady } = useEmpresa();

  return useQuery({
    queryKey: leadAIRendersQueryKey(schemaEmpresa, leadId),
    enabled: queriesReady && !!leadId,
    queryFn: async (): Promise<LeadAIRender[]> => {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('lead_id', leadId!)
        .order('criado_em', { ascending: false });

      if (error) {
        if (isMissingDbRelationError(error)) return [];
        throw error;
      }
      return (data as DBLeadAIRender[]).map(adaptRender);
    },
    retry: (failureCount, err) => !isMissingDbRelationError(err) && failureCount < 2,
  });
}

export type { RenderLeadProjectInput, RenderLeadProjectResult } from '@/lib/render-lead-project-api';
export type { EditLeadRenderInput } from '@/lib/edit-lead-render-api';

export interface EditLeadRenderMutationInput extends Omit<EditLeadRenderApiInput, 'empresaSchema'> {}

export function useRenderLeadProject(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: async (
      input: Omit<RenderLeadProjectInput, 'empresaSchema'>,
    ): Promise<RenderLeadProjectResult> =>
      invokeRenderLeadProject({ ...input, empresaSchema: schemaEmpresa }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: leadAIRendersQueryKey(schemaEmpresa, leadId),
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-pdfs', schemaEmpresa ?? 'master', leadId],
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-midias-para-orcamento', schemaEmpresa, leadId],
      });
      toast.success('Renderização concluída e adicionada aos anexos do lead');
    },
    onError: (err: Error) => {
      toast.error('Não foi possível renderizar o projeto', {
        description: err.message,
      });
    },
  });
}

export function useEditLeadRender(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: async (input: EditLeadRenderMutationInput): Promise<LeadAIRender> =>
      invokeEditLeadRender({ ...input, empresaSchema: schemaEmpresa }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: leadAIRendersQueryKey(schemaEmpresa, leadId),
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-pdfs', schemaEmpresa ?? 'master', leadId],
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-midias-para-orcamento', schemaEmpresa, leadId],
      });
      toast.success('Edição salva no lead — você já pode baixar ou excluir');
    },
    onError: (err: Error) => {
      toast.error('Não foi possível aplicar a edição', {
        description: err.message,
      });
    },
  });
}

export function useDeleteLeadAIRender(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const client = useEmpresaSupabase();
  const { lead_ai_renders: table } = useEmpresaTable();
  const { schemaEmpresa } = useEmpresa();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);

  return useMutation({
    mutationFn: async (input: LeadAIRender & { silent?: boolean }) => {
      const { silent: _silent, ...render } = input;
      if (render.outputStoragePath) {
        await supabase.storage.from('lead-ai-renders').remove([render.outputStoragePath]);
      }

      const mediasDb = mediasConfig.schema ? client.schema(mediasConfig.schema) : client;
      await deleteAiRenderAttachment(
        mediasDb,
        mediasConfig.mediasTable,
        render.leadId,
        render.id,
      );

      const { error } = await client.from(table).delete().eq('id', render.id);
      if (error) throw error;
      return { silent: Boolean(_silent) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: leadAIRendersQueryKey(schemaEmpresa, leadId),
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-pdfs', schemaEmpresa ?? 'master', leadId],
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-midias-para-orcamento', schemaEmpresa, leadId],
      });
      queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
      if (!result.silent) {
        toast.success('Renderização excluída', {
          description: 'A imagem foi removida do histórico e dos anexos do lead.',
        });
      }
    },
    onError: (err: Error, variables) => {
      if (variables.silent) return;
      toast.error('Não foi possível excluir a renderização', {
        description: err.message,
      });
    },
  });
}
