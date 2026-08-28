export type AgendaStatus = 'pendente' | 'confirmado' | 'concluido' | 'cancelado'

export interface CrmReuniao {
  id: string
  titulo: string
  descricao: string | null
  data_hora_inicio: string
  data_hora_fim: string
  duracao_minutos: number
  convidado_nome: string | null
  convidado_whatsapp: string | null
  convidado_email: string | null
  status: AgendaStatus
  tipo: string
  lead_id: number | null
  lead_nome: string | null
  observacoes: string | null
  link_video_conferencia: string | null
}

export interface CrmAgendaConfig {
  nome_agenda: string
  slug: string
  duracao_minutos: number
  ativo: boolean
}

export interface CrmAgendaBoot {
  config: CrmAgendaConfig
  reunioes: CrmReuniao[]
  leads: Array<{ id: number; nome: string }>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const AGENDA_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export function parseReuniao(raw: unknown): CrmReuniao {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const status = asText(row.status)
  return {
    id: asText(row.id),
    titulo: asText(row.titulo),
    descricao: typeof row.descricao === 'string' ? row.descricao : null,
    data_hora_inicio: asText(row.data_hora_inicio),
    data_hora_fim: asText(row.data_hora_fim),
    duracao_minutos: asNumber(row.duracao_minutos, 30),
    convidado_nome: typeof row.convidado_nome === 'string' ? row.convidado_nome : null,
    convidado_whatsapp: typeof row.convidado_whatsapp === 'string' ? row.convidado_whatsapp : null,
    convidado_email: typeof row.convidado_email === 'string' ? row.convidado_email : null,
    status: (['pendente', 'confirmado', 'concluido', 'cancelado'].includes(status) ? status : 'pendente') as AgendaStatus,
    tipo: asText(row.tipo) || 'interno',
    lead_id: row.lead_id == null ? null : asNumber(row.lead_id),
    lead_nome: typeof row.lead_nome === 'string' ? row.lead_nome : null,
    observacoes: typeof row.observacoes === 'string' ? row.observacoes : null,
    link_video_conferencia: typeof row.link_video_conferencia === 'string' ? row.link_video_conferencia : null,
  }
}

export function parseAgendaBoot(raw: unknown): CrmAgendaBoot {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cfg = (row.config && typeof row.config === 'object' ? row.config : {}) as Record<string, unknown>
  return {
    config: {
      nome_agenda: asText(cfg.nome_agenda) || 'Agenda comercial',
      slug: asText(cfg.slug),
      duracao_minutos: asNumber(cfg.duracao_minutos, 30),
      ativo: cfg.ativo !== false,
    },
    reunioes: Array.isArray(row.reunioes) ? row.reunioes.map(parseReuniao) : [],
    leads: Array.isArray(row.leads)
      ? row.leads.map(item => {
          const l = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asNumber(l.id), nome: asText(l.nome) }
        }).filter(l => l.id > 0)
      : [],
  }
}

export function filtrarReunioes(lista: CrmReuniao[], busca: string): CrmReuniao[] {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter(item =>
    item.titulo.toLowerCase().includes(termo)
    || (item.convidado_nome ?? '').toLowerCase().includes(termo)
    || (item.lead_nome ?? '').toLowerCase().includes(termo)
    || AGENDA_STATUS_LABEL[item.status]?.toLowerCase().includes(termo),
  )
}

export function linkPublicoAgenda(slug: string, origin = typeof window === 'undefined' ? '' : window.location.origin): string {
  if (!slug) return ''
  return `${origin}/agendar/garbo/${slug}`
}

export function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocal(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  d.setMinutes(d.getMinutes() + minutes)
  return d.toISOString()
}

function diaChave(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function reunioesDoDia(lista: CrmReuniao[], day: Date): CrmReuniao[] {
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  return lista.filter(item => diaChave(item.data_hora_inicio) === key)
}

export function reunioesHoje(lista: CrmReuniao[]): CrmReuniao[] {
  return reunioesDoDia(lista, new Date())
}
