export interface CrmPipelineEtapa {
  nome: string
  ordem: number
}

export interface CrmKanbanFonte {
  tipo: string
  valor: string | null
  ativo: boolean
}

export interface CrmKanbanOverride {
  leadId: number
  acao: 'include' | 'exclude' | string
}

export interface CrmKanbanColuna {
  id: string
  nome: string
  ordem: number
  fontes: CrmKanbanFonte[]
  overrides: CrmKanbanOverride[]
}

export interface CrmKanbanQuadro {
  id: string
  nome: string
  slug: string
  ordem: number
  colunas: CrmKanbanColuna[]
}

export interface CrmLeadCard {
  id: number
  nome: string
  telefone: string | null
  email: string | null
  origem: string | null
  status: string
  valorNegocio: number
  valorOrcamento: number
  dataChegada: string
  vendedorId: string | null
  vendedorNome: string | null
  darAtencao: boolean
  observacoes: string | null
}

export interface CrmPipelineBoot {
  etapas: CrmPipelineEtapa[]
  quadros: CrmKanbanQuadro[]
  leads: CrmLeadCard[]
}

export interface CrmBoardColumn {
  id: string
  title: string
  statusAlvo: string
  items: CrmLeadCard[]
}

const PIPELINE_STATUS_ALIASES: Record<string, string> = {
  'orçamentos ja enviados': 'Enviou orçamento',
  'orcamentos ja enviados': 'Enviou orçamento',
  'orçamento ja enviado': 'Enviou orçamento',
  'orcamento ja enviado': 'Enviou orçamento',
  'orçamento enviado': 'Enviou orçamento',
  'orcamento enviado': 'Enviou orçamento',
  'reunião marcada': 'Reunião marcada',
  'reuniao marcada': 'Reunião marcada',
  'reunião feita': 'Reunião feita',
  'reuniao feita': 'Reunião feita',
}

export function normalizeLeadStatus(leadStatus: string | null | undefined, etapas: string[]): string {
  const trimmed = (leadStatus || '').trim()
  if (!trimmed) return ''
  const alias = PIPELINE_STATUS_ALIASES[trimmed.toLowerCase()]
  if (alias) return alias
  const caseMatch = etapas.find(stage => stage.trim().toLowerCase() === trimmed.toLowerCase())
  return caseMatch ?? trimmed
}

export function leadBelongsInPipelineStage(
  leadStatus: string | null | undefined,
  stage: string,
  etapas: string[],
): boolean {
  const raw = (leadStatus || '').trim()
  const normalized = normalizeLeadStatus(leadStatus, etapas)
  const inbox = etapas[0]?.trim() || 'Novo Lead'
  const stageKey = stage.trim().toLowerCase()

  if (stage === inbox) {
    return !normalized || normalized === inbox
  }
  if (normalized === stage) return true
  if (raw && raw.toLowerCase() === stageKey) return true
  if (normalized && normalized.toLowerCase() === stageKey) return true
  return false
}

export function getTargetStatusForColumn(coluna: CrmKanbanColuna): string {
  const source = coluna.fontes.find(f => f.ativo && f.tipo === 'status' && f.valor?.trim())
  if (source?.valor?.trim()) return source.valor.trim()
  return coluna.nome.trim()
}

function leadMatchesFonte(lead: CrmLeadCard, fonte: CrmKanbanFonte): boolean {
  if (!fonte.ativo) return false
  if (fonte.tipo !== 'status') return false
  return lead.status === (fonte.valor ?? '')
}

export function resolveQuadroColumns(quadro: CrmKanbanQuadro, leads: CrmLeadCard[]): CrmBoardColumn[] {
  return [...quadro.colunas]
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(coluna => {
      const ids = new Set<number>()
      const fontesAtivas = coluna.fontes.filter(f => f.ativo)
      for (const lead of leads) {
        const matched = fontesAtivas.length > 0
          ? fontesAtivas.some(f => leadMatchesFonte(lead, f))
          : lead.status === coluna.nome
        if (matched) ids.add(lead.id)
      }
      for (const override of coluna.overrides) {
        if (override.acao === 'exclude') ids.delete(Number(override.leadId))
        else ids.add(Number(override.leadId))
      }
      const items = leads
        .filter(lead => ids.has(lead.id))
        .sort((a, b) => {
          if (a.darAtencao !== b.darAtencao) return a.darAtencao ? -1 : 1
          return String(b.dataChegada).localeCompare(String(a.dataChegada))
        })
      return {
        id: coluna.id,
        title: coluna.nome,
        statusAlvo: getTargetStatusForColumn(coluna),
        items,
      }
    })
}

function sortLeadsForColumn(leads: CrmLeadCard[]): CrmLeadCard[] {
  return [...leads].sort((a, b) => {
    if (a.darAtencao !== b.darAtencao) return a.darAtencao ? -1 : 1
    return String(b.dataChegada).localeCompare(String(a.dataChegada))
  })
}

