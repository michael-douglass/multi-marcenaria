import type { QueryClient } from '@tanstack/react-query';
import type { LeadWithVendor } from '@/hooks/useLeads';

export function leadsListQueryKey(
  userId: string | undefined,
  schemaEmpresa: string | null | undefined,
) {
  return ['leads', userId, schemaEmpresa ?? 'master'] as const;
}

export function leadDetailQueryKey(
  leadId: number,
  schemaEmpresa: string | null | undefined,
) {
  return ['lead-detail', leadId, schemaEmpresa ?? 'master'] as const;
}

export function leadSingleEnrichedQueryKey(
  leadId: number,
  schemaEmpresa: string | null | undefined,
) {
  return ['lead-single-enriched', leadId, schemaEmpresa] as const;
}

/** Atualiza o lead em todas as queries de cache (lista, kanban, detalhe). */
export function patchLeadInAllCaches(
  queryClient: QueryClient,
  leadId: number,
  patch: Partial<LeadWithVendor>,
) {
  queryClient.setQueriesData<LeadWithVendor[]>(
    { queryKey: ['leads'] },
    (current) => {
      if (!current || !Array.isArray(current)) return current;
      if (!current.some((l) => l.id === leadId)) return current;
      return current.map((l) => (l.id === leadId ? { ...l, ...patch } : l));
    },
  );

  const detailKeys = [
    ['lead-detail', leadId],
    ['lead-single-enriched', leadId],
  ] as const;

  for (const keyPrefix of detailKeys) {
    queryClient.setQueriesData<LeadWithVendor>(
      { queryKey: [...keyPrefix] },
      (current) => (current ? { ...current, ...patch } : current),
    );
  }
}

export function setLeadDetailCache(
  queryClient: QueryClient,
  lead: LeadWithVendor,
  schemaEmpresa: string | null | undefined,
) {
  const schema = schemaEmpresa ?? 'master';
  queryClient.setQueryData(leadDetailQueryKey(lead.id, schema), lead);
  queryClient.setQueryData(leadSingleEnrichedQueryKey(lead.id, schema), lead);
  patchLeadInAllCaches(queryClient, lead.id, lead);
}

export function removeLeadFromAllCaches(queryClient: QueryClient, leadId: number) {
  queryClient.setQueriesData<LeadWithVendor[]>(
    { queryKey: ['leads'] },
    (current) => {
      if (!current || !Array.isArray(current)) return current;
      return current.filter((l) => l.id !== leadId);
    },
  );

  queryClient.removeQueries({ queryKey: ['lead-detail', leadId] });
  queryClient.removeQueries({ queryKey: ['lead-single-enriched', leadId] });
}
