import type { Lead } from '@/types/selletos';

export type LeadColumnCompareFn = (a: Lead, b: Lead) => number;

/**
 * Prioridade na coluna:
 * 1) "Dar atenção"
 * 2) IDs elevados (ex.: projeto feito pulsando, aguardando envio do orçamento)
 * 3) Comparador informado (manual / última interação / data)
 */
export function compareLeadsWithAttentionPriority(
  a: Lead,
  b: Lead,
  compareFn: LeadColumnCompareFn,
  elevateLeadIds?: ReadonlySet<number>,
): number {
  if (a.needsAttention && !b.needsAttention) return -1;
  if (!a.needsAttention && b.needsAttention) return 1;
  if (elevateLeadIds) {
    const aElevated = elevateLeadIds.has(a.id);
    const bElevated = elevateLeadIds.has(b.id);
    if (aElevated && !bElevated) return -1;
    if (!aElevated && bElevated) return 1;
  }
  return compareFn(a, b);
}

export function sortLeadsWithAttentionPriority(
  leads: Lead[],
  compareFn: LeadColumnCompareFn,
  elevateLeadIds?: ReadonlySet<number>,
): Lead[] {
  return [...leads].sort((a, b) =>
    compareLeadsWithAttentionPriority(a, b, compareFn, elevateLeadIds),
  );
}

/** Ordenação padrão do pipeline: última interação (mais recente primeiro). */
export function compareLeadsByLastInteraction(
  a: Lead,
  b: Lead,
  lastInteractionMap: Record<number, number>,
): number {
  const timeA = lastInteractionMap[a.id] ?? new Date(a.dateArrived).getTime();
  const timeB = lastInteractionMap[b.id] ?? new Date(b.dateArrived).getTime();
  return timeB - timeA;
}
