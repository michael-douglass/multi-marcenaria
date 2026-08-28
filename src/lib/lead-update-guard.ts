/** Evita que eventos Realtime da própria gravação sobrescrevam o cache com dados atrasados. */
const recentlyUpdatedBySelf = new Map<number, number>();
const SELF_ECHO_MS = 4000;

export function markLeadUpdatedBySelf(leadId: number) {
  recentlyUpdatedBySelf.set(leadId, Date.now());
}

export function shouldIgnoreRealtimeLeadUpdate(leadId: number): boolean {
  const at = recentlyUpdatedBySelf.get(leadId);
  if (!at) return false;
  if (Date.now() - at > SELF_ECHO_MS) {
    recentlyUpdatedBySelf.delete(leadId);
    return false;
  }
  return true;
}
