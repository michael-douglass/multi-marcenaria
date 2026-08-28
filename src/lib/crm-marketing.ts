export interface MktColuna {
  id: string
  nome: string
  ordem: number
}

export interface MktCard {
  id: string
  titulo: string
  scriptCopy: string | null
  columnId: string
  urgente: boolean
  performando: boolean
  ordem: number
  criadoEm: string | null
}

export interface MktPasta {
  id: string
  nome: string
  descricao: string | null
  total: number
}

export interface MktNode {
  id: string
  titulo: string
  conteudo: string | null
  classificacao: string | null
  enviadoProducao: boolean
  cardId: string | null
  criadoEm: string | null
}

export interface MktTarefa {
  id: string
  titulo: string
  descricao: string | null
  status: string
  dataAgendada: string | null
  horaAgendada: string | null
  contentCardId: string | null
}

export interface MktMedia {
  id: string
  titulo: string
  tipo: string
  fileUrl: string
  fileName: string
  folderId: string | null
  criadoEm: string | null
}

export interface MktBoot {
  colunas: MktColuna[]
  cards: MktCard[]
  pastas: MktPasta[]
  semPasta: number
  totalMidias: number
  nodes: MktNode[]
  tarefas: MktTarefa[]
  agentes: Array<{ id: string; nome: string; slug: string; ativo: boolean }>
}

export const EMPTY_MKT_BOOT: MktBoot = {
  colunas: [],
  cards: [],
  pastas: [],
  semPasta: 0,
  totalMidias: 0,
  nodes: [],
  tarefas: [],
  agentes: [],
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asBool(value: unknown): boolean {
  return value === true
}

export function cardsDaColuna(cards: MktCard[], columnId: string): MktCard[] {
  return cards.filter(c => c.columnId === columnId).sort((a, b) => a.ordem - b.ordem)
}

export function filtrarTarefasDoMes(tarefas: MktTarefa[], ym: string): MktTarefa[] {
  return tarefas.filter(t => (t.dataAgendada ?? '').startsWith(ym))
}

export function mesAtualKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function tarefasDoDia(tarefas: MktTarefa[], isoDate: string): MktTarefa[] {
  return tarefas.filter(t => (t.dataAgendada ?? '').slice(0, 10) === isoDate)
}

export function parseMarketingBoot(raw: unknown): MktBoot {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const colunas: MktColuna[] = Array.isArray(data.colunas)
    ? data.colunas.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return { id: asText(row.id), nome: asText(row.nome), ordem: asNumber(row.ordem) }
      }).filter(c => c.id)
    : []
  const cards: MktCard[] = Array.isArray(data.cards)
    ? data.cards.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          titulo: asText(row.titulo),
          scriptCopy: typeof row.script_copy === 'string' ? row.script_copy : null,
          columnId: asText(row.column_id),
          urgente: asBool(row.urgente),
          performando: asBool(row.performando),
          ordem: asNumber(row.ordem),
          criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
        }
      }).filter(c => c.id)
    : []
  const pastas: MktPasta[] = Array.isArray(data.pastas)
    ? data.pastas.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          nome: asText(row.nome),
          descricao: typeof row.descricao === 'string' ? row.descricao : null,
          total: asNumber(row.total),
        }
      }).filter(p => p.id)
    : []
  const nodes: MktNode[] = Array.isArray(data.nodes)
    ? data.nodes.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          titulo: asText(row.titulo),
          conteudo: typeof row.conteudo === 'string' ? row.conteudo : null,
          classificacao: typeof row.classificacao === 'string' ? row.classificacao : null,
          enviadoProducao: asBool(row.enviado_producao),
          cardId: typeof row.card_id === 'string' ? row.card_id : null,
          criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
        }
      }).filter(n => n.id)
    : []
  const tarefas: MktTarefa[] = Array.isArray(data.tarefas)
    ? data.tarefas.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          titulo: asText(row.titulo),
          descricao: typeof row.descricao === 'string' ? row.descricao : null,
          status: asText(row.status) || 'pendente',
          dataAgendada: typeof row.data_agendada === 'string' ? row.data_agendada : null,
          horaAgendada: row.hora_agendada != null ? String(row.hora_agendada) : null,
          contentCardId: typeof row.content_card_id === 'string' ? row.content_card_id : null,
        }
      }).filter(t => t.id)
    : []
  return {
    colunas,
    cards,
    pastas,
    semPasta: asNumber(data.sem_pasta),
    totalMidias: asNumber(data.total_midias),
    nodes,
    tarefas,
    agentes: Array.isArray(data.agentes)
      ? data.agentes.map(item => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asText(row.id), nome: asText(row.nome), slug: asText(row.slug), ativo: asBool(row.ativo) }
        }).filter(a => a.id)
      : [],
  }
}

