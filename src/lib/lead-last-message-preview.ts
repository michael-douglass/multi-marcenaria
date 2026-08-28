/** Preview curto da última mensagem do chat para o card do Kanban. */

export interface ChatMessagePreviewInput {
  conteudo: string | null;
  criado_em: string;
  tipo_mensagem: string | null;
  tipo_remetente: string | null;
}

export interface LeadLastMessagePreview {
  lastMessage: string;
  lastMessageAt: string;
  lastMessageType: string | null;
  isFromLead: boolean;
}

export function formatChatMessagePreview(
  msg: ChatMessagePreviewInput,
  maxLength = 50,
): LeadLastMessagePreview {
  let content = msg.conteudo || '';

  if (msg.tipo_mensagem === 'imagem') {
    content = '📷 Imagem';
  } else if (msg.tipo_mensagem === 'audio') {
    content = '🎵 Áudio';
  } else if (msg.tipo_mensagem === 'pdf' || msg.tipo_mensagem === 'document') {
    content = '📄 Documento';
  }

  if (content.length > maxLength) {
    content = content.substring(0, maxLength - 3) + '...';
  }

  return {
    lastMessage: content,
    lastMessageAt: msg.criado_em,
    lastMessageType: msg.tipo_mensagem,
    isFromLead: msg.tipo_remetente === 'lead',
  };
}

export function normalizePhoneDigits(telefone: string | null | undefined): string {
  return (telefone ?? '').replace(/\D/g, '');
}

export function phoneVariants(telefone: string): string[] {
  const clean = normalizePhoneDigits(telefone);
  if (!clean) return [];
  const withCountry = clean.startsWith('55') ? clean : `55${clean}`;
  const withoutCountry =
    clean.startsWith('55') && clean.length > 11 ? clean.slice(2) : clean;
  return [...new Set([clean, withCountry, withoutCountry].filter(Boolean))];
}

/**
 * Mantém só a mensagem mais recente por telefone.
 * Exige a lista já ordenada por criado_em DESC.
 */
export function firstMessageByPhone<T extends { telefone: string }>(
  messages: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const msg of messages) {
    const phone = normalizePhoneDigits(msg.telefone);
    if (!phone || map.has(phone)) continue;
    map.set(phone, msg);
  }
  return map;
}

export function stableLeadPhonesKey(
  leads: Array<{ id: number; telefone?: string | null }>,
): string {
  return leads
    .map((l) => `${l.id}:${normalizePhoneDigits(l.telefone)}`)
    .sort()
    .join(',');
}
