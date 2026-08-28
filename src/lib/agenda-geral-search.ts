import { format } from 'date-fns';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';
import type { AgendaReuniao } from '@/hooks/useAgenda';
import type { LeadLembrete } from '@/hooks/useLeadLembretes';
import type { TarefaPessoal } from '@/hooks/useAgendaPessoal';
import type { MarketingTask } from '@/hooks/useMarketingTasks';
import type { PessoalAgendaEventData } from '@/components/agenda/TarefaPessoalOcorrenciaDialog';

const TYPE_LABELS: Record<AgendaEvent['type'], string> = {
  tarefa: 'agenda de tarefas reunião',
  lembrete: 'lembrete lead',
  pessoal: 'agenda pessoal',
  conteudo: 'marketing conteúdo',
};

function collectStrings(...values: (string | number | null | undefined)[]): string[] {
  return values
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
    .map((v) => String(v));
}

function getOriginalSearchFields(event: AgendaEvent): string[] {
  const data = event.originalData;
  if (!data) return [];

  switch (event.type) {
    case 'tarefa': {
      const r = data as AgendaReuniao;
      return collectStrings(
        r.titulo,
        r.descricao,
        r.observacoes,
        r.convidado_nome,
        r.convidado_whatsapp,
        r.convidado_email,
        r.resposta_formulario,
        r.status,
        r.tipo,
        String(r.duracao_minutos),
        String(r.lead_id ?? ''),
      );
    }
    case 'lembrete': {
      const l = data as LeadLembrete;
      return collectStrings(
        l.titulo,
        l.descricao,
        l.status,
        l.lead?.nome,
        l.lead?.telefone,
        l.titular?.nome,
        ...(l.titulares ?? []).map((t) => t.nome),
        format(new Date(l.data_hora), 'dd/MM/yyyy HH:mm'),
      );
    }
    case 'pessoal': {
      const p = data as PessoalAgendaEventData;
      return collectStrings(
        p.titulo,
        p.descricao,
        p.titular_nome,
        p.hora,
        p.data,
        p.tipo_agendamento,
        p.recorrencia_tipo,
      );
    }
    case 'conteudo': {
      const t = data as MarketingTask;
      return collectStrings(
        t.titulo,
        t.descricao,
        t.tipo,
        t.status,
        t.data_agendada,
        t.hora_agendada,
        t.content_card?.titulo,
        t.destinatario?.nome,
      );
    }
    default:
      return [];
  }
}

/** Texto indexável para busca na Agenda Geral (nome, valores, detalhes). */
export function getAgendaEventSearchableText(event: AgendaEvent): string {
  const timeFields = collectStrings(
    format(event.start, 'dd/MM/yyyy'),
    format(event.start, 'HH:mm'),
    format(event.end, 'HH:mm'),
    format(event.start, 'yyyy-MM-dd'),
  );

  return [
    event.title,
    event.description,
    event.status,
    TYPE_LABELS[event.type],
    event.type,
    ...timeFields,
    ...getOriginalSearchFields(event),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matchesAgendaGeralSearch(event: AgendaEvent, searchTerm: string): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;
  return getAgendaEventSearchableText(event).includes(normalized);
}
