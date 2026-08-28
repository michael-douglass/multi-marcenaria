export type ContratoStatus = 'rascunho' | 'gerado' | 'enviado' | 'assinado' | 'cancelado'

export interface ContratoVariavel {
  id: string
  nome: string
  label: string
  tipo: string
  obrigatorio: boolean
  ordem: number
}

export interface ContratoModelo {
  id: string
  nome: string
  conteudo: string
  ativo: boolean
}

export interface CrmContrato {
  id: string
  identificador: string
  cliente_nome: string
  status: ContratoStatus
  lead_id: number | null
  lead_nome: string | null
  campos_valores: Record<string, string>
  conteudo_final: string
  created_at: string | null
}

export interface CrmContratosBoot {
  contratos: CrmContrato[]
  modelos: ContratoModelo[]
  variaveis: ContratoVariavel[]
  leads: Array<{ id: number; nome: string }>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export const CONTRATO_STATUS_LABEL: Record<string, string> = {
  rascunho: 'Em produção',
  gerado: 'Gerado',
  enviado: 'Enviado',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
}

export const CONTRATO_STATUS_STYLE: Record<string, string> = {
  rascunho: 'border-violet-500/30 bg-violet-500/15 text-violet-400',
  gerado: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
  enviado: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  assinado: 'border-green-500/30 bg-green-500/15 text-green-400',
  cancelado: 'border-red-500/30 bg-red-500/15 text-red-400',
}

export function substituirVariaveis(template: string, valores: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, nome: string) => valores[nome] ?? `{{${nome}}}`)
}

export function extrairVariaveis(template: string): string[] {
  const nomes = new Set<string>()
  for (const m of template.matchAll(/\{\{(\w+)\}\}/g)) nomes.add(m[1])
  return [...nomes]
}

export function gerarIdentificadorContrato(clienteNome: string, now = new Date()): string {
  const d = String(now.getDate()).padStart(2, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${now.getFullYear()} - ${clienteNome.trim() || 'Cliente'}`
}

export function stripMetaCampos(campos: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(campos)) {
    if (!k.startsWith('__')) out[k] = v
  }
  return out
}

export function buildConteudoContrato(modelo: string, valores: Record<string, string>): string {
  return substituirVariaveis(modelo, stripMetaCampos(valores))
}

export function parseContrato(raw: unknown): CrmContrato {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const campos = (row.campos_valores && typeof row.campos_valores === 'object' && !Array.isArray(row.campos_valores)
    ? row.campos_valores
    : {}) as Record<string, string>
  const status = asText(row.status)
  return {
    id: asText(row.id),
    identificador: asText(row.identificador),
    cliente_nome: asText(row.cliente_nome),
    status: (['rascunho', 'gerado', 'enviado', 'assinado', 'cancelado'].includes(status)
      ? status
      : 'rascunho') as ContratoStatus,
    lead_id: row.lead_id == null ? null : asNumber(row.lead_id),
    lead_nome: typeof row.lead_nome === 'string' ? row.lead_nome : null,
    campos_valores: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, String(v ?? '')])),
    conteudo_final: asText(row.conteudo_final),
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  }
}

export function parseContratosBoot(raw: unknown): CrmContratosBoot {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    contratos: Array.isArray(row.contratos) ? row.contratos.map(parseContrato) : [],
    modelos: Array.isArray(row.modelos) ? row.modelos as ContratoModelo[] : [],
    variaveis: Array.isArray(row.variaveis) ? row.variaveis as ContratoVariavel[] : [],
    leads: Array.isArray(row.leads)
      ? row.leads.map(item => {
          const l = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asNumber(l.id), nome: asText(l.nome) }
        }).filter(l => l.id > 0)
      : [],
  }
}

export function filtrarContratos(lista: CrmContrato[], busca: string): CrmContrato[] {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter(item =>
    item.identificador.toLowerCase().includes(termo)
    || item.cliente_nome.toLowerCase().includes(termo)
    || (item.lead_nome ?? '').toLowerCase().includes(termo)
    || CONTRATO_STATUS_LABEL[item.status]?.toLowerCase().includes(termo),
  )
}

export function nomeExibicaoContrato(c: CrmContrato): string {
  const nome = (c.cliente_nome || '').trim()
  if (nome && nome !== 'Rascunho') return nome
  const fromId = c.identificador.match(/^\d{2}\/\d{2}\/\d{4}\s*-\s*(.+)$/)
  if (fromId?.[1] && fromId[1] !== 'Rascunho') return fromId[1].trim()
  return c.lead_nome || nome || 'Cliente não informado'
}

export function contratosEmProducao(lista: CrmContrato[]): CrmContrato[] {
  return lista.filter(item => item.status === 'rascunho')
}

export function contratosFinalizados(lista: CrmContrato[]): CrmContrato[] {
  return lista.filter(item => item.status !== 'rascunho')
}
