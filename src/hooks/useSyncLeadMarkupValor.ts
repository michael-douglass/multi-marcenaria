import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLeads } from '@/hooks/useLeads';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { leadDetailQueryKey } from '@/lib/leads-cache';

export function useSyncLeadMarkupValor() {
  const { updateLead } = useLeads({ fetchLeads: false });
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();

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
      // Ao abrir o card: não apaga um orçamento já preenchido manualmente.
      if (options?.onlyIfEmpty && Number.isFinite(atual) && atual > 0) return;

      await updateLead.mutateAsync({
        id: leadId,
        updates: { valor_orcamento: precoFinal },
        silent: true,
      });
    },
    [updateLead, queryClient, schemaEmpresa],
  );

  return { syncValorLead, isSyncing: updateLead.isPending };
}
