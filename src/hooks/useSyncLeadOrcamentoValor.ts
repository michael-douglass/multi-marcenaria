import { useCallback } from 'react';
import type { OrcamentoPrecificacao } from '@/lib/orcamento-slide-types';
import { valorInvestimentoParaLead } from '@/lib/orcamento-slide-lead-sync';
import { useLeads } from '@/hooks/useLeads';

export function useSyncLeadOrcamentoValor() {
  const { updateLead } = useLeads({ fetchLeads: false });

  const syncValorLead = useCallback(
    async (leadId: number | null | undefined, prec: OrcamentoPrecificacao) => {
      if (!leadId) return;
      const valor = valorInvestimentoParaLead(prec);
      if (valor <= 0) return;

      await updateLead.mutateAsync({
        id: leadId,
        updates: { valor_orcamento: valor },
        silent: true,
      });
    },
    [updateLead],
  );

  return { syncValorLead, isSyncing: updateLead.isPending };
}
