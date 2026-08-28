import { useMemo } from 'react';
import type { LeadPDF } from '@/hooks/useLeadPDFs';
import { useLeadAgendaFormResponse } from '@/hooks/useLeadAgendaFormResponse';
import { useAgendaFormFields } from '@/hooks/useAgendaFormFields';
import { buildLeadFormUploadAttachments } from '@/lib/lead-form-upload-attachments';

/**
 * Converte uploads do formulário de agendamento em anexos virtuais do lead,
 * para exibição em Materiais e galeria da Análise IA.
 */
export function useLeadFormUploadAttachments(leadId: number | null | undefined): {
  formUploadAttachments: LeadPDF[];
  isLoading: boolean;
} {
  const { data, isLoading: responseLoading } = useLeadAgendaFormResponse(leadId ?? undefined);
  const { fields: formFieldDefs, isLoading: fieldsLoading } = useAgendaFormFields(
    data?.configId ?? undefined,
  );

  const formUploadAttachments = useMemo((): LeadPDF[] => {
    if (!leadId || !data?.reuniao.resposta_formulario?.trim()) return [];

    return buildLeadFormUploadAttachments({
      leadId,
      reuniaoId: data.reuniao.id,
      respostaFormulario: data.reuniao.resposta_formulario,
      criado_em: data.reuniao.data_hora_inicio,
      formFieldDefs,
    });
  }, [leadId, data, formFieldDefs]);

  return {
    formUploadAttachments,
    // Não bloqueia a galeria: anexos do formulário entram quando os campos carregarem.
    isLoading: responseLoading,
    isFieldsLoading: !!data?.configId && fieldsLoading,
  };
}
