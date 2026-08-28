import { differenceInCalendarDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { correspondeBuscaFlexivel } from '@/lib/markup-busca'
import type {
  EventoDesenho,
  EventoItem,
  EventoPasta,
  EventoPastaCard,
  EventoTipo,
  EventoTotais,
  EventoUnidade,
} from '@/lib/evento-types'
import { EVENTO_UNIDADES } from '@/lib/evento-types'

const TIPO_LABEL: Record<EventoTipo, string> = {
  festa_fim_ano: 'Festa de fim de ano',
  arquitetos: 'Evento de arquitetos',
  outro: 'Outro',
}

/** Data do card em calendário local — YYYY-MM-DD sem deslocar o dia pelo fuso. */
export function parseDataEventoLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

export function formatDataEventoIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function labelEventoQuando(iso: string, hoje = new Date()): string {
  const data = parseDataEventoLocal(iso)
  const diff = differenceInCalendarDays(data, new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()))
  if (diff === 0) return 'Acontece hoje'
  if (diff === 1) return 'Acontece amanhã'
  if (diff > 1) return `Acontece em ${diff} dias`
  if (diff === -1) return 'Foi ontem'
  return `Foi há ${Math.abs(diff)} dias`
}

export function labelEventoTipo(tipo: EventoTipo, tipoCustom?: string | null): string {
  if (tipo === 'outro' && tipoCustom?.trim()) return tipoCustom.trim()
  return TIPO_LABEL[tipo] ?? TIPO_LABEL.outro
}

export function labelEventoDataExtenso(iso: string): string {
  return format(parseDataEventoLocal(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function normalizarNomeCatalogo(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function arredondarEvento(valor: number): number {
  return Math.round((Number(valor) || 0) * 100) / 100
}

export function totalLinhaItem(item: Pick<EventoItem, 'quantidade' | 'preco_unitario'>): number {
  return arredondarEvento(Number(item.quantidade) * Number(item.preco_unitario))
}

export function formatarMoedaEvento(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(arredondarEvento(valor))
}

export function isEventoUnidade(value: string): value is EventoUnidade {
  return (EVENTO_UNIDADES as readonly string[]).includes(value)
}

export function totaisDoEvento(
  pessoas: number,
  itens: Array<Pick<EventoItem, 'quantidade' | 'preco_unitario'>>,
): EventoTotais {
  return {
    pessoas,
    itens: itens.length,
    total: arredondarEvento(itens.reduce((acc, item) => acc + totalLinhaItem(item), 0)),
  }
}

export function ordenarPastasEvento<T extends Pick<EventoPasta, 'fixado' | 'ordem_topo' | 'data_evento'>>(
  lista: T[],
): T[] {
  return [...lista].sort((a, b) => {
    if (a.fixado !== b.fixado) return a.fixado ? -1 : 1
    if (a.fixado && b.fixado) {
      return (b.ordem_topo ?? 0) - (a.ordem_topo ?? 0)
    }
    return b.data_evento.localeCompare(a.data_evento)
  })
}

export function eventoCorrespondeBusca(
  evento: Pick<EventoPastaCard, 'titulo' | 'tipo' | 'tipo_custom' | 'observacoes' | 'data_evento'>,
  termo: string,
): boolean {
  const t = termo.trim()
  if (!t) return true
  const tipo = labelEventoTipo(evento.tipo, evento.tipo_custom)
  const quando = labelEventoQuando(evento.data_evento)
  const blob = [evento.titulo, tipo, evento.observacoes ?? '', evento.data_evento, quando].join(' ')
  return correspondeBuscaFlexivel(blob, t)
}

export function parseAnotacoes(raw: unknown): EventoDesenho[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const path = typeof row.path_data === 'string' ? row.path_data : ''
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id || !path) return null
      return {
        id,
        path_data: path,
        cor: typeof row.cor === 'string' ? row.cor : '#f0d28c',
        stroke_width: Number(row.stroke_width) || 4,
      } satisfies EventoDesenho
    })
    .filter((item): item is EventoDesenho => item != null)
}

export function proximaOrdemPin(pastas: Array<Pick<EventoPasta, 'ordem_topo'>>): number {
  const max = pastas.reduce((acc, pasta) => Math.max(acc, pasta.ordem_topo ?? 0), 0)
  return max + 1
}
