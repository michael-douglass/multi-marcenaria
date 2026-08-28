import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import { extractAgendaFormUploads } from '@/lib/agenda-form-uploads';

interface ReassignLeadAgendaFormInput {
  reuniaoId: string;
  fromLeadId: number;
  toLeadId: number;
  respostaFormulario: string | null;
}

/** Move o agendamento com formulário preenchido para outro lead do pipeline. */
export function useReassignLeadAgendaForm() {
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const agendaReunioesTable = table('agenda_reunioes', 'CRM-multi-empresas>agenda_reunioes<');
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);

  return useMutation({
    mutationFn: async ({
      reuniaoId,
      fromLeadId,
      toLeadId,
      respostaFormulario,
    }: ReassignLeadAgendaFormInput) => {
      const { error: reuniaoError } = await db
        .from(agendaReunioesTable)
        .update({
          lead_id: toLeadId,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', reuniaoId);

      if (reuniaoError) throw reuniaoError;

      const uploadUrls = extractAgendaFormUploads(respostaFormulario).map((u) => u.url);
      if (uploadUrls.length > 0) {
        const { error: mediasError } = await db
          .from(mediasConfig.mediasTable as 'marketing_medias')
          .update({ lead_id: toLeadId })
          .eq('lead_id', fromLeadId)
          .in('file_url', uploadUrls);

        if (mediasError) {
          console.error('Erro ao mover anexos do formulário:', mediasError);
        }
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['lead-agenda-form-response'] });
      qc.invalidateQueries({ queryKey: ['agenda-reunioes'] });
      qc.invalidateQueries({
        queryKey: ['lead-midias-para-orcamento', schemaEmpresa, variables.fromLeadId],
      });
      qc.invalidateQueries({
        queryKey: ['lead-midias-para-orcamento', schemaEmpresa, variables.toLeadId],
      });
      qc.invalidateQueries({ queryKey: ['marketing-medias'] });
      toast.success('Formulário vinculado ao outro lead!');
    },
    onError: (error) => {
      console.error('Erro ao vincular formulário ao lead:', error);
      toast.error('Não foi possível vincular o formulário ao outro lead.');
    },
  });
}
