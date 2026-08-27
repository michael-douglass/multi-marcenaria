import type { ObraFull, UserRole } from '@/types'
import {
  algumMontadorPendenteInicio,
  getObraMontadorIds,
  montadorConcluiuObra,
  montadorIniciouObra,
} from './obra-montadores'

const OBRAS_MENU_ROLES: UserRole[] = ['Administrador', 'AdministradorObras', 'MontadorAdmin', 'Montador', 'Financeiro']
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

/** Página Pedidos: somente Financeiro e Administrador de Obras. */
export function hasPedidosObrasAccess(roles: UserRole[]): boolean {
  return roles.includes('Financeiro') || roles.includes('AdministradorObras')
}

/** Aprovar compra e gerar parcelas em Contas a Pagar. */
export function canAprovarPedidoCompra(roles: UserRole[]): boolean {
  return roles.includes('Administrador')
}

export function canManageAllObras(roles: UserRole[]): boolean {
  return roles.includes('Administrador') || roles.includes('AdministradorObras')
}

export function canEditFixoMontador(roles: UserRole[]): boolean {
  return canManageAllObras(roles)
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

export function canViewObraBriefing(roles: UserRole[]): boolean {
  return hasObrasMenuAccess(roles) || roles.includes('Financeiro') || roles.includes('Visualizador')
}

export function canEditObraBriefing(roles: UserRole[]): boolean {
  return canManageAllObras(roles) || roles.includes('MontadorAdmin')
}

export function canConfigBriefingTemplates(roles: UserRole[]): boolean {
  return canEditObraBriefing(roles)
}

export function canDeleteBriefingTemplates(roles: UserRole[]): boolean {
  return canManageAllObras(roles)
}

export function canOpenAgendaConfig(roles: UserRole[]): boolean {
  return canConfigObrasTiposGrupos(roles) || canConfigBriefingTemplates(roles)
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

/** Obra ainda não foi concluída nem cancelada. */
export function obraPendenteConclusao(
  obra: Pick<ObraFull, 'status_kanban' | 'finalizado_em'>,
): boolean {
  return (
    obra.status_kanban !== 'concluida' &&
    obra.status_kanban !== 'cancelada' &&
    !obra.finalizado_em
  )
}

/** Administrador / Administrador Obras: pode encerrar qualquer obra em aberto. */
export function podeAdminForcarConclusaoObra(roles: UserRole[]): boolean {
  return canManageAllObras(roles)
}

/** Montador admin (e admins da empresa): início/conclusão vale para toda a equipe. */
export function podeComandarEquipeObra(roles: UserRole[]): boolean {
  return canManageAllObras(roles) || roles.includes('MontadorAdmin')
}

export interface ObraConclusaoUiOpts {
  obra: ObraFull
  roles: UserRole[]
  canEdit: boolean
  isMontador: boolean
  montadorUserId?: string | null
}

/** Exibe o botão "Iniciar" no card, sem precisar abrir o detalhe. */
export function podeExibirBotaoIniciarObra(opts: ObraConclusaoUiOpts): boolean {
  const { obra, roles, canEdit, isMontador, montadorUserId } = opts
  if (!obraPendenteConclusao(obra)) return false

  if (podeComandarEquipeObra(roles)) {
    return algumMontadorPendenteInicio(obra)
  }

  const euSouMontadorNaObra =
    !!montadorUserId && getObraMontadorIds(obra).includes(montadorUserId)
  const marcacaoIndividual = isMontador || euSouMontadorNaObra

  if (marcacaoIndividual) {
    return !montadorIniciouObra(obra, montadorUserId)
  }

  return canEdit && !obra.iniciado_em
}

/** Exibe o botão "Concluir" conforme perfil e estágio da obra. */
export function podeExibirBotaoConcluirObra(opts: ObraConclusaoUiOpts): boolean {
  const { obra, roles, canEdit, isMontador, montadorUserId } = opts
  if (!obraPendenteConclusao(obra)) return false

  if (podeComandarEquipeObra(roles)) return true

  const euSouMontadorNaObra =
    !!montadorUserId && getObraMontadorIds(obra).includes(montadorUserId)
  const marcacaoIndividual = isMontador || euSouMontadorNaObra

  if (marcacaoIndividual) {
    return (
      montadorIniciouObra(obra, montadorUserId) &&
      !montadorConcluiuObra(obra, montadorUserId)
    )
  }

  if (canEdit && !obra.iniciado_em) return true

  return false
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
