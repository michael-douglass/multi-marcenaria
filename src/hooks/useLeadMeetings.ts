import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadMeeting {
  id: string;
  titulo: string;
  data_hora_inicio: string;
  status: string;
}

const LEAD_MEETINGS_BATCH_SIZE = 200;

/**
 * Hook para buscar reuniões vinculadas a um lead
 * Usado para exibir badge de "Reunião Marcada" no KanbanCard
 */
export function useLeadMeeting(leadId: number | undefined) {
  return useQuery({
    queryKey: ['lead-meeting', leadId],
    queryFn: async () => {
      if (!leadId) return null;

      const { data, error } = await supabase
        .from('CRM-multi-empresas>agenda_reunioes<')
        .select('id, titulo, data_hora_inicio, status')
        .eq('lead_id', leadId)
        .in('status', ['pendente', 'confirmado'])
        .order('data_hora_inicio', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar reunião do lead:', error);
        return null;
      }

      return data as LeadMeeting | null;
    },
    enabled: !!leadId,
    staleTime: 30 * 1000, // 30 segundos
  });
}

/**
 * Hook para buscar todas as reuniões ativas de múltiplos leads de uma vez
 * Otimizado para uso no Pipeline/Kanban
 */
export function useLeadsMeetings(leadIds: number[]) {
  return useQuery({
    queryKey: ['leads-meetings', leadIds],
    queryFn: async () => {
      if (!leadIds.length) return new Map<number, LeadMeeting>();

      // Buscar reuniões em lotes para evitar URLs gigantes (erro 400 no PostgREST)
      let allMeetings: any[] = [];

      for (let i = 0; i < leadIds.length; i += LEAD_MEETINGS_BATCH_SIZE) {
        const batchIds = leadIds.slice(i, i + LEAD_MEETINGS_BATCH_SIZE);

        const { data: batchData, error: batchError } = await supabase
          .from('CRM-multi-empresas>agenda_reunioes<')
          .select('id, titulo, data_hora_inicio, status, lead_id')
          .in('lead_id', batchIds)
          .in('status', ['pendente', 'confirmado'])
          .order('data_hora_inicio', { ascending: true });

        if (batchError) {
          console.error('Erro ao buscar reuniões dos leads (lote):', {
            error: batchError,
            batchStart: i,
            batchSize: LEAD_MEETINGS_BATCH_SIZE,
          });
          // Continua para os próximos lotes mesmo que um falhe
          continue;
        }

        if (batchData && batchData.length > 0) {
          allMeetings = allMeetings.concat(batchData);
        }
      }

      // Criar Map com apenas a próxima reunião de cada lead
      const meetingsMap = new Map<number, LeadMeeting>();
      for (const meeting of allMeetings || []) {
        if (meeting.lead_id && !meetingsMap.has(meeting.lead_id)) {
          meetingsMap.set(meeting.lead_id, {
            id: meeting.id,
            titulo: meeting.titulo,
            data_hora_inicio: meeting.data_hora_inicio,
            status: meeting.status,
          });
        }
      }

      return meetingsMap;
    },
    enabled: leadIds.length > 0,
    staleTime: 30 * 1000,
  });
}

export type LeadsMeetingsMap = Map<number, LeadMeeting>;

/** Cache do React Query pode desserializar Map como objeto plano — reconverte aqui. */
export function normalizeLeadsMeetingsMap(
  raw: LeadsMeetingsMap | Record<string, LeadMeeting> | undefined | null,
): LeadsMeetingsMap {
  if (raw instanceof Map) return raw;
  if (raw && typeof raw === 'object') {
    return new Map(Object.entries(raw).map(([k, v]) => [Number(k), v]));
  }
  return new Map();
}

/** Igual a useLeadsMeetings, mas sempre retorna um Map válido (`.has`, `.get`, etc.). */
export function useLeadsMeetingsMap(leadIds: number[]) {
  const query = useLeadsMeetings(leadIds);
  const data = useMemo(() => normalizeLeadsMeetingsMap(query.data), [query.data]);
  return { ...query, data };
}
