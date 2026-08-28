import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tabelas de histórico WhatsApp (n8n), em ordem de prioridade.
 * Inclui nomes multi-empresa e legado — evita 404 quando só uma existe no banco.
 */
const N8N_HISTORY_TABLES = [
  'crm_multiempresas_n8n_chat_histories',
  'n8n_chat_histories',
  'crm_multiempresas_n8n_chat_histories_proforco_saopaulo',
  'n8n_chat_histories_proforco_saopaulo',
] as const;

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.includes('does not exist') === true ||
    error.message?.includes('404') === true
  );
}

/** Verifica se existe mensagem n8n para o telefone em alguma tabela disponível. */
export async function hasN8nHistoryForPhone(
  client: SupabaseClient,
  telefone: string
): Promise<boolean> {
  for (const table of N8N_HISTORY_TABLES) {
    const { data, error } = await client
      .from(table)
      .select('id')
      .ilike('session_id', `%${telefone}%`)
      .order('id', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      return true;
    }
    if (error && !isMissingTableError(error)) {
      console.warn(`[n8n] Erro ao consultar ${table}:`, error.message);
    }
  }
  return false;
}
