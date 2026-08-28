import type { QueryClient } from '@tanstack/react-query';

export const LEAD_KNOWLEDGE_REINDEX_KEY = 'lead-knowledge-reindex-bump';

export function bumpLeadKnowledgeReindex(
  queryClient: QueryClient,
  schemaEmpresa: string | null,
  leadId: number,
) {
  queryClient.setQueryData(
    [LEAD_KNOWLEDGE_REINDEX_KEY, schemaEmpresa ?? 'master', leadId],
    Date.now(),
  );
}
