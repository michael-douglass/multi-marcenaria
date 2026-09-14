import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import type { EventosTableNames } from '@/lib/evento-db'

export const AGENDA_PESSOAL_TABLE = 'crm_multiempresas_agenda_pessoal_tarefas'

export interface EventoAgendaEspelhoInput {
  eventoId: string
  eventoTarefaId: string
  titulo: string
  concluida: boolean
  dataEvento: string
  tituloEvento?: string | null
  userId: string
  agendaTarefaIdAtual?: string | null
}

/**
 * Garante que uma tarefa do Controle de Eventos exista também na Agenda Pessoal,
 * com as mesmas características básicas (dia, titular, cor, vínculo).
 */
export async function garantirTarefaEventoNaAgenda(
  db: SupabaseClient,
  tables: EventosTableNames,
  input: EventoAgendaEspelhoInput,
): Promise<string> {
  const dataEvento = input.dataEvento.slice(0, 10)
  if (!dataEvento) throw new Error('Esta pasta precisa de uma data para ir à Agenda')

  const { data: existente } = await supabase
    .from(AGENDA_PESSOAL_TABLE)
    .select('id')
    .eq('evento_tarefa_id', input.eventoTarefaId)
    .maybeSingle()

  if (existente?.id) {
    if (input.agendaTarefaIdAtual !== existente.id) {
      await db
        .from(tables.tarefas)
        .update({ agenda_tarefa_id: existente.id, atualizado_em: new Date().toISOString() })
        .eq('id', input.eventoTarefaId)
    }
    return existente.id as string
  }

  const agendaId = crypto.randomUUID()
  const tituloEvento = input.tituloEvento?.trim() || null
  const { error: agendaError } = await supabase.from(AGENDA_PESSOAL_TABLE).insert({
    id: agendaId,
    titulo: input.titulo,
    descricao: tituloEvento
      ? `Controle de Eventos · ${tituloEvento}`
      : 'Controle de Eventos',
    data: dataEvento,
    hora: null,
    tipo_agendamento: 'unica',
    titular_id: input.userId,
    titular_nome: null,
    criado_por: input.userId,
    concluida: input.concluida,
    ocultar_de_outros_admins: false,
    cor: '#f59e0b',
    anexos: [],
    evento_id: input.eventoId,
    evento_tarefa_id: input.eventoTarefaId,
  })
  if (agendaError) throw agendaError

  const { error: linkError } = await db
    .from(tables.tarefas)
    .update({ agenda_tarefa_id: agendaId, atualizado_em: new Date().toISOString() })
    .eq('id', input.eventoTarefaId)
  if (linkError) throw linkError

  return agendaId
}
