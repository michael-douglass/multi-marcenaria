import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zzqgtclvuetemzhqzhbq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6cWd0Y2x2dWV0ZW16aHF6aGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4NDQxNjAsImV4cCI6MjA2MDQyMDE2MH0.3DizjUqKh1-pXhEK0dc-SC04NI4Aksch2FhU9vR8-Pk';

export interface FormInicioOrcamentoCampo {
  nome: string;
  label: string;
  tipo: 'texto' | 'data' | 'valor' | 'cpf' | string;
  obrigatorio: boolean;
  ordem: number;
  valor_prefill: string;
}

export interface FormInicioOrcamentoPayload {
  lead_id: number;
  cliente_nome: string;
  empresa_nome: string | null;
  campos: FormInicioOrcamentoCampo[];
}

export interface FormInicioOrcamentoResult {
  orcamento_id: string;
  contrato_id?: string;
  lead_id: number;
  identificador: string;
  cliente_nome: string;
}

function publicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

function rpcErrorMessage(error: { message?: string; details?: string; hint?: string } | null): string {
  if (!error) return 'Erro desconhecido';
  const msg = error.message ?? '';
  if (msg.includes('Link inválido')) return 'Link inválido ou expirado.';
  if (msg.includes('Nenhum campo configurado')) {
    return 'A empresa ainda não escolheu quais campos aparecem neste formulário.';
  }
  if (msg.includes('Campo obrigatório')) return msg.replace(/^.*Campo obrigatório/, 'Campo obrigatório');
  return error.details || error.hint || msg || 'Não foi possível carregar o formulário.';
}

export async function lerFormInicioOrcamento(
  schema: string,
  token: string,
): Promise<FormInicioOrcamentoPayload> {
  const { data, error } = await publicClient().rpc('ler_form_inicio_orcamento', {
    p_schema: schema,
    p_token: token,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  const payload = data as FormInicioOrcamentoPayload;
  return {
    lead_id: payload.lead_id,
    cliente_nome: payload.cliente_nome ?? '',
    empresa_nome: payload.empresa_nome ?? null,
    campos: Array.isArray(payload.campos) ? payload.campos : [],
  };
}

export async function submeterFormInicioOrcamento(
  schema: string,
  token: string,
  valores: Record<string, string>,
): Promise<FormInicioOrcamentoResult> {
  const { data, error } = await publicClient().rpc('submeter_form_inicio_orcamento', {
    p_schema: schema,
    p_token: token,
    p_valores: valores,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data as FormInicioOrcamentoResult;
}
