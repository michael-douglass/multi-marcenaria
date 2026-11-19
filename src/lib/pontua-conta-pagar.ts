/**
 * Conta a pagar gerada quando comissão Pontua entra em aguardando liberação.
 * Formato: "{Nome do Arquiteto} — Pontua"
 */
export function buildDescricaoContaPagarPontua(nomeArquiteto: string): string {
  const nome = (nomeArquiteto ?? '').trim() || 'Arquiteto';
  return `${nome} — Pontua`;
}

/** Marcador em observacao para idempotência (não duplicar conta). */
export function buildObservacaoContaPagarPontua(
  liberacaoId: string,
  leadNome?: string | null,
  leadId?: number | null,
): string {
  const leadLabel =
    (leadNome ?? '').trim() || (leadId != null ? `#${leadId}` : 'Lead');
  return `Lead: ${leadLabel}\npontua_liberacao:${liberacaoId}`;
}
