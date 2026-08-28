import { userIsTitularDoLembrete } from '@/lib/lead-lembrete-titulares';

export interface LembreteCountRow {
  lead_id: number;
  status?: string;
  titular_ids?: string[] | null;
  titular_id?: string | null;
}

/** Conta lembretes pendentes por lead, respeitando titularidade. */
export function countPendentesPorLead(
  lembretes: LembreteCountRow[],
  options: { canViewAll: boolean; userId?: string | null },
): Map<number, number> {
  const map = new Map<number, number>();
  for (const l of lembretes) {
    if (!l.lead_id) continue;
    if (l.status && l.status !== 'pendente') continue;
    if (
      !options.canViewAll &&
      !userIsTitularDoLembrete(l.titular_ids, l.titular_id, options.userId)
    ) {
      continue;
    }
    map.set(l.lead_id, (map.get(l.lead_id) || 0) + 1);
  }
  return map;
}

export function filterLembretesByLeadId<T extends { lead_id: number }>(
  lembretes: T[],
  leadId: number,
): T[] {
  return lembretes.filter((l) => l.lead_id === leadId);
}
