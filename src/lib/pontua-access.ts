import { empresaDocumento } from '@/lib/empresa-identidade';
/** Admin altera valores; vendedor só consulta a página Financeiro · Pontua. */

export function canManagePontuaFinanceiro(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
): boolean {
  return isSuperAdmin === true || userRole === 'admin';
}

export function canViewPontuaFinanceiro(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
  userRoles?: readonly string[] | null,
): boolean {
  if (canManagePontuaFinanceiro(userRole, isSuperAdmin)) return true;
  if (userRole === 'vendedor') return true;
  return (userRoles ?? []).includes('vendedor');
}

export function assertCanManagePontuaFinanceiro(
  userRole: string | null | undefined,
  isSuperAdmin?: boolean,
): void {
  if (!canManagePontuaFinanceiro(userRole, isSuperAdmin)) {
    throw new Error(`Apenas administradores podem alterar o ${empresaDocumento().nomePrograma}.`);
  }
}
