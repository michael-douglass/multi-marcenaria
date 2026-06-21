import type { UserRole } from '@/types'

const OBRAS_MENU_ROLES: UserRole[] = ['Administrador', 'AdministradorObras', 'MontadorAdmin', 'Montador']
const OBRAS_ADMIN_SECTION_ROLES: UserRole[] = ['Administrador', 'AdministradorObras', 'MontadorAdmin']

export function hasObrasMenuAccess(roles: UserRole[]): boolean {
  return OBRAS_MENU_ROLES.some(r => roles.includes(r))
}

export function hasObrasAdminSectionsAccess(roles: UserRole[]): boolean {
  return OBRAS_ADMIN_SECTION_ROLES.some(r => roles.includes(r))
}

export function hasChegadaMateriaisAccess(roles: UserRole[]): boolean {
  return hasObrasAdminSectionsAccess(roles)
}

export function canManageAllObras(roles: UserRole[]): boolean {
  return roles.includes('Administrador') || roles.includes('AdministradorObras')
}

export function canEditObras(roles: UserRole[]): boolean {
  return canManageAllObras(roles) || roles.includes('MontadorAdmin')
}

export function canDeleteObras(roles: UserRole[]): boolean {
  return canManageAllObras(roles)
}

export function canConfigObrasTiposGrupos(roles: UserRole[]): boolean {
  return canManageAllObras(roles)
}

export function canEditComissao(roles: UserRole[]): boolean {
  return (
    roles.includes('Administrador')
    || roles.includes('AdministradorObras')
    || roles.includes('Financeiro')
  )
}

export function canAplicarComissao(roles: UserRole[]): boolean {
  return canEditComissao(roles)
}

/** Quem pode ver quem já marcou conclusão individual na obra. */
export function canViewMontadoresConclusaoObra(roles: UserRole[]): boolean {
  return (
    canManageAllObras(roles)
    || roles.includes('MontadorAdmin')
    || roles.includes('Montador')
    || roles.includes('Visualizador')
  )
}
