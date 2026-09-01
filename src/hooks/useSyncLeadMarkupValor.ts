import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLeads } from '@/hooks/useLeads';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { leadDetailQueryKey } from '@/lib/leads-cache';

export function useSyncLeadMarkupValor() {
  const { updateLead } = useLeads({ fetchLeads: false });
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const mutateAsync = updateLead.mutateAsync;
  const inFlightRef = useRef(new Set<string>());

  const syncValorLead = useCallback(
    async (
      leadId: number | null | undefined,
      precoFinal: number,
      options?: { onlyIfEmpty?: boolean },
    ) => {
      if (!leadId) return;
      if (precoFinal <= 0) return;

      const detalhe = queryClient.getQueryData<{ valor_orcamento?: number | null }>(
        leadDetailQueryKey(leadId, schemaEmpresa),
      );
      const atual = Number(detalhe?.valor_orcamento ?? NaN);
      if (Number.isFinite(atual) && Math.abs(atual - precoFinal) < 0.005) return;
      // Ao abrir o card: não apaga um orçamento já preenchido, nem dispara PATCH
      // se o cache ainda não tem o valor (isso inundava o navegador).
      if (options?.onlyIfEmpty) {
        if (!Number.isFinite(atual)) return;
        if (atual > 0) return;
      }

      const flightKey = `${schemaEmpresa ?? 'master'}:${leadId}:${options?.onlyIfEmpty ? 'empty' : 'force'}`;
      if (inFlightRef.current.has(flightKey)) return;
      inFlightRef.current.add(flightKey);
      try {
        await mutateAsync({
          id: leadId,
          updates: { valor_orcamento: precoFinal },
          silent: true,
        });
      } finally {
        inFlightRef.current.delete(flightKey);
      }
    },
    [mutateAsync, queryClient, schemaEmpresa],
  );

  return { syncValorLead, isSyncing: updateLead.isPending };
}
