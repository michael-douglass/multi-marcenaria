import type { DatabaseUser } from '@/hooks/useUsers';

/** NULL ou array vazio = todos os titulares. */
export function isTodosTitulares(titularIds: string[] | null | undefined): boolean {
  return !titularIds || titularIds.length === 0;
}

/** True se o usuário é titular da reunião (lista explícita ou “todos”). */
export function userIsTitularDaReuniao(
  titularIds: string[] | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (isTodosTitulares(titularIds)) return true;
  return titularIds!.includes(userId);
}

/** Normaliza para persistência: todos → null; senão lista única de IDs. */
export function normalizeTitularIdsForSave(
  titularIds: string[] | null | undefined,
  todosSelecionados: boolean,
): string[] | null {
  if (todosSelecionados || isTodosTitulares(titularIds)) return null;
  return [...new Set(titularIds!.filter(Boolean))];
}

export function formatTitularesLabel(
  titularIds: string[] | null | undefined,
  users: DatabaseUser[] | undefined,
): string {
  if (isTodosTitulares(titularIds)) return 'Todos (vend. e admin)';

  const byId = new Map((users ?? []).map((u) => [u.id, u.nome]));
  const names = titularIds!
    .map((id) => byId.get(id) ?? 'Usuário')
    .filter(Boolean);

  if (names.length === 0) return 'Todos (vend. e admin)';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(' e ');
  return `${names[0]} +${names.length - 1}`;
}
