/**
 * Conta a pagar gerada quando comissão Pontua Garbo entra em aguardando liberação.
 * Formato: "{Nome do Arquiteto} — Pontua Garbo"
 */
export function buildDescricaoContaPagarPontuaGarbo(nomeArquiteto: string): string {
  const nome = (nomeArquiteto ?? '').trim() || 'Arquiteto';
  return `${nome} — Pontua Garbo`;
}

/** Marcador em observacao para idempotência (não duplicar conta). */
export function buildObservacaoContaPagarPontuaGarbo(
  liberacaoId: string,
  leadNome?: string | null,
  leadId?: number | null,
): string {
  const leadLabel =
    (leadNome ?? '').trim() || (leadId != null ? `#${leadId}` : 'Lead');
  return `Lead: ${leadLabel}\npontua_liberacao:${liberacaoId}`;
}
