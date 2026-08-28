import type { LeadAIRender } from '@/hooks/useLeadAIRenders';

/** Versões ligadas por parent_render_id (ancestrais + descendentes do ponto atual). */
export function getRelatedVersionChain(
  historico: LeadAIRender[],
  anchorId: string,
): LeadAIRender[] {
  const anchor = historico.find((r) => r.id === anchorId);
  if (!anchor) return [];

  const relatedIds = new Set<string>();

  function collectAncestors(id: string) {
    relatedIds.add(id);
    const row = historico.find((r) => r.id === id);
    if (row?.parentRenderId) collectAncestors(row.parentRenderId);
  }

  function collectDescendants(id: string) {
    relatedIds.add(id);
    historico
      .filter((r) => r.parentRenderId === id)
      .forEach((child) => collectDescendants(child.id));
  }

  collectAncestors(anchorId);
  collectDescendants(anchorId);

  return historico
    .filter((r) => relatedIds.has(r.id))
    .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
}

export function getVersionIndexInChain(chain: LeadAIRender[], renderId: string): number {
  return chain.findIndex((r) => r.id === renderId);
}

export function getPreviousVersionInChain(
  chain: LeadAIRender[],
  renderId: string,
): LeadAIRender | null {
  const index = getVersionIndexInChain(chain, renderId);
  if (index <= 0) return null;
  return chain[index - 1] ?? null;
}

export function getNextVersionInChain(
  chain: LeadAIRender[],
  renderId: string,
): LeadAIRender | null {
  const index = getVersionIndexInChain(chain, renderId);
  if (index < 0 || index >= chain.length - 1) return null;
  return chain[index + 1] ?? null;
}
