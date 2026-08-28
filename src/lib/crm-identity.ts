import type { UserProfile, UserRole } from '@/types'
import { defaultPathForRoles } from '@/lib/role-access'
import {
  canAccessControleEventos as canAccessControleEventosRoles,
  canAccessProjetosBoard as canAccessProjetosBoardRoles,
  isProjetistaOnly as isProjetistaOnlyRoles,
  isVendedorRestricted as isVendedorRestrictedRoles,
  type AppUserRole,
} from '@/lib/app-roles'

export type CrmRole =
  | 'admin'
  | 'vendedor'
  | 'marketing'
  | 'projetista'
  | 'projetista_admin'
  | 'nenhum'

export type CrmTipoUsuario = 'colaborador' | 'prestador_servico' | 'lead'

export interface CrmAccessHours {
  inicio: string | null
  fim: string | null
}

export interface CrmProfile {
  id: string
  nome: string
  email: string | null
  tipoUsuario: CrmTipoUsuario
  statusConvite: string
  roles: CrmRole[]
  horarioAcessoInicio: string | null
  horarioAcessoFim: string | null
  titulo: string | null
  comissaoAtiva: boolean
}

export const CRM_ROLES_OPERACIONAIS: Exclude<CrmRole, 'nenhum'>[] = [
  'admin',
  'vendedor',
  'marketing',
  'projetista',
  'projetista_admin',
]

export const CRM_ROLE_LABEL: Record<CrmRole, string> = {
  admin: 'Admin CRM',
  vendedor: 'Vendedor',
  marketing: 'Marketing',
  projetista: 'Projetista',
  projetista_admin: 'Projetista Admin',
  nenhum: 'Nenhum',
}

export const CRM_TIPO_LABEL: Record<CrmTipoUsuario | 'nenhum', string> = {
  colaborador: 'Colaborador (interno)',
  prestador_servico: 'Arquiteto / parceiro',
  lead: 'Lead',
  nenhum: 'Sem acesso CRM',
}

