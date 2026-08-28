export interface CrmNotificacao {
  id: string
  leadId: number | null
  vendorName: string
  tipo: string
  message: string
  read: boolean
  createdAt: string
}

export interface CrmWhatsAppMsg {
  id: string
  telefone: string
  remetente: 'lead' | 'atendente' | 'ia' | 'human' | 'ai'
  tipoMensagem: string
  conteudo: string
  urlMidia: string | null
  origem: string
  criadoEm: string | null
}

export interface CrmEvento {
  id: string
  titulo: string
  dataEvento: string
  tipo: string
  tipoCustom: string | null
  observacoes: string | null
}

export interface CrmEventoPagina {
  id: string
  eventoId: string
  secao: string
  titulo: string
  corpo: string
  ordem: number
}

export interface CrmChatContato {
  id: string
  nome: string | null
  telefone: string
  leadId: number | null
  naoLidas: number
}

export interface CrmLeadAnalise {
  id: string
  modelo: string
  conteudo: string
  perguntas: string | null
  criadoEm: string
}

export interface CrmLeadRender {
  id: string
  url: string
  criadoEm: string
  notas: string | null
}

export interface CrmLeadIaChat {
  id: string
  role: string
  content: string
  criadoEm: string
}

export interface CrmAgendaPublica {
  nome: string
  slug: string
  duracaoMinutos: number
  intervaloMinutos: number
  horarioInicio: string
  horarioFim: string
  diasDisponiveis: number[]
  texto: string | null
  antecedenciaMinimaHoras: number
  antecedenciaMaximaDias: number
  ocupados: string[]
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

export function parseNotificacoes(raw: unknown): { items: CrmNotificacao[]; total: number; naoLidas: number } {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const items: CrmNotificacao[] = Array.isArray(data.items)
    ? data.items.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          leadId: typeof row.lead_id === 'number' ? row.lead_id : null,
          vendorName: asText(row.vendor_name),
          tipo: asText(row.notification_type),
          message: asText(row.message),
          read: asBool(row.read),
          createdAt: asText(row.created_at),
        }
      }).filter(n => n.id)
    : []
  return { items, total: asNumber(data.total), naoLidas: asNumber(data.nao_lidas) }
}

export function parseWhatsAppHistorico(raw: unknown): CrmWhatsAppMsg[] {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const fromRpc = Array.isArray(data.items) ? data.items : []
  return fromRpc.map(item => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const remetente = asText(row.tipo_remetente) || asText(row.type)
    return {
      id: asText(row.id) || String(row.id ?? ''),
      telefone: asText(row.telefone),
      remetente: (remetente || 'atendente') as CrmWhatsAppMsg['remetente'],
      tipoMensagem: asText(row.tipo_mensagem) || 'texto',
      conteudo: asText(row.conteudo) || asText(row.content),
      urlMidia: typeof row.url_midia === 'string' ? row.url_midia : null,
      origem: asText(row.origem) || 'crm',
      criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
    }
  }).filter(m => m.id || m.conteudo)
}

export function parseN8nWhatsApp(raw: unknown): CrmWhatsAppMsg[] {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const msgs = Array.isArray(data.messages) ? data.messages : []
  return msgs.map((item, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const type = asText(row.type)
    return {
      id: asText(row.id) || `n8n-${index}`,
      telefone: '',
      remetente: type === 'human' || type === 'lead' ? 'lead' : 'atendente',
      tipoMensagem: asText(row.tipo_mensagem) || 'texto',
      conteudo: asText(row.content) || asText(row.conteudo),
      urlMidia: typeof row.url_midia === 'string' ? row.url_midia : null,
      origem: 'n8n',
      criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
    }
  }).filter(m => m.conteudo || m.urlMidia)
}

