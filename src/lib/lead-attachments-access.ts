import type { AppUserRole } from '@/lib/app-roles';
import { isProjetistaRole } from '@/lib/app-roles';

/** Quem cria pasta, envia arquivo e renomeia gaveta. Prestador não gerencia. */
export function canManageLeadAttachments(input: {
  readOnly?: boolean;
  isSuperAdmin?: boolean;
  userRole?: string | null;
  userRoles?: readonly AppUserRole[] | null;
  hasLeadsEdit?: boolean;
}): boolean {
  if (input.readOnly) return false;
  if (input.isSuperAdmin) return true;
  const role = input.userRole;
  if (role === 'admin' || role === 'vendedor' || role === 'projetista' || role === 'projetista_admin') {
    return true;
  }
  if (isProjetistaRole(input.userRoles)) return true;
  return input.hasLeadsEdit === true;
}

/** Vendedor envia; só admin/projetista apaga arquivo. */
export function canDeleteLeadAttachments(input: {
  readOnly?: boolean;
  isSuperAdmin?: boolean;
  userRole?: string | null;
  userRoles?: readonly AppUserRole[] | null;
}): boolean {
  if (input.readOnly) return false;
  if (input.isSuperAdmin) return true;
  const role = input.userRole;
  if (role === 'admin' || role === 'projetista' || role === 'projetista_admin') return true;
  return isProjetistaRole(input.userRoles);
}