export function resolvePipelineColumns(etapas: string[], leads: CrmLeadCard[]): CrmBoardColumn[] {
  return etapas.map((nome, index) => ({
    id: `pipeline-${index}`,
    title: nome,
    statusAlvo: nome,
    items: sortLeadsForColumn(leads.filter(lead => leadBelongsInPipelineStage(lead.status, nome, etapas))),
  }))
}

export function leadMatchesSearch(lead: CrmLeadCard, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [lead.nome, lead.telefone, lead.email, lead.origem, lead.status, lead.vendedorNome]
    .some(value => (value ?? '').toLowerCase().includes(q))
}

export type CrmDateFilter = 'all' | 'today' | 'week' | 'month' | 'current_month'

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function leadMatchesDateFilter(
  lead: CrmLeadCard,
  filter: CrmDateFilter,
  now = new Date(),
): boolean {
  if (filter === 'all') return true
  const arrived = new Date(lead.dataChegada)
  if (Number.isNaN(arrived.getTime())) return false
  const today = startOfLocalDay(now)
  if (filter === 'today') return startOfLocalDay(arrived).getTime() === today.getTime()
  if (filter === 'week') {
    const from = new Date(today)
    from.setDate(from.getDate() - 7)
    return arrived >= from
  }
  if (filter === 'month') {
    const from = new Date(today)
    from.setMonth(from.getMonth() - 1)
    return arrived >= from
  }
  return arrived.getFullYear() === now.getFullYear() && arrived.getMonth() === now.getMonth()
}

export function uniqueLeadVendors(leads: CrmLeadCard[]): Array<{ id: string; nome: string }> {
  const seen = new Map<string, string>()
  for (const lead of leads) {
    const id = (lead.vendedorId || lead.vendedorNome || '').trim()
    const nome = (lead.vendedorNome || '').trim()
    if (!id || !nome || seen.has(id)) continue
    seen.set(id, nome)
  }
  return [...seen.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function uniqueLeadOrigins(leads: CrmLeadCard[]): string[] {
  return [...new Set(leads.map(lead => (lead.origem || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function filterPipelineLeads(
  leads: CrmLeadCard[],
  opts: {
    busca: string
    vendedorId?: string
    origem?: string
    dateFilter?: CrmDateFilter
    status?: string
  },
): CrmLeadCard[] {
  const vendedorId = opts.vendedorId && opts.vendedorId !== 'all' ? opts.vendedorId : ''
  const origem = opts.origem && opts.origem !== 'all' ? opts.origem : ''
  const dateFilter = opts.dateFilter ?? 'all'
  const status = opts.status && opts.status !== 'all' ? opts.status : ''
  return leads.filter(lead => {
    if (!leadMatchesSearch(lead, opts.busca)) return false
    if (vendedorId === 'unassigned' && (lead.vendedorId || lead.vendedorNome)) return false
    if (vendedorId && vendedorId !== 'unassigned') {
      const key = lead.vendedorId || lead.vendedorNome || ''
      if (key !== vendedorId) return false
    }
    if (origem && (lead.origem || '') !== origem) return false
    if (status && lead.status !== status) return false
    if (!leadMatchesDateFilter(lead, dateFilter)) return false
    return true
  })
}

export function collectStatusOptions(etapas: string[], quadros: CrmKanbanQuadro[]): { value: string; label: string; group: string }[] {
  const seen = new Set<string>()
  const options: { value: string; label: string; group: string }[] = []
  for (const nome of etapas) {
    if (!nome || seen.has(nome)) continue
    seen.add(nome)
    options.push({ value: nome, label: nome, group: 'Pipeline' })
  }
  for (const quadro of [...quadros].sort((a, b) => a.ordem - b.ordem)) {
    for (const coluna of [...quadro.colunas].sort((a, b) => a.ordem - b.ordem)) {
      const value = getTargetStatusForColumn(coluna)
      if (!value || seen.has(value)) continue
      seen.add(value)
      options.push({ value, label: coluna.nome, group: quadro.nome })
    }
  }
  return options
}

export function parsePipelineBoot(raw: unknown): CrmPipelineBoot {
  const data = (raw ?? {}) as Record<string, unknown>
  return {
    etapas: Array.isArray(data.etapas) ? data.etapas as CrmPipelineEtapa[] : [],
    quadros: Array.isArray(data.quadros) ? (data.quadros as CrmKanbanQuadro[]).map(q => ({
      ...q,
      colunas: (q.colunas ?? []).map(c => ({
        ...c,
        fontes: c.fontes ?? [],
        overrides: c.overrides ?? [],
      })),
    })) : [],
    leads: Array.isArray(data.leads) ? (data.leads as CrmLeadCard[]).map(l => ({
      ...l,
      id: Number(l.id),
      valorNegocio: Number(l.valorNegocio ?? 0),
      valorOrcamento: Number(l.valorOrcamento ?? 0),
      darAtencao: l.darAtencao === true,
    })) : [],
  }
}

export const PIPELINE_COL_COLORS = [
  '#f2d892',
  '#4ade80',
  '#82d2ff',
  '#c4b5fd',
  '#fb923c',
  '#f472b6',
  '#34d399',
  '#facc15',
]