export function juntarWhatsApp(local: CrmWhatsAppMsg[], n8n: CrmWhatsAppMsg[]): CrmWhatsAppMsg[] {
  const seen = new Set<string>()
  const out: CrmWhatsAppMsg[] = []
  for (const msg of [...n8n, ...local]) {
    const key = `${msg.origem}:${msg.id}:${msg.conteudo.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(msg)
  }
  return out
}

export function parseEventosBoot(raw: unknown): { eventos: CrmEvento[]; paginas: CrmEventoPagina[] } {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const eventos: CrmEvento[] = Array.isArray(data.eventos)
    ? data.eventos.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          titulo: asText(row.titulo),
          dataEvento: asText(row.data_evento),
          tipo: asText(row.tipo),
          tipoCustom: typeof row.tipo_custom === 'string' ? row.tipo_custom : null,
          observacoes: typeof row.observacoes === 'string' ? row.observacoes : null,
        }
      }).filter(e => e.id)
    : []
  const paginas: CrmEventoPagina[] = Array.isArray(data.paginas)
    ? data.paginas.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          eventoId: asText(row.evento_id),
          secao: asText(row.secao),
          titulo: asText(row.titulo),
          corpo: asText(row.corpo),
          ordem: asNumber(row.ordem),
        }
      }).filter(p => p.id)
    : []
  return { eventos, paginas }
}

export function paginasDoEvento(paginas: CrmEventoPagina[], eventoId: string): CrmEventoPagina[] {
  return paginas.filter(p => p.eventoId === eventoId).sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo))
}

export function parseChatBoot(raw: unknown): CrmChatContato[] {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Array.isArray(data.contatos)
    ? data.contatos.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          nome: typeof row.nome === 'string' ? row.nome : null,
          telefone: asText(row.telefone),
          leadId: typeof row.lead_id === 'number' ? row.lead_id : null,
          naoLidas: asNumber(row.nao_lidas),
        }
      }).filter(c => c.id)
    : []
}

export function parseLeadIaBoot(raw: unknown): {
  analises: CrmLeadAnalise[]
  renders: CrmLeadRender[]
  chat: CrmLeadIaChat[]
} {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const analises: CrmLeadAnalise[] = Array.isArray(data.analises)
    ? data.analises.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          modelo: asText(row.modelo),
          conteudo: asText(row.conteudo),
          perguntas: typeof row.perguntas_briefing === 'string' ? row.perguntas_briefing : null,
          criadoEm: asText(row.criado_em),
        }
      }).filter(a => a.id)
    : []
  const renders: CrmLeadRender[] = Array.isArray(data.renders)
    ? data.renders.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          url: asText(row.output_public_url),
          criadoEm: asText(row.criado_em),
          notas: typeof row.edit_notas === 'string' ? row.edit_notas : null,
        }
      }).filter(r => r.id)
    : []
  const chat: CrmLeadIaChat[] = Array.isArray(data.chat)
    ? data.chat.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          role: asText(row.role),
          content: asText(row.content),
          criadoEm: asText(row.criado_em),
        }
      }).filter(m => m.id)
    : []
  return { analises, renders, chat: [...chat].reverse() }
}

export function parseAgendaPublica(raw: unknown): CrmAgendaPublica | null {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const slug = asText(data.slug)
  if (!slug) return null
  const dias = Array.isArray(data.dias_disponiveis)
    ? data.dias_disponiveis.map(n => Number(n)).filter(n => Number.isFinite(n))
    : [1, 2, 3, 4, 5]
  return {
    nome: asText(data.nome) || 'Agenda',
    slug,
    duracaoMinutos: asNumber(data.duracao_minutos, 60),
    intervaloMinutos: asNumber(data.intervalo_minutos, 15),
    horarioInicio: asText(data.horario_inicio).slice(0, 5) || '08:00',
    horarioFim: asText(data.horario_fim).slice(0, 5) || '18:00',
    diasDisponiveis: dias,
    texto: typeof data.texto === 'string' ? data.texto : null,
    antecedenciaMinimaHoras: asNumber(data.antecedencia_minima_horas, 24),
    antecedenciaMaximaDias: asNumber(data.antecedencia_maxima_dias, 30),
    ocupados: Array.isArray(data.ocupados) ? data.ocupados.map(v => String(v)) : [],
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function horariosDoDia(agenda: CrmAgendaPublica, isoDate: string): string[] {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return []
  const jsDay = new Date(y, m - 1, d).getDay()
  if (!agenda.diasDisponiveis.includes(jsDay)) return []

  const [h0, min0] = agenda.horarioInicio.split(':').map(Number)
  const [h1, min1] = agenda.horarioFim.split(':').map(Number)
  const start = h0 * 60 + (min0 || 0)
  const end = h1 * 60 + (min1 || 0)
  const step = Math.max(15, agenda.intervaloMinutos)
  const ocupado = new Set(agenda.ocupados.map(o => o.slice(0, 16)))
  const out: string[] = []
  for (let t = start; t + agenda.duracaoMinutos <= end; t += step) {
    const hh = Math.floor(t / 60)
    const mm = t % 60
    const stamp = `${isoDate}T${pad(hh)}:${pad(mm)}`
    if ([...ocupado].some(o => o.startsWith(stamp))) continue
    out.push(`${pad(hh)}:${pad(mm)}`)
  }
  return out
}

export function proximosDiasAgenda(agenda: CrmAgendaPublica, quantidade = 14, from = new Date()): string[] {
  const max = Math.max(1, agenda.antecedenciaMaximaDias || 30)
  const out: string[] = []
  for (let i = 0; i < max && out.length < quantidade; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if (horariosDoDia(agenda, iso).length > 0) out.push(iso)
  }
  return out
}

export const NOTIF_TIPO_LABEL: Record<string, string> = {
  aula_marcada: 'Aula',
  venda_realizada: 'Venda',
  venda_perdida: 'Perdida',
  vendedor_ausente: 'Ausência',
}
