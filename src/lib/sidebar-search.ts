import { compactarBusca } from '@/lib/markup-busca'
import { HardHat, Landmark, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NavChildItem, NavMainItem, NavSector } from '@/lib/app-navigation'

export interface SidebarSearchHit {
  id: string
  title: string
  url: string
  icon: LucideIcon
  sector: NavSector
  sectorLabel: string
  trail: string
  /** Texto extra só para matching (aliases), não aparece no menu. */
  searchText?: string
}

export interface SidebarLeadIndexRow {
  id: number
  nome: string
  telefone: string | null
}

export interface SidebarObraIndexRow {
  id: string
  cliente_nome: string
  origem_lead_id?: string | null
  status_kanban?: string | null
}

export interface SidebarCobrancaIndexRow {
  id: string
  cliente_nome: string
  cliente_telefone?: string | null
  origem_lead_id?: string | null
}

export interface SidebarClienteIndexRow {
  id: string
  nome: string
  telefone?: string | null
}

export const SIDEBAR_LEAD_HIT_LIMIT = 20

const OBRA_STATUS_TRAIL: Record<string, string> = {
  datas_em_aberto: 'Datas em Aberto',
  datas_em_atraso: 'Datas em Atraso',
  datas_definidas: 'Datas Definidas',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

/** Igual à busca do menu: sem acento, espaço, hífen nem maiúscula. */
export function compactarBuscaPagina(texto: string): string {
  return compactarBusca(texto).replace(/[-_/]+/g, '')
}

/** Também tira pontuação de telefone: (), +, ponto, etc. */
export function compactarBuscaLead(texto: string): string {
  return compactarBuscaPagina(texto).replace(/[^a-z0-9]/g, '')
}

export function paginaCorrespondeBusca(texto: string, termo: string): boolean {
  const termoLimpo = termo.trim()
  if (!termoLimpo) return true

  const alvo = compactarBuscaPagina(texto)
  const blob = compactarBuscaPagina(termoLimpo)
  if (blob && alvo.includes(blob)) return true

  const palavras = termoLimpo
    .split(/\s+/)
    .map(palavra => compactarBuscaPagina(palavra))
    .filter(Boolean)

  return palavras.length > 1 && palavras.every(palavra => alvo.includes(palavra))
}

export function leadCorrespondeBusca(
  nome: string | null | undefined,
  telefone: string | null | undefined,
  termo: string,
): boolean {
  const termoLimpo = termo.trim()
  if (!termoLimpo) return true

  const alvo = compactarBuscaLead(`${nome ?? ''} ${telefone ?? ''}`)
  const blob = compactarBuscaLead(termoLimpo)
  if (blob && alvo.includes(blob)) return true

  const palavras = termoLimpo
    .split(/\s+/)
    .map(palavra => compactarBuscaLead(palavra))
    .filter(Boolean)

  return palavras.length > 1 && palavras.every(palavra => alvo.includes(palavra))
}

function sectorLabel(sector: NavSector): string {
  return sector === 'comercial' ? 'CRM' : 'Movelaria'
}

function walkLeaves(
  node: NavMainItem | NavChildItem,
  sector: NavSector,
  ancestors: string[],
  hits: SidebarSearchHit[],
  seen: Set<string>,
) {
  if (node.children?.length) {
    const next = [...ancestors, node.title]
    for (const child of node.children) walkLeaves(child, sector, next, hits, seen)
    return
  }
  if (!node.url) return
  if (seen.has(node.url)) return
  seen.add(node.url)
  const aliases =
    'searchAliases' in node && Array.isArray(node.searchAliases)
      ? node.searchAliases.join(' ')
      : ''
  hits.push({
    id: String(node.id),
    title: node.title,
    url: node.url,
    icon: node.icon,
    sector,
    sectorLabel: sectorLabel(sector),
    trail: ancestors.filter(Boolean).join(' · '),
    searchText: aliases || undefined,
  })
}

/** Todas as páginas clicáveis do menu visível, incluindo quadros extras do Pipeline. */
export function flattenSidebarPages(items: NavMainItem[]): SidebarSearchHit[] {
  const hits: SidebarSearchHit[] = []
  const seen = new Set<string>()
  for (const item of items) {
    walkLeaves(item, item.sector, [], hits, seen)
  }
  return hits
}

export function matchSidebarPages(hits: SidebarSearchHit[], query: string): SidebarSearchHit[] {
  const termo = query.trim()
  if (!termo) return []
  return hits.filter(hit =>
    paginaCorrespondeBusca(
      [hit.title, hit.trail, hit.sectorLabel, hit.url, hit.searchText ?? ''].join(' '),
      termo,
    ),
  )
}

export function matchSidebarLeads(
  leads: SidebarLeadIndexRow[],
  query: string,
): SidebarSearchHit[] {
  const termo = query.trim()
  if (!termo) return []
  const hits: SidebarSearchHit[] = []
  for (const lead of leads) {
    if (!leadCorrespondeBusca(lead.nome, lead.telefone, termo)) continue
    hits.push({
      id: `lead-${lead.id}`,
      title: lead.nome.trim() || 'Lead sem nome',
      url: `/pipeline?id=${lead.id}`,
      icon: UserRound,
      sector: 'comercial',
      sectorLabel: 'Leads',
      trail: lead.telefone?.trim() || 'Sem telefone',
    })
    if (hits.length >= SIDEBAR_LEAD_HIT_LIMIT) break
  }
  return hits
}

function leadIdsQueBatam(leads: SidebarLeadIndexRow[], termo: string): Set<string> {
  const ids = new Set<string>()
  for (const lead of leads) {
    if (!leadCorrespondeBusca(lead.nome, lead.telefone, termo)) continue
    ids.add(String(lead.id))
  }
  return ids
}

function origemLeadBate(origemLeadId: string | null | undefined, leadIds: Set<string>): boolean {
  const id = origemLeadId?.trim()
  return Boolean(id && leadIds.has(id))
}

/** Obra da agenda: nome do cliente ou lead vinculado. */
export function matchSidebarObras(
  obras: SidebarObraIndexRow[],
  query: string,
  leads: SidebarLeadIndexRow[] = [],
): SidebarSearchHit[] {
  const termo = query.trim()
  if (!termo) return []
  const leadIds = leadIdsQueBatam(leads, termo)
  const hits: SidebarSearchHit[] = []
  for (const obra of obras) {
    const peloNome = leadCorrespondeBusca(obra.cliente_nome, null, termo)
    const peloLead = origemLeadBate(obra.origem_lead_id, leadIds)
    if (!peloNome && !peloLead) continue
    const status = obra.status_kanban ? OBRA_STATUS_TRAIL[obra.status_kanban] : ''
    hits.push({
      id: `obra-${obra.id}`,
      title: obra.cliente_nome.trim() || 'Obra sem nome',
      url: `/agenda-obras?obra=${encodeURIComponent(obra.id)}`,
      icon: HardHat,
      sector: 'casa',
      sectorLabel: 'Agenda de Obras',
      trail: status ? `Agenda de Obras · ${status}` : 'Agenda de Obras',
    })
    if (hits.length >= SIDEBAR_LEAD_HIT_LIMIT) break
  }
  return hits
}

/** Cobranças: uma linha por cliente, mesmo se houver várias parcelas. */
export function matchSidebarCobrancas(
  cobrancas: SidebarCobrancaIndexRow[],
  query: string,
  leads: SidebarLeadIndexRow[] = [],
): SidebarSearchHit[] {
  const termo = query.trim()
  if (!termo) return []
  const leadIds = leadIdsQueBatam(leads, termo)
  const hits: SidebarSearchHit[] = []
  const seen = new Set<string>()
  for (const conta of cobrancas) {
    const peloNome = leadCorrespondeBusca(conta.cliente_nome, conta.cliente_telefone, termo)
    const peloLead = origemLeadBate(conta.origem_lead_id, leadIds)
    if (!peloNome && !peloLead) continue
    const chave = conta.origem_lead_id?.trim() || compactarBuscaLead(conta.cliente_nome)
    if (!chave || seen.has(chave)) continue
    seen.add(chave)
    const nome = conta.cliente_nome.trim() || 'Cliente sem nome'
    hits.push({
      id: `cobranca-${chave}`,
      title: nome,
      url: `/cobrancas?q=${encodeURIComponent(nome)}`,
      icon: Landmark,
      sector: 'casa',
      sectorLabel: 'Financeiro',
      trail: conta.cliente_telefone?.trim() || 'Cobranças',
    })
    if (hits.length >= SIDEBAR_LEAD_HIT_LIMIT) break
  }
  return hits
}

export function matchSidebarClientes(
  clientes: SidebarClienteIndexRow[],
  query: string,
): SidebarSearchHit[] {
  const termo = query.trim()
  if (!termo) return []
  const hits: SidebarSearchHit[] = []
  for (const cliente of clientes) {
    if (!leadCorrespondeBusca(cliente.nome, cliente.telefone, termo)) continue
    const nome = cliente.nome.trim() || 'Cliente sem nome'
    hits.push({
      id: `cliente-${cliente.id}`,
      title: nome,
      url: `/clientes?q=${encodeURIComponent(nome)}`,
      icon: Users,
      sector: 'casa',
      sectorLabel: 'Financeiro',
      trail: cliente.telefone?.trim() || 'Cadastro de clientes',
    })
    if (hits.length >= SIDEBAR_LEAD_HIT_LIMIT) break
  }
  return hits
}
