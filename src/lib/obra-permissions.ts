import type { UserRole } from '@/types'

const OBRAS_MENU_ROLES: UserRole[] = ['Administrador', 'AdministradorObras', 'MontadorAdmin', 'Montador']
const OBRAS_ADMIN_SECTION_ROLES: UserRole[] = ['Administrador', 'AdministradorObras', 'MontadorAdmin']

export function hasObrasMenuAccess(role: UserRole | null): boolean {
  return role !== null && OBRAS_MENU_ROLES.includes(role)
}

export function hasObrasAdminSectionsAccess(role: UserRole | null): boolean {
  return role !== null && OBRAS_ADMIN_SECTION_ROLES.includes(role)
}

/** Pode ver e gerenciar todas as obras (não limitado ao próprio montador). */
export function canManageAllObras(role: UserRole | null): boolean {
  return role === 'Administrador' || role === 'AdministradorObras'
}

export function canEditObras(role: UserRole | null): boolean {
  return canManageAllObras(role) || role === 'MontadorAdmin'
}

export function canDeleteObras(role: UserRole | null): boolean {
  return canManageAllObras(role)
}

export function canConfigObrasTiposGrupos(role: UserRole | null): boolean {
  return canManageAllObras(role)
}
