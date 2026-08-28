import { format, parseISO, startOfDay } from 'date-fns';
import type { LeadLembrete } from '@/hooks/useLeadLembretes';
import type { TarefaPessoal } from '@/hooks/useAgendaPessoal';
import { getOcorrenciasNoDia } from '@/lib/agenda-pessoal-recorrencia';
import { userIsTitularDoLembrete } from '@/lib/lead-lembrete-titulares';

const STORAGE_PREFIX = 'crm-agenda-reminder-dismissed:';

export type AgendaReminderNotificationKind = 'lembrete' | 'agenda_pessoal';

export interface AgendaReminderNotificationItem {
  kind: AgendaReminderNotificationKind;
  /** Chave estável para deduplicação e dismiss */
  key: string;
  titulo: string;
  descricao?: string | null;
  dueAt: Date;
  lembrete?: LeadLembrete;
  tarefa?: TarefaPessoal;
  dataOcorrencia?: string;
}

export function getLembreteNotificationKey(lembrete: LeadLembrete): string {
  return `lembrete:${lembrete.id}:${lembrete.data_hora}`;
}

export function getTarefaNotificationKey(tarefa: TarefaPessoal, dataOcorrencia: string): string {
  const horaPart = tarefa.hora ?? '00:00';
  return `tarefa:${tarefa.id}:${dataOcorrencia}:${horaPart}`;
}

export function getTarefaDueAt(tarefa: TarefaPessoal, dataOcorrencia: Date): Date {
  const base = startOfDay(dataOcorrencia);
  if (!tarefa.hora) return base;

  const [hours, minutes] = tarefa.hora.split(':').map(Number);
  const due = new Date(base);
  due.setHours(hours, minutes ?? 0, 0, 0);
  return due;
}

export function isReminderDue(dueAt: Date, now = new Date()): boolean {
  return dueAt.getTime() <= now.getTime();
}

export function wasReminderDismissed(key: string): boolean {
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${key}`) === '1';
  } catch {
    return false;
  }
}

export function markReminderDismissed(key: string): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, '1');
  } catch {
    // sessionStorage indisponível
  }
}

export function clearReminderDismissed(key: string): void {
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // sessionStorage indisponível
  }
}

/** Lembretes pendentes do titular cujo horário já passou */
export function collectDueLeadLembretes(
  lembretes: LeadLembrete[],
  userId: string,
  now = new Date(),
): AgendaReminderNotificationItem[] {
  return lembretes
    .filter(
      (l) =>
        l.status === 'pendente' &&
        userIsTitularDoLembrete(l.titular_ids, l.titular_id, userId) &&
        isReminderDue(parseISO(l.data_hora), now),
    )
    .map((lembrete) => ({
      kind: 'lembrete' as const,
      key: getLembreteNotificationKey(lembrete),
      titulo: lembrete.titulo,
      descricao: lembrete.descricao,
      dueAt: parseISO(lembrete.data_hora),
      lembrete,
    }));
}

/** Ocorrências de agenda pessoal do titular cujo horário já passou hoje */
export function collectDueAgendaPessoal(
  tarefas: TarefaPessoal[],
  userId: string,
  now = new Date(),
): AgendaReminderNotificationItem[] {
  const hoje = startOfDay(now);
  const ocorrencias = getOcorrenciasNoDia(tarefas, hoje).filter(
    (o) => !o.concluida && o.tarefa.titular_id === userId,
  );

  const items: AgendaReminderNotificationItem[] = [];

  for (const o of ocorrencias) {
    const dataOcorrencia = format(o.dataOcorrencia, 'yyyy-MM-dd');
    const dueAt = getTarefaDueAt(o.tarefa, o.dataOcorrencia);
    if (!isReminderDue(dueAt, now)) continue;

    items.push({
      kind: 'agenda_pessoal',
      key: getTarefaNotificationKey(o.tarefa, dataOcorrencia),
      titulo: o.tarefa.titulo,
      descricao: o.tarefa.descricao,
      dueAt,
      tarefa: o.tarefa,
      dataOcorrencia,
    });
  }

  return items;
}

export function mergeDueReminders(
  lembretes: LeadLembrete[],
  tarefas: TarefaPessoal[],
  userId: string,
  now = new Date(),
): AgendaReminderNotificationItem[] {
  const all = [
    ...collectDueLeadLembretes(lembretes, userId, now),
    ...collectDueAgendaPessoal(tarefas, userId, now),
  ];

  const seen = new Set<string>();
  return all
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return !wasReminderDismissed(item.key);
    })
    .sort((a, b) => {
      // Agenda pessoal sempre no topo; lembretes de lead abaixo (cada grupo por horário).
      const kindRank = (kind: AgendaReminderNotificationKind) =>
        kind === 'agenda_pessoal' ? 0 : 1;
      const byKind = kindRank(a.kind) - kindRank(b.kind);
      if (byKind !== 0) return byKind;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });
}
