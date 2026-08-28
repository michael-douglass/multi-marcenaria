/**
 * Link público do formulário do lead (sem login / sem cadastro).
 * O token aponta para aquele card; ao enviar, cria contrato em rascunho no lead.
 */
export function linkPublicoFormInicioOrcamento(
  schema: string,
  token: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  return `${origin}/iniciar-orcamento/${schema}/${token}`;
}

export function gerarTokenFormOrcamento(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `form-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
