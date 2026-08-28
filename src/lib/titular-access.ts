/** Admin e super admin enxergam lembretes/tarefas de todos; demais só os próprios (titular). */
export function canViewAllTitularRecords(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
): boolean {
  return isSuperAdmin === true || userRole === 'admin';
}

/**
 * Quem pode criar uma tarefa já atribuída a outra pessoa.
 * Admin vê a agenda de todos; vendedor atribui, mas continua vendo só as suas e as que criou.
 */
export function canAssignTitularToOthers(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
  userRoles?: readonly string[] | null,
): boolean {
  if (canViewAllTitularRecords(userRole, isSuperAdmin)) return true;
  if (userRole === 'vendedor') return true;
  return (userRoles ?? []).includes('vendedor');
}
