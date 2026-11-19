/**
 * Catálogo de páginas da plataforma (multi-empresa, Fase I).
 *
 * Derivado do menu (`NAV_MAIN_ITEMS`) — página nova no menu entra aqui sozinha. O master usa o
 * catálogo para liberar/bloquear páginas por plano e por empresa; o app da marcenaria usa
 * `paginaLiberada` no menu, nas rotas e nos atalhos. Os ids são os mesmos ids do menu.
 */
import {
  getVisibleNavMainItems,
  NAV_MAIN_ITEMS,
  type NavChildItem,
  type NavMainItem,
  type NavVisibilityContext,
} from '@/lib/app-navigation'
import { PAGINAS_NAO_BLOQUEAVEIS, paginaIdBloqueada } from '@/lib/paginas-bloqueio'
import { KANBANS_PADRAO, kanbanPaginaId } from '@/lib/kanbans-padrao'

export type PaginaSecao = 'CRM' | 'Marketing' | 'Movelaria' | 'Geral'

export interface PaginaCatalogo {
  id: string
  titulo: string
  /** URL do menu (pode ter query, ex.: `/projetos?aba=producao`). */
  url: string
  secao: PaginaSecao
  /** Grupo do menu (ex.: "Financeiro", "Obras"). */
  grupo: string
  /** Subgrupo do menu, quando houver (ex.: "Pipeline", "Orçamentos"). */
  subgrupo?: string
  /** Páginas que nunca podem ser bloqueadas (a empresa precisa de uma tela inicial e de perfil). */
  bloqueavel: boolean
  /** `funcao` = recurso sem rota própria (ex.: WhatsApp no lead); padrão `pagina`. */
  tipo?: 'pagina' | 'funcao'
  /** Texto de apoio no editor do master (no lugar da URL). */
  descricao?: string
}

/** Id da função "WhatsApp" do CRM (histórico/envio no lead, notificações). */
export const FUNCAO_WHATSAPP = 'whatsappCrm'
/** Id da função "IA no card lead" (aba IA do lead: Renderização de projetos). */
export const FUNCAO_IA_CARD_LEAD = 'iaCardLead'
/** Id da página Orçamentos IA — também controla a seção/botões dentro do modal de lead. */
export const PAGINA_ORCAMENTOS_IA = 'orcamentosIa'

/**
 * Funções sem rota/menu que o master pode habilitar/desabilitar. A URL é fictícia e reservada
 * (`/funcao/*` nunca vira rota): só existe para `paginaIdFromPath` resolver de volta ao id.
 */
const FUNCOES_CATALOGO: Array<{ id: string; titulo: string; url: string; descricao: string }> = [
  {
    id: FUNCAO_WHATSAPP,
    titulo: 'WhatsApp',
    url: '/funcao/whatsapp',
    descricao: 'Histórico e envio de WhatsApp no lead, notificações e contador de não lidas',
  },
  {
    id: FUNCAO_IA_CARD_LEAD,
    titulo: 'IA no card lead',
    url: '/funcao/ia-card-lead',
    descricao: 'Aba IA do lead com Renderização de projetos (motor e consumo de tokens controlados pela plataforma)',
  },
]

/** Descrições do catálogo do master para páginas cujo efeito vai além da rota. */
const DESCRICAO_NO_CATALOGO: Record<string, string> = {
  [PAGINA_ORCAMENTOS_IA]: 'Página /orcamentos-ia e a seção/botões "Cotar com IA" dentro do lead',
}

/** Seção de cada item principal do menu. Itens fora deste mapa (ex.: portal de parceiros) não entram. */
const SECAO_POR_ITEM: Partial<Record<string, PaginaSecao>> = {
  comercial: 'CRM',
  marketingCrm: 'Marketing',
  adminCrmGrupo: 'Geral',
  dashboard: 'Movelaria',
  financeiro: 'Movelaria',
  funcionariosGrupo: 'Movelaria',
  obras: 'Movelaria',
  pontoGrupo: 'Movelaria',
  meuFinanceiro: 'Geral',
  meuPerfil: 'Geral',
  biblioteca: 'Geral',
  visualizacao: 'Geral',
  configuracoes: 'Geral',
}

