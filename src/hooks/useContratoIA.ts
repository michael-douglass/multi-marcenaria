import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { parseSupabaseFunctionError } from '@/lib/parse-supabase-function-error';
import {
  filtrarFieldPatches,
  sanitizeDocumentReplacements,
  sanitizeSugestoesCorrecao,
  sugestoesParaReplacements,
  type ContratoIARequest,
  type ContratoIAResponse,
  type ContratoIAPendingPatch,
} from '@/lib/contrato-ia';

export type { ContratoIAPendingPatch, ContratoIARequest, ContratoIAResponse };

export interface ComposeContratoIAInput {
  message: string;
  etapa: 1 | 2;
  variaveis: ContratoIARequest['variaveis'];
  valores: Record<string, string>;
  conteudoContrato?: string | null;
  modeloConteudo?: string | null;
  forcarEdicaoDocumento?: boolean;
}

function parseInvokeData(data: unknown): Partial<ContratoIAResponse> {
  if (data == null) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Partial<ContratoIAResponse>;
    } catch {
      return {};
    }
  }
  if (typeof data === 'object') {
    return data as Partial<ContratoIAResponse>;
  }
  return {};
}

async function invokeComposeContratoIA(
  body: ContratoIARequest & { forcarEdicaoDocumento?: boolean },
): Promise<ContratoIAResponse> {
  const { data, error } = await supabase.functions.invoke('compose-contrato-ia', {
    body,
  });

  const raw = parseInvokeData(data);

  if (error || (typeof raw.error === 'string' && raw.error.trim())) {
    const message = await parseSupabaseFunctionError(error, data);
    throw new Error(message);
  }

  const allowed = body.variaveis.map((v) => v.nome);
  const documentReplacements = sanitizeDocumentReplacements(raw.documentReplacements);
  const sugestoesCorrecao = sanitizeSugestoesCorrecao(
    raw.sugestoesCorrecao,
    documentReplacements,
  );
  const replacementsFromSugestoes = sugestoesParaReplacements(sugestoesCorrecao);

  return {
    ok: raw.ok !== false,
    reply: typeof raw.reply === 'string' ? raw.reply : 'Pronto.',
    fieldPatches: filtrarFieldPatches(raw.fieldPatches ?? {}, allowed),
    documentPatch:
      typeof raw.documentPatch === 'string' && raw.documentPatch.trim()
        ? raw.documentPatch
        : null,
    documentReplacements:
      replacementsFromSugestoes.length > 0
        ? replacementsFromSugestoes
        : documentReplacements,
    sugestoesCorrecao,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w): w is string => typeof w === 'string')
      : [],
    skipped: Array.isArray(raw.skipped)
      ? raw.skipped.filter((w): w is string => typeof w === 'string')
      : [],
    modelo: typeof raw.modelo === 'string' ? raw.modelo : undefined,
    aguardandoAplicacao: raw.aguardandoAplicacao === true,
  };
}

export function useComposeContratoIA() {
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: async (input: ComposeContratoIAInput): Promise<ContratoIAPendingPatch> => {
      const forcar = Boolean(input.forcarEdicaoDocumento) || input.etapa === 2;
      const response = await invokeComposeContratoIA({
        ...input,
        modeloConteudo:
          input.etapa === 2 && input.conteudoContrato?.trim()
            ? null
            : input.modeloConteudo ?? null,
        empresaSchema: schemaEmpresa ?? null,
        forcarEdicaoDocumento: forcar,
      });

      return {
        reply: response.reply,
        fieldPatches: response.fieldPatches,
        documentPatch: input.etapa === 1 ? null : response.documentPatch,
        documentReplacements:
          input.etapa === 1 ? [] : response.documentReplacements,
        sugestoesCorrecao: input.etapa === 1 ? [] : response.sugestoesCorrecao,
        warnings: response.warnings,
        skipped: response.skipped,
        aguardandoAplicacao: response.aguardandoAplicacao,
      };
    },
  });
}
