import type { Lead } from '@/types/selletos';

export type LeadColumnCompareFn = (a: Lead, b: Lead) => number;

/**
 * Leads com "Dar atenção" sempre no topo da coluna; depois aplica o comparador informado.
 */
export function compareLeadsWithAttentionPriority(
  a: Lead,
  b: Lead,
  compareFn: LeadColumnCompareFn,
): number {
  if (a.needsAttention && !b.needsAttention) return -1;
  if (!a.needsAttention && b.needsAttention) return 1;
  return compareFn(a, b);
}

export function sortLeadsWithAttentionPriority(
  leads: Lead[],
  compareFn: LeadColumnCompareFn,
): Lead[] {
  return [...leads].sort((a, b) => compareLeadsWithAttentionPriority(a, b, compareFn));
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