/** Nunca bloqueáveis. */
const NAO_BLOQUEAVEIS = PAGINAS_NAO_BLOQUEAVEIS

/** Subgrupos do menu que, no catálogo, vão para "Geral › Administração". */
const SUBGRUPOS_ADMIN = new Set(['adminCrmGrupo'])
const ITENS_ADMIN = new Set(['configuracoes', 'adminCrmGrupo'])

/** Rotas que não aparecem no menu → página-mãe. */
const ROTAS_EXTRAS: Array<{ prefixo: string; id: string }> = [
  { prefixo: '/chat-crm', id: 'leads' },
  { prefixo: '/agenda', id: 'agendaComercial' },
  { prefixo: '/eventos-crm', id: 'controleEventos' },
  { prefixo: '/calendario-obras', id: 'calendarioObras' },
  { prefixo: '/calendario-chegada-materiais', id: 'calendarioChegadaMateriais' },
  { prefixo: '/projetos-producao', id: 'projetosProducao' },
  { prefixo: '/profile', id: 'meuPerfil' },
]

/** Títulos próprios do catálogo do master (o menu mostra um rótulo dinâmico por empresa). */
const TITULO_NO_CATALOGO: Record<string, string> = {
  pontua: 'Pontua (programa de pontos)',
}

export const SECOES_PAGINAS: PaginaSecao[] = ['CRM', 'Marketing', 'Movelaria', 'Geral']

function grupoDoItem(item: NavMainItem): string {
  if (ITENS_ADMIN.has(item.id)) return 'Administração'
  if (SECAO_POR_ITEM[item.id] === 'Geral') return 'Geral'
  return item.title
}

function montarCatalogo(): PaginaCatalogo[] {
  const lista: PaginaCatalogo[] = []
  const vistos = new Set<string>()

  const add = (id: string, titulo: string, url: string | undefined, secao: PaginaSecao, grupo: string, subgrupo?: string) => {
    if (!url || vistos.has(id)) return
    vistos.add(id)
    titulo = TITULO_NO_CATALOGO[id] ?? titulo
    lista.push({
      id,
      titulo,
      url,
      secao,
      grupo,
      subgrupo,
      bloqueavel: !NAO_BLOQUEAVEIS.has(id),
      descricao: DESCRICAO_NO_CATALOGO[id],
    })
  }

  const walk = (items: NavChildItem[], secao: PaginaSecao, grupo: string, subgrupo?: string) => {
    for (const c of items) {
      if (c.children?.length) {
        if (SUBGRUPOS_ADMIN.has(c.id)) walk(c.children, 'Geral', 'Administração', c.title)
        // Subgrupo de um subgrupo (ex.: Funcionários > Ponto > Bater ponto) mantém o nome mais próximo.
        else walk(c.children, secao, grupo, c.title)
      } else {
        add(c.id, c.title, c.url, secao, grupo, subgrupo)
        // Kanbans padrão (criados em toda empresa) são páginas próprias, logo após o Kanban principal.
        if (c.id === 'pipeline') {
          for (const k of KANBANS_PADRAO) add(kanbanPaginaId(k.slug), k.titulo, `/pipeline/${k.slug}`, secao, grupo, subgrupo)
        }
      }
    }
  }

  for (const item of NAV_MAIN_ITEMS) {
    const secao = SECAO_POR_ITEM[item.id]
    if (!secao) continue
    const grupo = grupoDoItem(item)
    // Administração CRM: menu próprio, mas no catálogo segue em Geral › Administração › Administração CRM.
    if (item.children?.length) walk(item.children, secao, grupo, SUBGRUPOS_ADMIN.has(item.id) ? item.title : undefined)
    else add(item.id, item.title, item.url, secao, grupo)
  }
  // Funções (sem rota): grupo próprio no editor do master.
  for (const f of FUNCOES_CATALOGO) {
    add(f.id, f.titulo, f.url, 'CRM', 'Funções do CRM')
    const item = lista.find(p => p.id === f.id)
    if (item) {
      item.tipo = 'funcao'
      item.descricao = f.descricao
    }
  }
  return lista
}

