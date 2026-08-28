/** Admin altera valores; vendedor só consulta a página Financeiro · Pontua Garbo. */

export function canManagePontuaGarboFinanceiro(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
): boolean {
  return isSuperAdmin === true || userRole === 'admin';
}

export function canViewPontuaGarboFinanceiro(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
  userRoles?: readonly string[] | null,
): boolean {
  if (canManagePontuaGarboFinanceiro(userRole, isSuperAdmin)) return true;
  if (userRole === 'vendedor') return true;
  return (userRoles ?? []).includes('vendedor');
}

export function assertCanManagePontuaGarboFinanceiro(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
): void {
  if (!canManagePontuaGarboFinanceiro(userRole, isSuperAdmin)) {
    throw new Error('Apenas administradores podem alterar o Pontua Garbo.');
  }
}
