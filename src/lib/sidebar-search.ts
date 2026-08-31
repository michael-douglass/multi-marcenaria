import { compactarBusca } from '@/lib/markup-busca'
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
}

/** Igual à busca do menu: sem acento, espaço, hífen nem maiúscula. */
export function compactarBuscaPagina(texto: string): string {
  return compactarBusca(texto).replace(/[-_/]+/g, '')
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
  hits.push({
    id: String(node.id),
    title: node.title,
    url: node.url,
    icon: node.icon,
    sector,
    sectorLabel: sectorLabel(sector),
    trail: ancestors.filter(Boolean).join(' · '),
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
    paginaCorrespondeBusca([hit.title, hit.trail, hit.sectorLabel, hit.url].join(' '), termo),
  )
}
