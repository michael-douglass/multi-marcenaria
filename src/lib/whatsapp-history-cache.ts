/** Aplica uma mensagem CRM nova no cache do histórico, sem refetch. */

export interface WhatsAppHistoryMessage {
  id: number | string;
  type: 'human' | 'ai';
  content: string;
  empresa: string;
  origem?: 'n8n' | 'crm' | 'webhook';
  criado_em?: string;
  tipo_mensagem?: string;
  url_midia?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  _sortOrder?: number;
}

export interface WhatsAppHistoryCache {
  messages: WhatsAppHistoryMessage[];
}

export interface CrmChatInsertRow {
  id?: number | string;
  telefone?: string | null;
  tipo_remetente?: string | null;
  conteudo?: string | null;
  url_midia?: string | null;
  tipo_mensagem?: string | null;
  origem?: string | null;
  criado_em?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
}

export function mapCrmRowToHistoryMessage(msg: CrmChatInsertRow): WhatsAppHistoryMessage {
  return {
    id: msg.id ?? `${Date.now()}`,
    type: msg.tipo_remetente === 'lead' ? 'human' : 'ai',
    content: msg.conteudo || (msg.url_midia ? `[${msg.tipo_mensagem}]` : ''),
    empresa: msg.tipo_remetente === 'lead' ? 'Lead' : 'CRM',
    origem: (msg.origem as 'crm' | 'webhook') || 'crm',
    criado_em: msg.criado_em ?? undefined,
    tipo_mensagem: msg.tipo_mensagem || 'texto',
    url_midia: msg.url_midia || null,
    file_name: msg.file_name || null,
    mime_type: msg.mime_type || null,
    _sortOrder: undefined,
  };
}

export function appendCrmMessageToHistory(
  current: WhatsAppHistoryCache | undefined,
  row: CrmChatInsertRow,
): WhatsAppHistoryCache {
  const mapped = mapCrmRowToHistoryMessage(row);
  const messages = current?.messages ?? [];
  if (messages.some((m) => String(m.id) === String(mapped.id) && m.origem !== 'n8n')) {
    return { messages };
  }
  return { messages: [...messages, mapped] };
}

export function phoneMatchesVariants(telefone: string | null | undefined, variants: string[]): boolean {
  const clean = String(telefone ?? '').replace(/\D/g, '');
  if (!clean) return false;
  return variants.includes(clean);
}
