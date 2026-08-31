import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function compactarBusca(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s.]+/g, '')
}

function compactarBuscaPagina(texto) {
  return compactarBusca(texto).replace(/[-_/]+/g, '')
}

function compactarBuscaLead(texto) {
  return compactarBuscaPagina(texto).replace(/[^a-z0-9]/g, '')
}

function leadCorrespondeBusca(nome, telefone, termo) {
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

function matchSidebarLeads(leads, query) {
  const termo = query.trim()
  if (!termo) return []
  return leads
    .filter(lead => leadCorrespondeBusca(lead.nome, lead.telefone, termo))
    .slice(0, 20)
}

function paginaCorrespondeBusca(texto, termo) {
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

function flattenSidebarPages(items) {
  const hits = []
  const seen = new Set()
  const sectorLabel = sector => (sector === 'comercial' ? 'CRM' : 'Movelaria')
  const walk = (node, sector, ancestors) => {
    if (node.children?.length) {
      for (const child of node.children) walk(child, sector, [...ancestors, node.title])
      return
    }
    if (!node.url || seen.has(node.url)) return
    seen.add(node.url)
    hits.push({
      id: String(node.id),
      title: node.title,
      url: node.url,
      sector,
      sectorLabel: sectorLabel(sector),
      trail: ancestors.filter(Boolean).join(' · '),
    })
  }
  for (const item of items) walk(item, item.sector, [])
  return hits
}

function matchSidebarPages(hits, query) {
  const termo = query.trim()
  if (!termo) return []
  return hits.filter(hit =>
    paginaCorrespondeBusca([hit.title, hit.trail, hit.sectorLabel, hit.url].join(' '), termo),
  )
}

const sampleItems = [
  {
    id: 'comercial',
    title: 'CRM',
    url: '/pipeline',
    sector: 'comercial',
    children: [
      {
        id: 'pipelineGrupo',
        title: 'Pipeline',
        children: [
          { id: 'kanban', title: 'Kanban', url: '/pipeline' },
          { id: 'orcInt', title: 'Orçamentos internos', url: '/pipeline/orcamentos-internos' },
        ],
      },
      { id: 'leads', title: 'Leads', url: '/leads' },
      { id: 'agenda', title: 'Agenda comercial', url: '/agenda-comercial' },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    url: '/clientes',
    sector: 'casa',
    children: [
      { id: 'caixa', title: 'Caixa', url: '/caixa' },
      { id: 'contas', title: 'Contas a Pagar', url: '/contas-pagar' },
    ],
  },
]

describe('busca do menu lateral', () => {
  const pages = flattenSidebarPages(sampleItems)

  it('lista todas as páginas folha, sem repetir pasta', () => {
    const urls = pages.map(p => p.url).sort()
    assert.deepEqual(urls, [
      '/agenda-comercial',
      '/caixa',
      '/contas-pagar',
      '/leads',
      '/pipeline',
      '/pipeline/orcamentos-internos',
    ])
    assert.equal(pages.some(p => p.title === 'CRM' && p.url === '/pipeline'), false)
  })

  it('ignora maiúscula, acento e espaço', () => {
    assert.equal(matchSidebarPages(pages, 'ORCAMENTOS').some(p => p.title === 'Orçamentos internos'), true)
    assert.equal(matchSidebarPages(pages, 'agendacomercial').some(p => p.title === 'Agenda comercial'), true)
    assert.equal(matchSidebarPages(pages, 'Agenda Comercial').some(p => p.title === 'Agenda comercial'), true)
    assert.equal(matchSidebarPages(pages, 'LEADS').some(p => p.url === '/leads'), true)
  })

  it('acha página da Movelaria e do CRM no mesmo campo', () => {
    const caixa = matchSidebarPages(pages, 'caixa')
    const leads = matchSidebarPages(pages, 'leads')
    assert.equal(caixa.some(p => p.sector === 'casa'), true)
    assert.equal(leads.some(p => p.sector === 'comercial'), true)
  })

  it('campo vazio não filtra o menu', () => {
    assert.equal(matchSidebarPages(pages, '   ').length, 0)
  })

  it('acha lead por nome ignorando acento, espaço e maiúscula', () => {
    const leads = [
      { id: 1, nome: 'José da Silva', telefone: '(31) 99277-6813' },
      { id: 2, nome: 'Maria Souza', telefone: '5531988887777' },
    ]
    assert.equal(matchSidebarLeads(leads, 'JOSE SILVA').some(l => l.id === 1), true)
    assert.equal(matchSidebarLeads(leads, 'josé').some(l => l.id === 1), true)
    assert.equal(matchSidebarLeads(leads, 'maria souza').some(l => l.id === 2), true)
    assert.equal(matchSidebarLeads(leads, 'Pedro').length, 0)
  })

  it('acha lead por telefone ignorando espaço, traço e parênteses', () => {
    const leads = [
      { id: 1, nome: 'José da Silva', telefone: '(31) 99277-6813' },
      { id: 2, nome: 'Maria Souza', telefone: '5531988887777' },
    ]
    assert.equal(matchSidebarLeads(leads, '31992776813').some(l => l.id === 1), true)
    assert.equal(matchSidebarLeads(leads, '31 99277 6813').some(l => l.id === 1), true)
    assert.equal(matchSidebarLeads(leads, '(31)99277-6813').some(l => l.id === 1), true)
    assert.equal(matchSidebarLeads(leads, '988887777').some(l => l.id === 2), true)
  })

  it('AppSidebar usa o campo e a busca flexível de páginas e leads', () => {
    const sidebar = readSrc('src/components/layout/AppSidebar.tsx')
    const field = readSrc('src/components/layout/SidebarSearchField.tsx')
    const aura = readSrc('src/components/layout/SidebarSearchAura.tsx')
    const lib = readSrc('src/lib/sidebar-search.ts')
    assert.match(sidebar, /SidebarSearchField/)
    assert.match(sidebar, /flattenSidebarPages/)
    assert.match(sidebar, /matchSidebarPages/)
    assert.match(sidebar, /matchSidebarLeads/)
    assert.match(sidebar, /useSidebarLeadsIndex/)
    assert.match(field, /Buscar páginas ou leads/)
    assert.match(aura, /TextureLoader/)
    assert.match(aura, /identidade-visual-garbo|GARBO_LOGO_SRC/)
    assert.match(lib, /compactarBuscaPagina/)
    assert.match(lib, /compactarBuscaLead/)
    assert.match(lib, /leadCorrespondeBusca/)
    assert.match(lib, /\[-_\/\]\+/)
  })
})
