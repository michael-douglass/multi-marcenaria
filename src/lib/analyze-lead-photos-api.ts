import { supabase } from '@/integrations/supabase/client';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';

export interface AnalyzeLeadPhotosInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  itens: LeadAIAnalysisItemPayload[];
  empresaSchema: string | null | undefined;
}

export interface AnalyzeLeadPhotosResult {
  analiseId: string;
  conteudo: string;
  perguntasBriefing: string | null;
  criadoEm: string;
}

export async function invokeAnalyzeLeadPhotos(
  input: AnalyzeLeadPhotosInput,
): Promise<AnalyzeLeadPhotosResult> {
  const { data, error } = await supabase.functions.invoke('analyze-lead-photos', {
    body: {
      leadId: input.leadId,
      empresaSchema: input.empresaSchema,
      leadName: input.leadName,
      leadOrigin: input.leadOrigin,
      itens: input.itens,
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
        'Serviço de análise IA indisponível. A função analyze-lead-photos ainda não foi publicada no Supabase.',
      );
    }
    throw error;
  }
  if (data?.error) throw new Error(String(data.error));

  return {
    analiseId: data.analiseId,
    conteudo: data.conteudo,
    perguntasBriefing: data.perguntasBriefing ?? null,
    criadoEm: data.criadoEm,
  };
}
