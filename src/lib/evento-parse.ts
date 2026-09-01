import { parseAnotacoes } from '@/lib/evento-helpers'
import { isEventoUnidade } from '@/lib/evento-helpers'
import type {
  EventoCatalogoItem,
  EventoItem,
  EventoMidia,
  EventoPagina,
  EventoParticipante,
  EventoPasta,
  EventoSecao,
  EventoTarefa,
  EventoTipo,
  EventoUnidade,
} from '@/lib/evento-types'
import { EVENTO_SECOES, EVENTO_TIPOS } from '@/lib/evento-types'

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asTipo(value: unknown): EventoTipo {
  const t = asText(value)
  return (EVENTO_TIPOS as readonly string[]).includes(t) ? (t as EventoTipo) : 'outro'
}

function asSecao(value: unknown): EventoSecao {
  const t = asText(value)
  return (EVENTO_SECOES as readonly string[]).includes(t) ? (t as EventoSecao) : 'detalhes'
}

function asUnidade(value: unknown): EventoUnidade {
  const t = asText(value, 'un')
  return isEventoUnidade(t) ? t : 'un'
}

export function parseEventoPasta(raw: unknown): EventoPasta | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    titulo: asText(row.titulo),
    data_evento: asText(row.data_evento).slice(0, 10),
    tipo: asTipo(row.tipo),
    tipo_custom: typeof row.tipo_custom === 'string' ? row.tipo_custom : null,
    observacoes: typeof row.observacoes === 'string' ? row.observacoes : null,
    fixado: row.fixado === true,
    ordem_topo: row.ordem_topo == null ? null : asNumber(row.ordem_topo),
    criado_por: typeof row.criado_por === 'string' ? row.criado_por : null,
    criado_em: asText(row.criado_em),
    atualizado_em: asText(row.atualizado_em),
  }
}

export function parseEventoMidia(raw: unknown): EventoMidia | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    file_url: asText(row.file_url),
    storage_path: typeof row.storage_path === 'string' ? row.storage_path : null,
    file_name: typeof row.file_name === 'string' ? row.file_name : null,
    anotacoes: parseAnotacoes(row.anotacoes),
    ordem: asNumber(row.ordem),
    criado_em: asText(row.criado_em),
  }
}

export function parseEventoParticipante(raw: unknown): EventoParticipante | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!row || typeof row.id !== 'string') return null
  const midiasRaw = Array.isArray(row.evento_participante_midias)
    ? row.evento_participante_midias
    : Array.isArray(row.midias)
      ? row.midias
      : []
  return {
    id: row.id,
    evento_id: asText(row.evento_id),
    lead_id: row.lead_id == null ? null : asNumber(row.lead_id),
    nome: asText(row.nome),
    telefone: typeof row.telefone === 'string' && row.telefone.trim() ? row.telefone.trim() : null,
    email: typeof row.email === 'string' && row.email.trim() ? row.email.trim() : null,
    ordem: asNumber(row.ordem),
    criado_em: asText(row.criado_em),
    midias: midiasRaw.map(parseEventoMidia).filter((m): m is EventoMidia => m != null),
  }
}

export function parseEventoItem(raw: unknown): EventoItem | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!row || typeof row.id !== 'string') return null
  const midiasRaw = Array.isArray(row.evento_item_midias)
    ? row.evento_item_midias
    : Array.isArray(row.midias)
      ? row.midias
      : []
  return {
    id: row.id,
    evento_id: asText(row.evento_id),
    catalogo_item_id: typeof row.catalogo_item_id === 'string' ? row.catalogo_item_id : null,
    nome: asText(row.nome),
    quantidade: asNumber(row.quantidade, 1),
    unidade: asUnidade(row.unidade),
    preco_unitario: asNumber(row.preco_unitario),
    fornecedor: typeof row.fornecedor === 'string' ? row.fornecedor : null,
    telefone_fornecedor: typeof row.telefone_fornecedor === 'string' ? row.telefone_fornecedor : null,
    ordem: asNumber(row.ordem),
    criado_em: asText(row.criado_em),
    atualizado_em: asText(row.atualizado_em),
    midias: midiasRaw.map(parseEventoMidia).filter((m): m is EventoMidia => m != null),
  }
}

export function parseEventoPagina(raw: unknown): EventoPagina | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    evento_id: asText(row.evento_id),
    secao: asSecao(row.secao),
    titulo: asText(row.titulo),
    corpo: asText(row.corpo),
    ordem: asNumber(row.ordem),
    criado_em: asText(row.criado_em),
    atualizado_em: asText(row.atualizado_em),
  }
}

export function parseEventoTarefa(raw: unknown): EventoTarefa | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    evento_id: asText(row.evento_id),
    titulo: asText(row.titulo),
    concluida: row.concluida === true,
    ordem: asNumber(row.ordem),
    criado_em: asText(row.criado_em),
    atualizado_em: asText(row.atualizado_em),
  }
}

export function parseEventoCatalogo(raw: unknown): EventoCatalogoItem | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    nome: asText(row.nome),
    nome_normalizado: asText(row.nome_normalizado),
    preco_unitario: asNumber(row.preco_unitario),
    unidade_padrao: asUnidade(row.unidade_padrao),
    fornecedor: typeof row.fornecedor === 'string' ? row.fornecedor : null,
    telefone_fornecedor: typeof row.telefone_fornecedor === 'string' ? row.telefone_fornecedor : null,
  }
}
