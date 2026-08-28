export const ORCAMENTO_RETURN_TO_PARAM = 'returnTo';

/** Monta URL para reabrir o card do lead na página em que o usuário estava. */
export function buildLeadCardReturnTo(pathname: string, search: string, leadId: number): string {
  const params = new URLSearchParams(search);
  params.set('id', String(leadId));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Adiciona returnTo a uma rota de orçamento (criar/editar). */
export function withOrcamentoReturnTo(path: string, returnTo: string): string {
  const [pathname, existingSearch = ''] = path.split('?');
  const params = new URLSearchParams(existingSearch);
  params.set(ORCAMENTO_RETURN_TO_PARAM, returnTo);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function resolveOrcamentoReturnTo(
  searchParams: URLSearchParams,
  locationState?: unknown,
  options?: { leadId?: number | null },
): string {
  const fromQuery = searchParams.get(ORCAMENTO_RETURN_TO_PARAM);
  if (fromQuery) return fromQuery;

  const state = locationState as { returnTo?: string } | null | undefined;
  if (state?.returnTo) return state.returnTo;

  if (options?.leadId != null) {
    return `/pipeline?id=${options.leadId}`;
  }

  return '/orcamento-slides';
}
