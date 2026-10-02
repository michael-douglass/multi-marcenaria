import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'crm_multiempresas_agenda_pessoal_tarefas';

export interface UnicaSlotKey {
  titularId: string;
  titulo: string;
  data: string;
  hora: string | null | undefined;
}

function normalizeHora(hora: string | null | undefined): string | null {
  const trimmed = hora?.trim() || '';
  return trimmed || null;
}

/**
 * Busca outra tarefa única aberta no mesmo “slot”
 * (mesmo titular + título + dia + horário).
 */
export async function findOpenUnicaTwin(
  db: SupabaseClient,
  key: UnicaSlotKey,
  exceptId?: string,
): Promise<string | null> {
  const hora = normalizeHora(key.hora);
  let q = db
    .from(TABLE)
    .select('id')
    .eq('tipo_agendamento', 'unica')
    .eq('titular_id', key.titularId)
    .eq('titulo', key.titulo)
    .eq('data', key.data)
    .eq('concluida', false)
    .order('criado_em', { ascending: true });

  if (hora == null) {
    q = q.or('hora.is.null,hora.eq.');
  } else {
    q = q.eq('hora', hora);
  }

  if (exceptId) {
    q = q.neq('id', exceptId);
  }

  const { data, error } = await q.limit(1).maybeSingle();
  if (error) {
    console.warn('[agenda-pessoal-dedupe] falha ao buscar gêmea:', error.message);
    return null;
  }
  return typeof data?.id === 'string' ? data.id : null;
}

/**
 * Remove cópias abertas do mesmo slot, mantendo `keepId`.
 * Usado após mover/reagendar para não empilhar a mesma tarefa no dia.
 */
export async function deleteOpenUnicaTwinsExcept(
  db: SupabaseClient,
  key: UnicaSlotKey,
  keepId: string,
): Promise<number> {
  const hora = normalizeHora(key.hora);
  let q = db
    .from(TABLE)
    .select('id')
    .eq('tipo_agendamento', 'unica')
    .eq('titular_id', key.titularId)
    .eq('titulo', key.titulo)
    .eq('data', key.data)
    .eq('concluida', false)
    .neq('id', keepId);

  if (hora == null) {
    q = q.or('hora.is.null,hora.eq.');
  } else {
    q = q.eq('hora', hora);
  }

  const { data, error } = await q;
  if (error) {
    console.warn('[agenda-pessoal-dedupe] falha ao listar gêmeas:', error.message);
    return 0;
  }

  const ids = (data || [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string');

  if (ids.length === 0) return 0;

  const { error: deleteError } = await db.from(TABLE).delete().in('id', ids);
  if (deleteError) {
    console.warn('[agenda-pessoal-dedupe] falha ao apagar gêmeas:', deleteError.message);
    return 0;
  }
  return ids.length;
}
