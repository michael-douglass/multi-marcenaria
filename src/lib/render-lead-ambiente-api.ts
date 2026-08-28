import { supabase } from '@/integrations/supabase/client';
import { parseSupabaseFunctionError } from '@/lib/parse-supabase-function-error';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';

export interface RenderLeadAmbienteAnalyzeInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  descricao?: string;
  imageDataUrl?: string;
  empresaSchema: string | null | undefined;
}

export interface RenderLeadAmbienteRenderInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  descricao?: string;
  analiseTexto?: string;
  compositionDataUrl?: string;
  sourceImageDataUrl?: string;
  empresaSchema: string | null | undefined;
}

export interface RenderLeadAmbienteResult {
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
    return 'Serviço de renderização de ambiente indisponível. Verifique se a função render-lead-ambiente foi publicada no Supabase.';
  }
  return null;
}

function formatAmbienteErrorMessage(raw: string, data: unknown): string {
  const step =
    data && typeof data === 'object' && 'step' in data
      ? String((data as { step?: string }).step ?? '')
      : '';
  const imageModel =
    data && typeof data === 'object' && 'imageModel' in data
      ? String((data as { imageModel?: string }).imageModel ?? '')
      : '';

  if (step === 'vision') {
    return `Falha ao desmembrar o ambiente: ${raw}`;
  }
  if (step === 'render') {
    const modelHint = imageModel ? ` (modelo: ${imageModel})` : '';
    return `Falha ao gerar a imagem do ambiente${modelHint}: ${raw}`;
  }
  return raw;
}

async function invokeAmbiente(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('render-lead-ambiente', { body });

  if (data?.error) {
    throw new Error(formatAmbienteErrorMessage(String(data.error), data));
  }

  if (error) {
    const unreachable = invokeFunctionErrorMessage(error);
    if (unreachable) throw new Error(unreachable);
    const parsed = await parseSupabaseFunctionError(error, data);
    throw new Error(formatAmbienteErrorMessage(parsed, data));
  }

  return (data ?? {}) as Record<string, unknown>;
}

export async function invokeAnalyzeLeadAmbiente(
  input: RenderLeadAmbienteAnalyzeInput,
): Promise<string> {
  const data = await invokeAmbiente({
    action: 'analyze',
    leadId: input.leadId,
    empresaSchema: input.empresaSchema,
    leadName: input.leadName,
    leadOrigin: input.leadOrigin,
    descricao: input.descricao,
    sourceImageBase64: input.imageDataUrl,
  });

  const analiseTexto = typeof data.analiseTexto === 'string' ? data.analiseTexto : '';
  if (!analiseTexto.trim()) {
    throw new Error('A IA não retornou a análise do ambiente');
  }
  return analiseTexto;
}

export async function invokeRenderLeadAmbiente(
  input: RenderLeadAmbienteRenderInput,
): Promise<RenderLeadAmbienteResult> {
  const data = await invokeAmbiente({
    action: 'render',
    leadId: input.leadId,
    empresaSchema: input.empresaSchema,
    leadName: input.leadName,
    leadOrigin: input.leadOrigin,
    descricao: input.descricao,
    analiseTexto: input.analiseTexto,
    compositionImageBase64: input.compositionDataUrl,
    sourceImageBase64: input.sourceImageDataUrl,
  });

  return {
    renderId: String(data.renderId ?? ''),
    outputUrl: String(data.outputUrl ?? ''),
    analiseTexto: String(data.analiseTexto ?? ''),
    criadoEm: String(data.criadoEm ?? new Date().toISOString()),
    inputSnapshot: (data.inputSnapshot ?? {
      source: 'anexo',
      id: '',
      label: 'Composição de ambiente',
      mode: 'ambiente',
    }) as LeadAIAnalysisItemPayload,
  };
}
