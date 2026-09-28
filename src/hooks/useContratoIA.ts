import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { parseSupabaseFunctionError } from '@/lib/parse-supabase-function-error';
import {
  filtrarFieldPatches,
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
}

async function invokeComposeContratoIA(
  body: ContratoIARequest,
): Promise<ContratoIAResponse> {
  const { data, error } = await supabase.functions.invoke('compose-contrato-ia', {
    body,
  });

  if (error || (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error)) {
    const message = await parseSupabaseFunctionError(error, data);
    throw new Error(message);
  }

  const raw = (data ?? {}) as Partial<ContratoIAResponse>;
  const allowed = body.variaveis.map((v) => v.nome);

  return {
    ok: raw.ok !== false,
    reply: typeof raw.reply === 'string' ? raw.reply : 'Pronto.',
    fieldPatches: filtrarFieldPatches(raw.fieldPatches ?? {}, allowed),
    documentPatch:
      typeof raw.documentPatch === 'string' && raw.documentPatch.trim()
        ? raw.documentPatch
        : null,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w): w is string => typeof w === 'string')
      : [],
    skipped: Array.isArray(raw.skipped)
      ? raw.skipped.filter((w): w is string => typeof w === 'string')
      : [],
    modelo: typeof raw.modelo === 'string' ? raw.modelo : undefined,
  };
}

export function useComposeContratoIA() {
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: async (input: ComposeContratoIAInput): Promise<ContratoIAPendingPatch> => {
      const response = await invokeComposeContratoIA({
        ...input,
        empresaSchema: schemaEmpresa ?? null,
      });

      return {
        reply: response.reply,
        fieldPatches: response.fieldPatches,
        documentPatch: input.etapa === 1 ? null : response.documentPatch,
        warnings: response.warnings,
        skipped: response.skipped,
      };
    },
  });
}
