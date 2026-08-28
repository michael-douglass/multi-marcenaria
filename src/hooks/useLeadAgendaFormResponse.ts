import { useQuery } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import type { AgendaReuniao } from '@/hooks/useAgenda';

export interface LeadAgendaFormResponse {
  reuniao: Pick<
    AgendaReuniao,
    'id' | 'titulo' | 'data_hora_inicio' | 'resposta_formulario' | 'tipo' | 'status'
  >;
  configId: string | null;
}

/**
 * Busca a reunião mais recente do lead que tenha respostas do formulário público.
 */
export function useLeadAgendaFormResponse(leadId?: number) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const agendaReunioesTable = table('agenda_reunioes', 'CRM-multi-empresas>agenda_reunioes<');
  const agendaConfigTable = table('agenda_config', 'CRM-multi-empresas>agenda_config<');

  return useQuery({
    queryKey: ['lead-agenda-form-response', schemaEmpresa ?? 'master', leadId],
    queryFn: async (): Promise<LeadAgendaFormResponse | null> => {
      if (!leadId) return null;

      const [reuniaoResult, configResult] = await Promise.all([
        db
          .from(agendaReunioesTable)
          .select('id, titulo, data_hora_inicio, resposta_formulario, tipo, status')
          .eq('lead_id', leadId)
          .not('resposta_formulario', 'is', null)
          .neq('resposta_formulario', '')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle(),
        db.from(agendaConfigTable).select('id').eq('ativo', true).maybeSingle(),
      ]);

      if (reuniaoResult.error) throw reuniaoResult.error;
      if (!reuniaoResult.data?.resposta_formulario?.trim()) return null;

      return {
        reuniao: reuniaoResult.data as LeadAgendaFormResponse['reuniao'],
        configId: (configResult.data?.id as string | undefined) ?? null,
      };
    },
    enabled: !!leadId && queriesReady,
    staleTime: 30 * 1000,
  });
}
