import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function hasCrmColaboradorAccess(crm) {
  if (!crm || crm.statusConvite !== 'ATIVO' || crm.tipoUsuario !== 'colaborador') return false
  return (crm.roles ?? []).some(r => r !== 'nenhum')
}

function colaboradorCrmRoles(crm) {
  if (!hasCrmColaboradorAccess(crm)) return []
  return crm.roles.filter(r => r !== 'nenhum')
}

function isMarketingOnlyCrm(crm) {
  const roles = colaboradorCrmRoles(crm)
  return roles.includes('marketing') && !roles.includes('admin') && !roles.includes('vendedor')
}

function isCrmAdmin(crm) {
  return Boolean(crm && crm.statusConvite === 'ATIVO' && (crm.roles ?? []).includes('admin'))
}

function isPrestadorServico(crm) {
  return crm?.tipoUsuario === 'prestador_servico' && crm?.statusConvite === 'ATIVO'
}

function isPortalOnly(movelaria, crm) {
  return isPrestadorServico(crm) && movelaria?.ativo !== true
}

const CRM_APP_PATHS = [
  '/pipeline',
  '/leads',
  '/agenda-comercial',
  '/contratos',
  '/automacoes',
  '/markup',
  '/orcamento-slides',
  '/marketing-conteudo',
  '/marketing/apresentacao-interna',
  '/marketing/pontua-garbo',
  '/controle-gastos',
  '/financeiro-pontua',
  '/portal-parceiro',
  '/projetos',
]

