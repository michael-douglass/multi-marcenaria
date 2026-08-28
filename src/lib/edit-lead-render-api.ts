import { supabase } from '@/integrations/supabase/client';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import type { LeadAIRenderEditPonto } from '@/lib/lead-ai-render-edit-markers';

export interface EditLeadRenderInput {
  leadId: number;
  empresaSchema: string | null | undefined;
  parentRenderId?: string;
  editNotas: string;
  editPontos: LeadAIRenderEditPonto[];
  maskImageBase64?: string;
  markedImageBase64?: string;
  sourceImageUrl?: string;
  sourceImageBase64?: string;
  inputSnapshot?: LeadAIAnalysisItemPayload;
}

export interface EditLeadRenderResult {
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

function invokeFunctionErrorMessage(error: { message?: string; name?: string }): string | null {
  const msg = error.message ?? '';
  const isUnreachable =
    msg.includes('Failed to send') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    error.name === 'FunctionsFetchError';
  if (isUnreachable) {
    return 'Serviço de edição indisponível. Verifique se a função edit-lead-render foi publicada no Supabase.';
  }
  return null;
}

async function readEdgeFunctionError(error: unknown, data: unknown): Promise<string | null> {
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return String(data.error);
  }

  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const body = (await context.json()) as { error?: string };
        if (body?.error) return body.error;
      } catch {
        // ignore
      }
    }
  }

  return null;
}

export async function invokeEditLeadRender(input: EditLeadRenderInput): Promise<EditLeadRenderResult> {
  const { data, error } = await supabase.functions.invoke('edit-lead-render', {
    body: {
      leadId: input.leadId,
      empresaSchema: input.empresaSchema,
      parentRenderId: input.parentRenderId,
      editNotas: input.editNotas,
      editPontos: input.editPontos,
      maskImageBase64: input.maskImageBase64,
      markedImageBase64: input.markedImageBase64,
      sourceImageUrl: input.sourceImageUrl,
      sourceImageBase64: input.sourceImageBase64,
      inputSnapshot: input.inputSnapshot,
    },
  });

  if (error) {
    const unreachable = invokeFunctionErrorMessage(error);
    if (unreachable) throw new Error(unreachable);
    const detail = await readEdgeFunctionError(error, data);
    if (detail) throw new Error(detail);
    if (data?.error) throw new Error(String(data.error));
    throw error;
  }
  if (data?.error) throw new Error(String(data.error));

  return {
    id: data.renderId,
    leadId: input.leadId,
    inputSnapshot: data.inputSnapshot,
    analiseTexto: data.analiseTexto,
    outputStoragePath: '',
    outputPublicUrl: data.outputUrl,
    visionModel: '',
    imageModel: '',
    renderPromptSnapshot: '',
    parentRenderId: data.parentRenderId ?? input.parentRenderId ?? null,
    editNotas: data.editNotas ?? input.editNotas,
    editPontos: data.editPontos ?? input.editPontos,
    criadoPor: null,
    criadoEm: data.criadoEm,
  };
}