export function parseMarketingMedias(raw: unknown): { items: MktMedia[]; total: number } {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const items: MktMedia[] = Array.isArray(data.items)
    ? data.items.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          titulo: asText(row.titulo),
          tipo: asText(row.tipo) || 'imagem',
          fileUrl: asText(row.file_url),
          fileName: asText(row.file_name),
          folderId: typeof row.folder_id === 'string' ? row.folder_id : null,
          criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
        }
      }).filter(m => m.id)
    : []
  return { items, total: asNumber(data.total) }
}

export interface MktFonte {
  id: string
  nome: string
  cor: string
  ativo: boolean
}

export interface MktSubFonte {
  id: string
  fonteId: string
  nome: string
}

export interface MktGastoColuna {
  id: string
  subFonteId: string
  nome: string
  tipo: string
}

export interface MktLancamento {
  id: string
  colunaId: string
  data: string
  valor: number
  observacao: string | null
}

export function parseGastosBoot(raw: unknown): {
  fontes: MktFonte[]
  subFontes: MktSubFonte[]
  colunas: MktGastoColuna[]
  lancamentos: MktLancamento[]
} {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    fontes: Array.isArray(data.fontes)
      ? data.fontes.map(item => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asText(row.id), nome: asText(row.nome), cor: asText(row.cor) || '#f2d892', ativo: row.ativo !== false }
        }).filter(f => f.id)
      : [],
    subFontes: Array.isArray(data.sub_fontes)
      ? data.sub_fontes.map(item => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asText(row.id), fonteId: asText(row.fonte_id), nome: asText(row.nome) }
        }).filter(s => s.id)
      : [],
    colunas: Array.isArray(data.colunas)
      ? data.colunas.map(item => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asText(row.id), subFonteId: asText(row.sub_fonte_id), nome: asText(row.nome), tipo: asText(row.tipo) }
        }).filter(c => c.id)
      : [],
    lancamentos: Array.isArray(data.lancamentos)
      ? data.lancamentos.map(item => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return {
            id: asText(row.id),
            colunaId: asText(row.coluna_id),
            data: asText(row.data),
            valor: asNumber(row.valor_numerico),
            observacao: typeof row.observacao === 'string' ? row.observacao : null,
          }
        }).filter(l => l.id)
      : [],
  }
}

export function somaLancamentos(lista: MktLancamento[]): number {
  return lista.reduce((s, l) => s + l.valor, 0)
}

export const APRESENTACAO_SECTIONS = [
  { id: 'origem', titulo: 'A origem', texto: 'A Garbo nasceu da marcenaria fina: cada projeto é desenhado com o cliente e com o arquiteto, do primeiro traço até a instalação.' },
  { id: 'proposta', titulo: 'A proposta', texto: 'Parceiros indicam clientes. A fábrica cuida de orçamento, produção e montagem. O arquiteto acompanha o que foi liberado no portal.' },
  { id: 'pontua', titulo: 'Pontua Garbo', texto: 'Cada venda fechada gera pontos e comissão. O saldo aparece no portal do parceiro. O saque é pedido em PIX e o admin confirma.' },
  { id: 'prova', titulo: 'Prova social', texto: 'Obras entregues, lousa do projeto e orçamentos em slides são o material que o time usa para apresentar a casa.' },
] as const