export function parseCrmRoles(raw: unknown): CrmRole[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set<string>(CRM_ROLES_OPERACIONAIS)
  const seen = new Set<CrmRole>()
  const result: CrmRole[] = []
  for (const item of raw) {
    const value = String(item) as CrmRole
    if (!allowed.has(value) || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export function mapCrmProfile(row: Record<string, unknown> | null | undefined): CrmProfile | null {
  if (!row || row.id == null) return null
  const tipo = String(row.tipo_usuario ?? '')
  if (tipo !== 'colaborador' && tipo !== 'prestador_servico' && tipo !== 'lead') return null
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    email: row.email ? String(row.email) : null,
    tipoUsuario: tipo,
    statusConvite: String(row.status_convite ?? ''),
    roles: parseCrmRoles(row.roles),
    horarioAcessoInicio: row.horario_acesso_inicio ? String(row.horario_acesso_inicio).slice(0, 5) : null,
    horarioAcessoFim: row.horario_acesso_fim ? String(row.horario_acesso_fim).slice(0, 5) : null,
    titulo: row.titulo ? String(row.titulo) : null,
    comissaoAtiva: row.comissao_ativa === true,
  }
}

export function isCrmAtivo(crm: CrmProfile | null | undefined): boolean {
  return crm?.statusConvite === 'ATIVO'
}

export function isPrestadorServico(crm: CrmProfile | null | undefined): boolean {
  return crm?.tipoUsuario === 'prestador_servico' && isCrmAtivo(crm)
}

/** Arquiteto/parceiro sem ficha Movelaria ativa — só o portal. */
export function isPortalOnly(
  movelaria: UserProfile | null | undefined,
  crm: CrmProfile | null | undefined,
): boolean {
  const temFabrica = movelaria?.ativo === true
  return isPrestadorServico(crm) && !temFabrica
}

export function hasCrmRole(crm: CrmProfile | null | undefined, role: CrmRole): boolean {
  return Boolean(crm && isCrmAtivo(crm) && crm.roles.includes(role))
}

export function hasCrmColaboradorAccess(crm: CrmProfile | null | undefined): boolean {
  if (!crm || !isCrmAtivo(crm) || crm.tipoUsuario !== 'colaborador') return false
  return crm.roles.some(r => r !== 'nenhum')
}

export function crmAccessHours(crm: CrmProfile | null | undefined): CrmAccessHours | null {
  if (!crm) return null
  const inicio = crm.horarioAcessoInicio
  const fim = crm.horarioAcessoFim
  if (!inicio && !fim) return null
  return { inicio, fim }
}

function currentTimeHHmm(now = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function isWithinAccessHours(
  hours: CrmAccessHours | null | undefined,
  now = new Date(),
): boolean {
  if (!hours?.inicio && !hours?.fim) return true
  const current = currentTimeHHmm(now)
  if (hours.inicio && !hours.fim) return current >= hours.inicio
  if (!hours.inicio && hours.fim) return current <= hours.fim
  return current >= hours.inicio! && current <= hours.fim!
}

/** Admin da fábrica não fica preso ao horário do CRM. */
export function shouldEnforceAccessHours(
  movelaria: UserProfile | null | undefined,
  crm: CrmProfile | null | undefined,
): boolean {
  if (movelaria?.perfil === 'administrador') return false
  return Boolean(crmAccessHours(crm))
}

export type IdentityGate =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'pending' | 'hours' }

export function evaluateIdentityGate(
  movelaria: UserProfile | null,
  crm: CrmProfile | null,
  now = new Date(),
): IdentityGate {
  const movelariaOk = movelaria?.ativo === true
  const crmOk = isCrmAtivo(crm)

  if (!movelaria && !crm) return { ok: false, reason: 'missing' }
  if (!movelariaOk && !crmOk) {
    if (movelaria && movelaria.ativo === false) return { ok: false, reason: 'pending' }
    return { ok: false, reason: 'missing' }
  }

  if (!movelariaOk && crmOk && crm?.tipoUsuario === 'lead') {
    return { ok: false, reason: 'pending' }
  }

  if (shouldEnforceAccessHours(movelariaOk ? movelaria : null, crmOk ? crm : null)) {
    if (!isWithinAccessHours(crmAccessHours(crm), now)) return { ok: false, reason: 'hours' }
  }

  return { ok: true }
}

export function defaultPathForIdentity(
  roles: UserRole[],
  movelaria: UserProfile | null | undefined,
  crm: CrmProfile | null | undefined,
): string {
  if (isPortalOnly(movelaria, crm)) return '/portal-parceiro'
  if (roles.length === 0 && hasCrmColaboradorAccess(crm)) {
    if (isMarketingOnlyCrm(crm)) return '/marketing-conteudo'
    if (isProjetistaOnlyCrm(crm)) return '/projetos'
    return '/pipeline'
  }
  return defaultPathForRoles(roles)
}

export function colaboradorCrmRoles(crm: CrmProfile | null | undefined): CrmRole[] {
  if (!hasCrmColaboradorAccess(crm)) return []
  return crm!.roles.filter(r => r !== 'nenhum')
}

export function isMarketingOnlyCrm(crm: CrmProfile | null | undefined): boolean {
  const roles = colaboradorCrmRoles(crm)
  return (
    roles.includes('marketing') &&
    !roles.includes('admin') &&
    !roles.includes('vendedor') &&
    !roles.includes('projetista') &&
    !roles.includes('projetista_admin')
  )
}

function crmRolesAsApp(crm: CrmProfile | null | undefined): AppUserRole[] {
  return colaboradorCrmRoles(crm) as AppUserRole[]
}

/** Colaborador só da prancheta: home em /projetos, sem Pipeline como porta de entrada. */
export function isProjetistaOnlyCrm(crm: CrmProfile | null | undefined): boolean {
  return isProjetistaOnlyRoles(crmRolesAsApp(crm))
}

export function canAccessProjetosBoard(crm: CrmProfile | null | undefined): boolean {
  return canAccessProjetosBoardRoles(crmRolesAsApp(crm))
}

export function canAccessControleEventos(crm: CrmProfile | null | undefined): boolean {
  return canAccessControleEventosRoles(crmRolesAsApp(crm))
}

export function isVendedorRestrictedCrm(crm: CrmProfile | null | undefined): boolean {
  return isVendedorRestrictedRoles(crmRolesAsApp(crm))
}

export function isCrmAdmin(crm: CrmProfile | null | undefined): boolean {
  return hasCrmRole(crm, 'admin')
}

export const CRM_APP_PATHS = [
  '/pipeline',
  '/leads',
  '/agenda-comercial',
  '/contratos',
  '/automacoes',
  '/markup',
  '/orcamento-slides',
  '/marketing-conteudo',
  '/biblioteca-crm',
  '/marketing/apresentacao-interna',
  '/marketing/pontua-garbo',
  '/controle-gastos',
  '/controle-eventos',
  '/financeiro-pontua',
  '/admin/marca',
  '/admin',
  '/admin/webhooks',
  '/profile',
  '/portal-parceiro',
  '/eventos-crm',
  '/chat-crm',
  '/projetos',
] as const

export function isCrmAppPath(pathname: string): boolean {
  return CRM_APP_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

export function canAccessCrmPath(
  pathname: string,
  crm: CrmProfile | null | undefined,
  movelaria: UserProfile | null | undefined,
): boolean {
  if (pathname === '/portal-parceiro' || pathname.startsWith('/portal-parceiro/')) {
    return isPrestadorServico(crm)
  }

  if (isPortalOnly(movelaria, crm)) return false

  const roles = colaboradorCrmRoles(crm)
  if (roles.length === 0) return false

  const admin = roles.includes('admin')
  const vendedor = roles.includes('vendedor') || admin
  const marketing = roles.includes('marketing') || admin
  const marketingOnly = isMarketingOnlyCrm(crm)
  const projetista = roles.includes('projetista') || roles.includes('projetista_admin') || admin

  if (pathname.startsWith('/pipeline')) {
    return (vendedor || projetista) && !marketingOnly && !isProjetistaOnlyCrm(crm)
  }
  if (pathname.startsWith('/leads')) return (vendedor || projetista) && !marketingOnly
  if (pathname.startsWith('/projetos')) return canAccessProjetosBoard(crm)
  if (pathname.startsWith('/agenda-comercial')) return vendedor && !marketingOnly
  if (pathname.startsWith('/contratos')) return vendedor && !marketingOnly
  if (pathname.startsWith('/automacoes')) return (vendedor || marketing) && !(marketingOnly && pathname === '/automacoes')
  if (pathname.startsWith('/markup')) return (admin || projetista) && !marketingOnly
  if (pathname.startsWith('/orcamento-slides')) return vendedor && !marketingOnly
  if (pathname.startsWith('/marketing-conteudo')) return marketing
  if (pathname.startsWith('/biblioteca-crm')) return marketing
  if (pathname.startsWith('/marketing/apresentacao-interna')) return admin || vendedor || marketing
  if (pathname.startsWith('/marketing/pontua-garbo')) return admin || vendedor || marketing
  if (pathname.startsWith('/controle-gastos')) return admin
  if (pathname.startsWith('/controle-eventos') || pathname.startsWith('/eventos-crm')) {
    return canAccessControleEventos(crm)
  }
  if (pathname.startsWith('/financeiro-pontua')) return vendedor && !marketingOnly
  if (pathname.startsWith('/admin')) return admin
  if (pathname.startsWith('/profile')) return true
  if (pathname.startsWith('/chat-crm')) return vendedor && !marketingOnly
  return false
}

