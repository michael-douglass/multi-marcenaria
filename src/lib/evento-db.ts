import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { isSchemaApiExposed } from '@/lib/empresa-tables'

export interface EventosTableNames {
  schema: string | null
  eventos: string
  participantes: string
  participanteMidias: string
  itens: string
  itemMidias: string
  eventoMidias: string
  catalogo: string
  tarefas: string
  cadernos: string
  paginas: string
}

export function resolveEventosTables(schemaNome: string | null | undefined): EventosTableNames {
  if (schemaNome && isSchemaApiExposed(schemaNome) && schemaNome !== 'public') {
    return {
      schema: schemaNome,
      eventos: 'eventos',
      participantes: 'evento_participantes',
      participanteMidias: 'evento_participante_midias',
      itens: 'evento_itens',
      itemMidias: 'evento_item_midias',
      eventoMidias: 'evento_midias',
      catalogo: 'evento_catalogo_itens',
      tarefas: 'evento_tarefas',
      cadernos: 'evento_cadernos',
      paginas: 'evento_paginas',
    }
  }
  return {
    schema: null,
    eventos: 'crm_multiempresas_eventos',
    participantes: 'crm_multiempresas_evento_participantes',
    participanteMidias: 'crm_multiempresas_evento_participante_midias',
    itens: 'crm_multiempresas_evento_itens',
    itemMidias: 'crm_multiempresas_evento_item_midias',
    eventoMidias: 'crm_multiempresas_evento_midias',
    catalogo: 'crm_multiempresas_evento_catalogo_itens',
    tarefas: 'crm_multiempresas_evento_tarefas',
    cadernos: 'crm_multiempresas_evento_cadernos',
    paginas: 'crm_multiempresas_evento_paginas',
  }
}

export function getEventosDb(schemaNome: string | null | undefined): SupabaseClient {
  const tables = resolveEventosTables(schemaNome)
  return (tables.schema ? supabase.schema(tables.schema) : supabase) as unknown as SupabaseClient
}

export const EVENTO_STORAGE_BUCKET = 'marketing-medias'

export function eventoStoragePath(
  eventoId: string,
  kind: 'participantes' | 'itens' | 'galeria',
  ownerId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^\w.-]+/g, '-').slice(-80) || 'foto.jpg'
  const rand = Math.random().toString(36).slice(2, 8)
  if (kind === 'galeria') {
    return `eventos/${eventoId}/galeria/${Date.now()}-${rand}-${safe}`
  }
  return `eventos/${eventoId}/${kind}/${ownerId}/${Date.now()}-${rand}-${safe}`
}
