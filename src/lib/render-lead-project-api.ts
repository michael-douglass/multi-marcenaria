import { supabase } from '@/integrations/supabase/client';
import { parseSupabaseFunctionError } from '@/lib/parse-supabase-function-error';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';

export interface RenderLeadProjectInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  item: LeadAIAnalysisItemPayload;
  caracteristicasExtras?: string;
  empresaSchema: string | null | undefined;
}

export interface RenderLeadProjectResult {
  renderId: string;
  outputUrl: string;
  analiseTexto: string;
  criadoEm: string;
  inputSnapshot: LeadAIAnalysisItemPayload;
}

function invokeFunctionErrorMessage(error: { message?: string; name?: string }): string | null {
  const msg = error.message ?? '';
  const isUnreachable =
    msg.includes('Failed to send') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    error.name === 'FunctionsFetchError';
  if (isUnreachable) {
    return 'Serviço de renderização indisponível. Verifique se a função render-lead-project foi publicada no Supabase.';
  }
  return null;
}

function formatRenderErrorMessage(raw: string, data: unknown): string {
  const step =
    data && typeof data === 'object' && 'step' in data
      ? String((data as { step?: string }).step ?? '')
      : '';
  const imageModel =
    data && typeof data === 'object' && 'imageModel' in data
      ? String((data as { imageModel?: string }).imageModel ?? '')
      : '';

  if (step === 'vision') {
    return `Falha ao analisar o esboço: ${raw}`;
  }
  if (step === 'render') {
    const modelHint = imageModel ? ` (modelo: ${imageModel})` : '';
    return `Falha ao gerar a imagem${modelHint}: ${raw}`;
  }
  return raw;
}

export async function invokeRenderLeadProject(
  input: RenderLeadProjectInput,
): Promise<RenderLeadProjectResult> {
  const { data, error } = await supabase.functions.invoke('render-lead-project', {
    body: {
      leadId: input.leadId,
      empresaSchema: input.empresaSchema,
      leadName: input.leadName,
      leadOrigin: input.leadOrigin,
      item: input.item,
      caracteristicasExtras: input.caracteristicasExtras,
    },
  });

  if (data?.error) {
    throw new Error(formatRenderErrorMessage(String(data.error), data));
  }

  if (error) {
    const unreachable = invokeFunctionErrorMessage(error);
    if (unreachable) throw new Error(unreachable);
    const parsed = await parseSupabaseFunctionError(error, data);
    throw new Error(formatRenderErrorMessage(parsed, data));
  }

  return {
    renderId: data.renderId,
    outputUrl: data.outputUrl,
    analiseTexto: data.analiseTexto,
    criadoEm: data.criadoEm,
    inputSnapshot: data.inputSnapshot,
  };
}
