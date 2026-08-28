import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ClipboardList, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FormResponseFieldsList } from '@/components/agenda/FormResponseFieldsList';
import { FormResponseFilePreview } from '@/components/agenda/FormResponseFilePreview';
import { SelectLeadDialog } from '@/components/agenda/SelectLeadDialog';
import { useLeadAgendaFormResponse } from '@/hooks/useLeadAgendaFormResponse';
import { useReassignLeadAgendaForm } from '@/hooks/useReassignLeadAgendaForm';
import { useAgendaFormFields } from '@/hooks/useAgendaFormFields';
import type { FormField } from '@/hooks/useAgendaFormFields';
import {
  filterCustomFormFields,
  formatFormResponseValue,
  parseRespostaFormulario,
} from '@/lib/agenda-form-field-utils';
import { parseAgendaFormUploadFieldValue } from '@/lib/agenda-form-uploads';

interface LeadFormResponseSectionProps {
  leadId: number;
  readOnly?: boolean;
}

type FormSectionItem =
  | {
      kind: 'text';
      field: FormField;
      formattedValue: string;
    }
  | {
      kind: 'file';
      field: FormField;
      raw: string;
    };

/** Exibe respostas do formulário de agendamento vinculado ao lead, na ordem do formulário. */
export function LeadFormResponseSection({ leadId, readOnly = false }: LeadFormResponseSectionProps) {
  const [vincularOpen, setVincularOpen] = useState(false);
  const { data, isLoading } = useLeadAgendaFormResponse(leadId);
  const { fields: formFieldDefs } = useAgendaFormFields(data?.configId ?? undefined);
  const reassignForm = useReassignLeadAgendaForm();

  const resposta = data?.reuniao.resposta_formulario ?? null;

  const sectionItems = useMemo((): FormSectionItem[] => {
    if (!resposta) return [];

    const parsed = parseRespostaFormulario(resposta);

    return filterCustomFormFields(formFieldDefs)
      .filter((field) => field.visible !== false)
      .sort((a, b) => a.ordem - b.ordem)
      .map((field): FormSectionItem | null => {
        const raw = parsed[field.field_key];
        if (!raw?.trim()) return null;

        if (field.field_type === 'file') {
          const files = parseAgendaFormUploadFieldValue(raw);
          if (files.length === 0) return null;
          return { kind: 'file', field, raw };
        }

        return {
          kind: 'text',
          field,
          formattedValue: formatFormResponseValue(raw),
        };
      })
      .filter((item): item is FormSectionItem => item !== null);
  }, [resposta, formFieldDefs]);

  if (isLoading) {
    return (
      <Card className="border-sky-500/35 bg-sky-500/5 shadow-none">
        <CardHeader className="py-3 px-4 space-y-0">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || sectionItems.length === 0) return null;

  const dataReuniao = parseISO(data.reuniao.data_hora_inicio);

  const handleVincularOutroLead = (lead: { id: number; nome: string }) => {
    if (lead.id === leadId) {
      toast.error('Selecione um lead diferente do atual.');
      return;
    }

    reassignForm.mutate({
      reuniaoId: data.reuniao.id,
      fromLeadId: leadId,
      toLeadId: lead.id,
      respostaFormulario: data.reuniao.resposta_formulario,
    });
  };

  return (
    <>
    <Card className="border-sky-500/35 bg-sky-500/5 shadow-none">
      <CardHeader className="py-3 px-4 flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 min-w-0">
          <ClipboardList className="h-4 w-4 text-sky-600 shrink-0" />
          <span className="truncate">Formulário preenchido</span>
        </CardTitle>
        <div className="flex items-center gap-1.5 shrink-0">
          {data.reuniao.tipo === 'publico' && (
            <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-800">
              Agendamento público
            </Badge>
          )}
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px] border-sky-500/40 text-sky-800 hover:bg-sky-500/10"
              onClick={() => setVincularOpen(true)}
              disabled={reassignForm.isPending}
            >
              {reassignForm.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2 className="h-3 w-3" />
              )}
              Outro lead
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {data.reuniao.titulo} —{' '}
            {format(dataReuniao, "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        <div className="space-y-4">
          {sectionItems.map((item) => (
            <div key={item.field.field_key} className="space-y-2">
              <p className="text-xs font-semibold text-foreground">{item.field.field_label}</p>
              {item.kind === 'text' ? (
                <FormResponseFieldsList
                  items={[
                    {
                      key: item.field.field_key,
                      label: item.field.field_label,
                      value: '',
                      formattedValue: item.formattedValue,
                    },
                  ]}
                  hideLabels
                  emptyMessage=""
                />
              ) : (
                <FormResponseFilePreview raw={item.raw} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    <SelectLeadDialog
      open={vincularOpen}
      onOpenChange={setVincularOpen}
      onSelect={handleVincularOutroLead}
      title="Vincular formulário a outro lead"
      description="O agendamento e os anexos do formulário serão movidos para o lead selecionado."
    />
    </>
  );
}
