import type { AppUserRole } from '@/lib/resolve-auth-role'
export type { AppUserRole } from '@/lib/resolve-auth-role'

/** Ordem de prioridade do papel “principal” (compat com código legado). */
export const APP_ROLE_PRIORITY: readonly AppUserRole[] = [
  'admin',
  'projetista_admin',
  'vendedor',
  'projetista',
  'marketing',
  'nenhum',
] as const;

export const OPERATIONAL_ROLES: readonly Exclude<AppUserRole, 'nenhum'>[] = [
  'admin',
  'projetista_admin',
  'vendedor',
  'projetista',
  'marketing',
] as const;

export function pickPrimaryRole(roles: readonly AppUserRole[] | null | undefined): AppUserRole {
  if (!roles?.length) return 'nenhum';
  for (const role of APP_ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return 'nenhum';
}

/** Remove duplicatas e trata “nenhum” como exclusivo. */
export function normalizeRoles(roles: readonly AppUserRole[] | null | undefined): AppUserRole[] {
  const unique = Array.from(new Set(roles ?? []));
  const operational = unique.filter((role) => role !== 'nenhum');
  if (operational.length > 0) {
    return APP_ROLE_PRIORITY.filter((role) => operational.includes(role));
  }
  return ['nenhum'];
}

export function hasAppRole(
  roles: readonly AppUserRole[] | null | undefined,
  role: AppUserRole,
): boolean {
  return (roles ?? []).includes(role);
}

/** Marketing sem admin/vendedor → perfil restrito só a conteúdo. */
export function isMarketingOnly(
  roles: readonly AppUserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return false;
  const list = roles ?? [];
  return (
    list.includes('marketing') &&
    !list.includes('admin') &&
    !list.includes('vendedor') &&
    !list.includes('projetista') &&
    !list.includes('projetista_admin')
  );
}

/** Vendedor sem admin/marketing → restrições de menu do vendedor puro. */
export function isVendedorRestricted(
  roles: readonly AppUserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return false;
  const list = roles ?? [];
  return list.includes('vendedor') && !list.includes('admin') && !list.includes('marketing');
}

export function isProjetistaRole(roles: readonly AppUserRole[] | null | undefined): boolean {
  const list = roles ?? [];
  return list.includes('projetista') || list.includes('projetista_admin');
}

export function isProjetistaAdminRole(
  roles: readonly AppUserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true;
  const list = roles ?? [];
  return list.includes('projetista_admin') || list.includes('admin');
}

/** Só da prancheta: sem admin, vendedor ou marketing. Home em /projetos. */
export function isProjetistaOnly(
  roles: readonly AppUserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return false;
  const list = roles ?? [];
  return (
    isProjetistaRole(list) &&
    !list.includes('admin') &&
    !list.includes('vendedor') &&
    !list.includes('marketing')
  );
}

export function canAccessProjetosBoard(
  roles: readonly AppUserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true;
  const list = roles ?? [];
  if (isMarketingOnly(list)) return false;
  return (
    list.includes('admin') ||
    list.includes('vendedor') ||
    isProjetistaRole(list)
  );
}

/** Admin ou marketing — inclusive marketing-only. Vendedor puro e projetista-only não. */
export function canAccessMarketingConteudo(
  roles: readonly AppUserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true
  const list = roles ?? []
  return list.includes('admin') || list.includes('marketing')
}

export function canAccessControleEventos(
  roles: readonly AppUserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  return canAccessMarketingConteudo(roles, isSuperAdmin)
}

/** Projetista puro (sem vendedor/admin): tinta ciano no chat. Dual = ouro. */
export function isAutorDoAtelie(roles: readonly AppUserRole[] | null | undefined): boolean {
  const list = roles ?? [];
  return isProjetistaRole(list) && !list.includes('vendedor') && !list.includes('admin');
}

export function rolesEqual(
  a: readonly AppUserRole[] | null | undefined,
  b: readonly AppUserRole[] | null | undefined,
): boolean {
  const left = normalizeRoles(a);
  const right = normalizeRoles(b);
  if (left.length !== right.length) return false;
  return left.every((role, index) => role === right[index]);
}

export function roleLabel(role: AppUserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'projetista_admin':
      return 'Projetista Admin';
    case 'vendedor':
      return 'Vendedor';
    case 'projetista':
      return 'Projetista';
    case 'marketing':
      return 'Marketing';
    default:
      return 'Nenhum';
  }
}

/** Ex.: “VENDEDOR + MARKETING” no menu e no perfil. */
export function formatRolesLabel(roles: readonly AppUserRole[] | null | undefined): string {
  const operational = normalizeRoles(roles).filter((role) => role !== 'nenhum');
  if (operational.length === 0) return 'NENHUM';
  return operational.map((role) => roleLabel(role).toUpperCase()).join(' + ');
}
