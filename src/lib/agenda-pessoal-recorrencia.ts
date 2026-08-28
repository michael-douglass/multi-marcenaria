import { eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isAfter, isBefore, startOfDay, format } from 'date-fns';
import type { TarefaPessoal } from '@/hooks/useAgendaPessoal';

export interface OcorrenciaTarefa {
  tarefa: TarefaPessoal;
  dataOcorrencia: Date;
  concluida: boolean;
}

/**
 * Check if a specific occurrence date is concluded
 */
export function isOcorrenciaConcluida(tarefa: TarefaPessoal, dataOcorrencia: Date): boolean {
  if (tarefa.tipo_agendamento === 'unica') {
    return tarefa.concluida;
  }
  const dateStr = format(dataOcorrencia, 'yyyy-MM-dd');
  const conclusoes = (tarefa.conclusoes_ocorrencias as string[] | null) || [];
  return conclusoes.includes(dateStr);
}

/**
 * Check if a specific occurrence date is excluded
 */
function isOcorrenciaExcluida(tarefa: TarefaPessoal, dataOcorrencia: Date): boolean {
  const dateStr = format(dataOcorrencia, 'yyyy-MM-dd');
  const exclusoes = (tarefa.exclusoes_ocorrencias as string[] | null) || [];
  return exclusoes.includes(dateStr);
}

/**
 * Get the day of week (0=Sun, 6=Sat) for a date
 */
function getDiaSemana(date: Date): number {
  return date.getDay();
}

/**
 * Expand a task into occurrences within a date interval
 */
/**
 * Parse a 'yyyy-MM-dd' string as local midnight (avoids UTC shift issues)
 */
function parseLocalDate(dateStr: string): Date {
  return startOfDay(new Date(dateStr + 'T00:00:00'));
}

export function getOcorrenciasNoIntervalo(
  tarefa: TarefaPessoal,
  inicio: Date,
  fim: Date
): OcorrenciaTarefa[] {
  const ocorrencias: OcorrenciaTarefa[] = [];
  const dataRef = parseLocalDate(tarefa.data);

  if (tarefa.tipo_agendamento === 'unica') {
    if (
      (isSameDay(dataRef, inicio) || isAfter(dataRef, inicio)) &&
      (isSameDay(dataRef, fim) || isBefore(dataRef, fim))
    ) {
      ocorrencias.push({
        tarefa,
        dataOcorrencia: dataRef,
        concluida: tarefa.concluida,
      });
    }
    return ocorrencias;
  }

  // Recorrente
  const diasSemana = (tarefa.recorrencia_dias_semana as number[] | null) || [];
  const dataFimRecorrencia = tarefa.data_fim_recorrencia
    ? parseLocalDate(tarefa.data_fim_recorrencia)
    : null;
  /** Dia do mês da data de início — usado em recorrência mensal (ex.: 10 → todo dia 10). */
  const diaDoMes = dataRef.getDate();

  const intervalStart = isAfter(inicio, dataRef) ? inicio : dataRef;
  const intervalEnd = dataFimRecorrencia && isBefore(dataFimRecorrencia, fim)
    ? dataFimRecorrencia
    : fim;

  if (isAfter(intervalStart, intervalEnd)) return ocorrencias;

  const days = eachDayOfInterval({ start: intervalStart, end: intervalEnd });

  for (const day of days) {
    // Check if excluded
    if (isOcorrenciaExcluida(tarefa, day)) continue;

    if (tarefa.recorrencia_tipo === 'dias_semana') {
      if (!diasSemana.includes(getDiaSemana(day))) continue;
    } else if (tarefa.recorrencia_tipo === 'mensal') {
      // Meses sem esse dia (ex.: 31 em fevereiro) não geram ocorrência
      if (day.getDate() !== diaDoMes) continue;
    }
    // 'todo_dia' matches every day

    ocorrencias.push({
      tarefa,
      dataOcorrencia: day,
      concluida: isOcorrenciaConcluida(tarefa, day),
    });
  }

  return ocorrencias;
}

/** Rótulo curto para badges/listagens (Diária / Semanal / Mensal). */
export function getRecorrenciaTipoLabel(recorrenciaTipo: string | null | undefined): string {
  if (recorrenciaTipo === 'todo_dia') return 'Diária';
  if (recorrenciaTipo === 'mensal') return 'Mensal';
  if (recorrenciaTipo === 'dias_semana') return 'Semanal';
  return 'Recorrente';
}

/** Resumo legível da recorrência (ex.: "Todo dia 10"). */
export function formatRecorrenciaResumo(
  tarefa: Pick<TarefaPessoal, 'tipo_agendamento' | 'recorrencia_tipo' | 'recorrencia_dias_semana' | 'data'>,
  diasSemanaLabels: string[] = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
): string {
  if (tarefa.tipo_agendamento !== 'recorrente') return 'Única';
  if (tarefa.recorrencia_tipo === 'todo_dia') return 'Todo dia';
  if (tarefa.recorrencia_tipo === 'mensal') {
    const dia = parseLocalDate(tarefa.data).getDate();
    return `Todo dia ${dia}`;
  }
  const dias = (tarefa.recorrencia_dias_semana as number[] | null) || [];
  if (dias.length === 0) return 'Semanal';
  return dias.map((d) => diasSemanaLabels[d]).join(', ');
}

/**
 * Get all occurrences for a specific month
 */
export function getOcorrenciasNoMes(
  tarefas: TarefaPessoal[],
  month: Date
): OcorrenciaTarefa[] {
  const inicio = startOfMonth(month);
  const fim = endOfMonth(month);

  return tarefas.flatMap((t) => getOcorrenciasNoIntervalo(t, inicio, fim));
}

/**
 * Get occurrences for a specific day
 */
export function getOcorrenciasNoDia(
  tarefas: TarefaPessoal[],
  dia: Date
): OcorrenciaTarefa[] {
  return tarefas.flatMap((t) => getOcorrenciasNoIntervalo(t, dia, dia));
}