function isCrmAppPath(pathname) {
  return CRM_APP_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

function canAccessCrmPath(pathname, crm, movelaria) {
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

  if (pathname.startsWith('/pipeline') || pathname.startsWith('/leads')) return (vendedor || projetista) && !marketingOnly
  if (pathname.startsWith('/projetos')) return (vendedor || projetista) && !marketingOnly
  if (pathname.startsWith('/agenda-comercial')) return vendedor && !marketingOnly
  if (pathname.startsWith('/contratos')) return vendedor && !marketingOnly
  if (pathname.startsWith('/automacoes')) return (vendedor || marketing) && !(marketingOnly && pathname === '/automacoes')
  if (pathname.startsWith('/markup')) return (admin || projetista) && !marketingOnly
  if (pathname.startsWith('/orcamento-slides')) return vendedor && !marketingOnly
  if (pathname.startsWith('/marketing-conteudo')) return marketing
  if (pathname.startsWith('/marketing/apresentacao-interna')) return admin || vendedor || marketing
  if (pathname.startsWith('/marketing/pontua-garbo')) return admin || vendedor || marketing
  if (pathname.startsWith('/controle-gastos')) return admin
  if (pathname.startsWith('/financeiro-pontua')) return vendedor && !marketingOnly
  return false
}

function isNavEntryVisible(entry, ctx) {
  if (entry.parceiroOnly) return Boolean(ctx.showParceiros)
  if (entry.hideIfMarketingOnly && ctx.marketingOnly) return false
  if (entry.crmAdminOnly) return Boolean(ctx.crmAdmin)
  const factoryOk = Boolean(entry.roles?.some(r => ctx.roles.includes(r)))
  const crmOk = Boolean(entry.crmRoles?.some(r => (ctx.crmRoles ?? []).includes(r)))
  if (entry.roles?.length && entry.crmRoles?.length) return factoryOk || crmOk
  if (entry.crmRoles?.length && !entry.roles?.length) return crmOk
  if (entry.roles?.length) return factoryOk
  return factoryOk || crmOk
}

function navVisibilityFromProfiles(roles, crm, movelaria) {
  return {
    roles,
    crmRoles: colaboradorCrmRoles(crm),
    marketingOnly: isMarketingOnlyCrm(crm),
    crmAdmin: isCrmAdmin(crm),
    showParceiros: isPrestadorServico(crm) && movelaria?.ativo === true,
  }
}

const CRM = {
  id: 'crm',
  roles: [],
  crmRoles: ['admin', 'vendedor', 'marketing', 'projetista', 'projetista_admin'],
}
const COMERCIAL = {
  id: 'comercial',
  roles: [],
  crmRoles: ['admin', 'vendedor', 'projetista', 'projetista_admin'],
  hideIfMarketingOnly: true,
}
const MARKETING = {
  id: 'marketingCrm',
  roles: [],
  crmRoles: ['admin', 'vendedor', 'marketing'],
}
const PARCEIROS = { id: 'parceiros', roles: [], parceiroOnly: true }
const DASHBOARD = { id: 'dashboard', roles: ['Administrador', 'Financeiro', 'Marceneiro'] }
const OBRAS = { id: 'obras', roles: ['Administrador', 'AdministradorObras', 'Montador', 'MontadorAdmin', 'Financeiro'] }
const MARKUP = { id: 'markupCrm', crmRoles: ['admin', 'projetista', 'projetista_admin'], hideIfMarketingOnly: true }

const fabio = navVisibilityFromProfiles(
  ['Administrador'],
  { tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['admin'] },
  { ativo: true },
)
const kayke = navVisibilityFromProfiles(['Montador'], null, { ativo: true })
const ana = navVisibilityFromProfiles(
  ['AdministradorObras'],
  { tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['marketing', 'vendedor'] },
  { ativo: true },
)
const gabriel = navVisibilityFromProfiles(
  ['AdministradorObras'],
  { tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['projetista_admin'] },
  { ativo: true },
)
const marketingOnly = navVisibilityFromProfiles(
  [],
  { tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['marketing'] },
  null,
)
const vendedorOnly = navVisibilityFromProfiles(
  [],
  { tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['vendedor'] },
  null,
)
const arquiteto = navVisibilityFromProfiles(
  [],
  { tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO', roles: ['vendedor'] },
  null,
)
const dualParceiro = navVisibilityFromProfiles(
  ['Montador'],
  { tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO', roles: ['vendedor'] },
  { ativo: true },
)

describe('Épico 2 — mapa da casa', () => {
  it('admin da fábrica + admin CRM vê CRM, Comercial, Marketing e Dashboard', () => {
    assert.equal(isNavEntryVisible(CRM, fabio), true)
    assert.equal(isNavEntryVisible(COMERCIAL, fabio), true)
    assert.equal(isNavEntryVisible(MARKETING, fabio), true)
    assert.equal(isNavEntryVisible(DASHBOARD, fabio), true)
    assert.equal(isNavEntryVisible(MARKUP, fabio), true)
    assert.equal(isNavEntryVisible(PARCEIROS, fabio), false)
  })

  it('montador só da fábrica não vê CRM, Comercial nem Marketing', () => {
    assert.equal(isNavEntryVisible(CRM, kayke), false)
    assert.equal(isNavEntryVisible(COMERCIAL, kayke), false)
    assert.equal(isNavEntryVisible(MARKETING, kayke), false)
    assert.equal(isNavEntryVisible(OBRAS, kayke), true)
    assert.equal(isNavEntryVisible(DASHBOARD, kayke), false)
    assert.equal(canAccessCrmPath('/pipeline', null, { ativo: true }), false)
  })

  it('marketing-only vê CRM e Marketing e não entra no Pipeline', () => {
    assert.equal(isNavEntryVisible(CRM, marketingOnly), true)
    assert.equal(isNavEntryVisible(COMERCIAL, marketingOnly), false)
    assert.equal(isNavEntryVisible(MARKETING, marketingOnly), true)
    assert.equal(canAccessCrmPath('/pipeline', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['marketing'],
    }, null), false)
    assert.equal(canAccessCrmPath('/marketing-conteudo', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['marketing'],
    }, null), true)
  })

  it('vendedor CRM entra no Pipeline e não no Markup', () => {
    assert.equal(isNavEntryVisible(COMERCIAL, vendedorOnly), true)
    assert.equal(isNavEntryVisible(MARKUP, vendedorOnly), false)
    assert.equal(canAccessCrmPath('/pipeline', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['vendedor'],
    }, null), true)
    assert.equal(canAccessCrmPath('/markup', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['vendedor'],
    }, null), false)
  })

  it('projetista vê Pipeline, Markup e Projetos, e não vê Contratos', () => {
    assert.equal(isNavEntryVisible(COMERCIAL, gabriel), true)
    assert.equal(isNavEntryVisible(MARKUP, gabriel), true)
    assert.equal(canAccessCrmPath('/pipeline', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['projetista_admin'],
    }, { ativo: true }), true)
    assert.equal(canAccessCrmPath('/markup', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['projetista_admin'],
    }, { ativo: true }), true)
    assert.equal(canAccessCrmPath('/contratos', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['projetista_admin'],
    }, { ativo: true }), false)
    assert.equal(canAccessCrmPath('/projetos', {
      tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['projetista_admin'],
    }, { ativo: true }), true)
  })

  it('vendedor+marketing da fábrica vê Comercial, Marketing e Obras', () => {
    assert.equal(isNavEntryVisible(COMERCIAL, ana), true)
    assert.equal(isNavEntryVisible(MARKETING, ana), true)
    assert.equal(isNavEntryVisible(OBRAS, ana), true)
  })

  it('arquiteto portal-only não entra nas rotas comerciais', () => {
    assert.equal(isPortalOnly(null, { tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO' }), true)
    assert.equal(canAccessCrmPath('/pipeline', {
      tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO', roles: ['vendedor'],
    }, null), false)
    assert.equal(canAccessCrmPath('/portal-parceiro', {
      tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO', roles: ['vendedor'],
    }, null), true)
    assert.equal(isNavEntryVisible(PARCEIROS, arquiteto), false)
  })

  it('parceiro com ficha da fábrica vê o item Parceiros, sem Comercial de colaborador', () => {
    assert.equal(isNavEntryVisible(PARCEIROS, dualParceiro), true)
    assert.equal(isNavEntryVisible(COMERCIAL, dualParceiro), false)
    assert.equal(isNavEntryVisible(OBRAS, dualParceiro), true)
  })

  it('/pipeline não é tratado como Dashboard na guarda de URL', () => {
    assert.equal(isCrmAppPath('/pipeline'), true)
    assert.equal(isCrmAppPath('/pipeline/prospeccao'), true)
    assert.equal(isCrmAppPath('/agenda-obras'), false)
    const app = readSrc('src/App.tsx')
    assert.match(app, /isCrmAppPath\(path\)/)
    assert.match(app, /canAccessCrmPath\(path/)
    assert.match(app, /path="\/pipeline"/)
    assert.match(app, /path="\/agenda-comercial"/)
    assert.match(app, /path="\/projetos"/)
    assert.match(app, /path="\/agenda"/)
    assert.match(app, /path="\/admin\/empresas"/)
  })

  it('sidebar e rotas usam nomes que não colidem com a fábrica', () => {
    const nav = readSrc('src/lib/app-navigation.ts')
    assert.match(nav, /title: 'Agenda comercial'/)
    assert.match(nav, /url: '\/agenda-comercial'/)
    assert.match(nav, /id: 'comercial'/)
    assert.match(nav, /title: 'CRM'/)
    assert.match(nav, /title: 'Marketing'/)
    assert.match(nav, /sector: 'comercial'/)
    assert.match(nav, /sector: 'casa'/)
    assert.match(nav, /title: 'Parceiros'/)
    assert.match(nav, /url: '\/pipeline\/configuracoes'/)
    assert.match(nav, /url: '\/projetos'/)
    assert.match(nav, /title: 'Projetos'/)
    assert.match(nav, /navVisibilityFromProfiles/)
    const sidebar = readSrc('src/components/layout/AppSidebar.tsx')
    assert.match(sidebar, /navVisibilityFromProfiles\(roles, crmProfile, userProfile\)/)
    assert.match(sidebar, /sidebar-sector-head--comercial/)
    assert.match(sidebar, /sidebar-sector-head--casa/)
    assert.match(sidebar, /title="CRM"/)
    assert.match(sidebar, /title="Movelaria"/)
    assert.match(sidebar, /data-open=\{comercialSectorOpen \? 'true' : 'false'\}/)
    assert.match(sidebar, /data-open=\{casaSectorOpen \? 'true' : 'false'\}/)
    const css = readSrc('src/index.css')
    assert.match(css, /sidebar-sector--comercial\[data-open='true'\]/)
    assert.match(css, /sidebar-sector--casa\[data-open='true'\]/)
    assert.match(css, /rgba\(94, 233, 160/)
    assert.match(css, /rgba\(242, 216, 146/)
    assert.doesNotMatch(sidebar, /title="Comercial"/)
    assert.doesNotMatch(sidebar, /title="Casa"/)
    assert.doesNotMatch(nav, /\/admin\/empresas/)
  })
})