let cache: PaginaCatalogo[] | null = null

/** Todas as páginas controláveis, na ordem do menu. */
export function listarPaginas(): PaginaCatalogo[] {
  if (!cache) cache = montarCatalogo()
  return cache
}

const PAGINAS_POR_ID = () => new Map(listarPaginas().map(p => [p.id, p]))
let porId: Map<string, PaginaCatalogo> | null = null
export function paginaPorId(id: string): PaginaCatalogo | undefined {
  if (!porId) porId = PAGINAS_POR_ID()
  return porId.get(id)
}

function separarUrl(url: string): { path: string; query: URLSearchParams | null } {
  const [path, q] = url.split('?')
  return { path: path || '/', query: q ? new URLSearchParams(q) : null }
}

function casaPrefixo(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * Página do catálogo a que uma URL pertence (sub-rotas caem na página-mãe:
 * `/contratos/123` → `contratosCrm`). `null` = rota fora do catálogo (sempre liberada).
 */
export function paginaIdFromPath(pathname: string, search = ''): string | null {
  const params = new URLSearchParams(search)
  const paginas = listarPaginas()

  // 1) URLs do menu com query (ex.: `/projetos?aba=producao`) só casam com a mesma query.
  for (const p of paginas) {
    const { path, query } = separarUrl(p.url)
    if (!query || pathname !== path) continue
    let ok = true
    query.forEach((v, k) => {
      if (params.get(k) !== v) ok = false
    })
    if (ok) return p.id
  }

  // 2) Prefixo mais longo entre as URLs do menu (sem query) e as rotas extras.
  let melhor: { id: string; tam: number } | null = null
  const considerar = (path: string, id: string) => {
    if (casaPrefixo(pathname, path) && (!melhor || path.length > melhor.tam)) melhor = { id, tam: path.length }
  }
  for (const p of paginas) {
    const { path, query } = separarUrl(p.url)
    if (!query) considerar(path, p.id)
  }
  for (const r of ROTAS_EXTRAS) considerar(r.prefixo, r.id)
  // Kanbans padrão têm URL própria no catálogo (prefixo mais longo vence); os criados pelo admin
  // (`/pipeline/:slug`) caem no `/pipeline`.
  return (melhor as { id: string; tam: number } | null)?.id ?? null
}

/**
 * A página (id do catálogo ou caminho) está liberada para a empresa?
 * Rotas fora do catálogo e páginas não bloqueáveis sempre estão.
 */
export function paginaLiberada(pathOrId: string, bloqueadas: readonly string[] | null | undefined, search = ''): boolean {
  if (!bloqueadas?.length) return true
  const id = pathOrId.startsWith('/') ? paginaIdFromPath(pathOrId, search) : pathOrId
  if (!id) return true
  return !paginaIdBloqueada(id, bloqueadas)
}

/** Remove ids desconhecidos e não bloqueáveis (sanitiza antes de salvar). */
export function normalizarBloqueadas(ids: readonly string[]): string[] {
  return [...new Set(ids)].filter(id => paginaPorId(id)?.bloqueavel === true).sort()
}

/**
 * Tela inicial respeitando as páginas bloqueadas: se a página padrão do papel estiver bloqueada,
 * usa a primeira página visível do menu; em último caso, Meu Perfil (nunca bloqueável).
 */
export function homeLiberada(
  defaultPath: string,
  bloqueadas: readonly string[] | null | undefined,
  ctx: NavVisibilityContext,
): string {
  if (!bloqueadas?.length) return defaultPath
  const [path, query = ''] = defaultPath.split('?')
  if (paginaLiberada(path || '/', bloqueadas, query ? `?${query}` : '')) return defaultPath
  for (const item of getVisibleNavMainItems({ ...ctx, paginasBloqueadas: bloqueadas })) {
    const url = primeiraFolha(item)
    if (url) return url
  }
  return '/meu-perfil'
}

function primeiraFolha(item: { url?: string; children?: NavChildItem[] }): string | undefined {
  if (!item.children?.length) return item.url
  for (const c of item.children) {
    const u = primeiraFolha(c)
    if (u) return u
  }
  return undefined
}
