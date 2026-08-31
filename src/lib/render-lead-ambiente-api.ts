import { supabase } from '@/integrations/supabase/client';
import { parseSupabaseFunctionError } from '@/lib/parse-supabase-function-error';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';

export interface RenderLeadAmbienteAnalyzeInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  descricao?: string;
  imageDataUrl?: string;
  cenaInventario?: string;
  empresaSchema: string | null | undefined;
}

export interface RenderLeadAmbienteFurnitureReference {
  label: string;
  dataUrl: string;
}

export interface RenderLeadAmbienteRenderInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  descricao?: string;
  analiseTexto?: string;
  cenaInventario?: string;
  compositionDataUrl?: string;
  sourceImageDataUrl?: string;
  furnitureReferences?: RenderLeadAmbienteFurnitureReference[];
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
  const isAbort =
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    /abort/i.test(msg) ||
    /timeout/i.test(msg);
  if (isAbort) {
    return 'A geração do ambiente ainda está em andamento no servidor. Não clique de novo — a imagem aparece no histórico quando terminar.';
  }
  const isUnreachable =
    msg.includes('Failed to send') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    error.name === 'FunctionsFetchError';
  if (isUnreachable) {
    return 'Não foi possível enviar a montagem ao servidor. A foto da lousa pode estar pesada demais — tente de novo com uma foto menor.';
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

const MAX_AMBIENTE_BODY_CHARS = 3_200_000;

function pruneAmbienteBody(body: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body };
  const sizeOf = () => JSON.stringify(next).length;

  if (sizeOf() > MAX_AMBIENTE_BODY_CHARS && Array.isArray(next.furnitureReferences)) {
    next.furnitureReferences = [];
  }
  if (
    sizeOf() > MAX_AMBIENTE_BODY_CHARS &&
    next.sourceImageBase64 &&
    next.compositionImageBase64
  ) {
    delete next.sourceImageBase64;
  }
  if (sizeOf() > MAX_AMBIENTE_BODY_CHARS) {
    throw new Error(
      'A montagem ficou pesada demais para enviar. Use uma foto menor na lousa ou posicione menos imagens.',
    );
  }
  return next;
}

async function invokeAmbiente(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const payload = pruneAmbienteBody(body);
  const { data, error } = await supabase.functions.invoke('render-lead-ambiente', { body: payload });

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
    compositionImageBase64: input.imageDataUrl,
    cenaInventario: input.cenaInventario,
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
    cenaInventario: input.cenaInventario,
    compositionImageBase64: input.compositionDataUrl,
    sourceImageBase64: input.compositionDataUrl ? undefined : input.sourceImageDataUrl,
    furnitureReferences: input.furnitureReferences?.map((ref) => ({
      label: ref.label,
      imageBase64: ref.dataUrl,
    })),
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
