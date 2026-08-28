import type { DatabaseUser } from '@/hooks/useUsers';

/** Garante pelo menos o criador e IDs únicos. */
export function normalizeLembreteTitularIds(
  titularIds: string[] | null | undefined,
  creatorId: string,
): string[] {
  const set = new Set((titularIds ?? []).filter(Boolean));
  if (creatorId) set.add(creatorId);
  return [...set];
}

/** True se o usuário está na lista de titulares (com fallback para titular_id legado). */
export function userIsTitularDoLembrete(
  titularIds: string[] | null | undefined,
  titularId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (titularIds && titularIds.length > 0) return titularIds.includes(userId);
  return titularId === userId;
}

/** Admin/super admin veem todos; demais só se forem titulares. */
export function canUserSeeLembrete(
  titularIds: string[] | null | undefined,
  titularId: string | null | undefined,
  userId: string | null | undefined,
  canViewAll: boolean,
): boolean {
  if (canViewAll) return true;
  return userIsTitularDoLembrete(titularIds, titularId, userId);
}

export function formatLembreteTitularesLabel(
  titularIds: string[] | null | undefined,
  titularFallback: { id: string; nome: string } | null | undefined,
  users: DatabaseUser[] | undefined,
): string {
  const byId = new Map((users ?? []).map((u) => [u.id, u.nome]));
  const ids =
    titularIds && titularIds.length > 0
      ? titularIds
      : titularFallback?.id
        ? [titularFallback.id]
        : [];

  const names = ids
    .map((id) => byId.get(id) ?? (titularFallback?.id === id ? titularFallback.nome : null) ?? 'Usuário')
    .filter(Boolean);

  if (names.length === 0) return 'Sem titular';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(' e ');
  return `${names[0]} +${names.length - 1}`;
}
