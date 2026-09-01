import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAgendaPublic } from '@/hooks/useAgenda';
import { useAgendaFormFieldsPublic, FormField } from '@/hooks/useAgendaFormFields';
import {
  resolveConvidadoFromForm,
  parseMultiSelectFormValue,
  serializeMultiSelectFormValue,
  hasMultiSelectSelection,
  filterCustomFormFields,
  NATIVE_PUBLIC_LEAD_FIELDS,
} from '@/lib/agenda-form-field-utils';
import { buildAgendaMetadataCapturada } from '@/lib/agenda-metadata-capture';
import { uploadAgendaPublicFiles } from '@/lib/agenda-public-api';
import { buildAcceptFromCategories, validateAgendaFile } from '@/lib/agenda-file-types';
import { preprocessAgendaFormFiles } from '@/lib/agenda-form-file-preprocess';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { serializeAgendaFormUploadFieldValue } from '@/lib/agenda-form-uploads';
import { AgendamentoPublicoLayout } from '@/components/agenda/AgendamentoPublicoLayout';
import {
  PUBLIC_DATE_BTN,
  PUBLIC_DATE_BTN_SELECTED,
  PUBLIC_FILE_ITEM,
  PUBLIC_FILE_ZONE,
  PUBLIC_FORM_FIELD,
  PUBLIC_FORM_GROUP,
  PUBLIC_FORM_HINT,
  PUBLIC_FORM_LABEL,
  PUBLIC_OPTION_CARD,
  PUBLIC_OPTION_CARD_SELECTED,
  PUBLIC_PRIMARY_BTN,
  PUBLIC_STEP_DESC,
  PUBLIC_STEP_HEADER,
  PUBLIC_STEP_TITLE,
  PUBLIC_TIME_BTN,
  PUBLIC_TIME_BTN_SELECTED,
} from '@/lib/agendamento-publico-theme';

function fileIdentity(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function mergeSelectedFiles(existing: File[], incoming: File[]): File[] {
  const map = new Map<string, File>();
  for (const file of [...existing, ...incoming]) {
    map.set(fileIdentity(file), file);
  }
  return Array.from(map.values());
}

// Schema dinâmico: campos fixos de lead + perguntas configuradas
function createDynamicSchema(customFields: FormField[]) {
  const schemaShape: Record<string, z.ZodTypeAny> = {
    [NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key]: z
      .string()
      .trim()
      .min(1, 'Informe seu nome'),
    [NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key]: z
      .string()
      .trim()
      .min(1, 'Informe seu telefone')
      .min(10, 'Telefone inválido'),
  };

  customFields.forEach((field) => {
    if (field.field_type === 'file') return;

    let fieldSchema: z.ZodTypeAny;

    switch (field.field_type) {
      case 'email':
        fieldSchema = z.string().trim();
        if (field.required) {
          fieldSchema = z.string().trim().min(1, 'Campo obrigatório').email('E-mail inválido');
        }
        break;
      case 'tel':
        fieldSchema = z.string().trim();
        if (field.required) {
          fieldSchema = z.string().trim().min(1, 'Campo obrigatório').min(10, 'Telefone inválido');
        }
        break;
      case 'number':
        fieldSchema = z.string().trim();
        if (field.required) {
          fieldSchema = z.string().trim().min(1, 'Campo obrigatório');
        }
        break;
      case 'select':
        fieldSchema = z.string();
        if (field.required) {
          fieldSchema = fieldSchema.refine(
            (val) => hasMultiSelectSelection(val),
            'Selecione pelo menos uma opção',
          );
        }
        break;
      case 'textarea':
        fieldSchema = z.string().trim();
        if (field.required) {
          fieldSchema = z.string().trim().min(1, 'Campo obrigatório');
        }
        break;
      case 'date':
        fieldSchema = z.string().trim();
        if (field.required) {
          fieldSchema = z.string().trim().min(1, 'Informe a data');
        }
        break;
      default:
        fieldSchema = z.string().trim();
        if (field.required) {
          fieldSchema = z.string().trim().min(1, 'Campo obrigatório');
        }
    }

    schemaShape[field.field_key] = field.required ? fieldSchema : fieldSchema.optional();
  });

  return z.object(schemaShape);
}

type PublicBookingFormProps = {
  fields: FormField[];
  submitting: boolean;
  submitLabel?: string;
  onSubmit: (
    data: Record<string, string>,
    files: Record<string, File[]>,
  ) => void | Promise<void>;
};

function PublicBookingForm({
  fields,
  submitting,
  submitLabel = 'Confirmar Agendamento',
  onSubmit,
}: PublicBookingFormProps) {
  const customFields = useMemo(() => filterCustomFormFields(fields), [fields]);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [processingFileField, setProcessingFileField] = useState<string | null>(null);
  const schema = useMemo(() => createDynamicSchema(customFields), [customFields]);

  const defaultValues = useMemo(() => {
    const values: Record<string, string> = {
      [NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key]: '',
      [NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key]: '',
    };
    customFields.forEach((field) => {
      if (field.field_type === 'file') return;
      values[field.field_key] = field.field_type === 'select' ? '[]' : '';
    });
    return values;
  }, [customFields]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onSubmit',
  });

  const renderInput = (field: FormField) => {
    const error = errors[field.field_key];
    const errorMessage = error?.message as string | undefined;

    if (field.field_type === 'textarea') {
      return (
        <div key={field.id} className={PUBLIC_FORM_GROUP}>
          <Label htmlFor={field.field_key} className={cn(PUBLIC_FORM_LABEL, error && 'text-destructive')}>
            {field.field_label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Textarea
            id={field.field_key}
            placeholder={field.placeholder || undefined}
            rows={3}
            {...register(field.field_key)}
            className={cn(PUBLIC_FORM_FIELD, error && 'border-destructive focus-visible:ring-destructive')}
          />
          {errorMessage && <p className="text-xs font-medium text-destructive">{errorMessage}</p>}
        </div>
      );
    }

    if (field.field_type === 'file') {
      const selectedFiles = files[field.field_key] ?? [];
      const isProcessingFiles = processingFileField === field.field_key;

      const addFiles = async (picked: File[]) => {
        if (picked.length === 0) return;
        for (const file of picked) {
          const validationError = validateAgendaFile(file, field.options);
          if (validationError) {
            toast.error(`${file.name}: ${validationError}`);
            return;
          }
        }
        setProcessingFileField(field.field_key);
        try {
          const processed = await preprocessAgendaFormFiles(picked);
          setFiles((prev) => ({
            ...prev,
            [field.field_key]: mergeSelectedFiles(prev[field.field_key] ?? [], processed),
          }));
          const pdfCount = picked.filter((file) => file.type === 'application/pdf').length;
          if (pdfCount > 0) {
            toast.success(
              pdfCount === 1
                ? 'PDF convertido em imagens e adicionado à lista.'
                : `${pdfCount} PDFs convertidos em imagens.`,
            );
          }
        } catch (error) {
          console.error('Erro ao processar arquivos:', error);
          toast.error('Não foi possível processar o PDF. Verifique o arquivo e tente novamente.');
        } finally {
          setProcessingFileField(null);
        }
      };

      const removeFile = (target: File) => {
        setFiles((prev) => ({
          ...prev,
          [field.field_key]: (prev[field.field_key] ?? []).filter(
            (file) => fileIdentity(file) !== fileIdentity(target),
          ),
        }));
      };

      return (
        <div key={field.id} className={PUBLIC_FORM_GROUP}>
          <Label htmlFor={field.field_key} className={cn(PUBLIC_FORM_LABEL, error && 'text-destructive')}>
            {field.field_label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className={PUBLIC_FILE_ZONE}>
            <div className={cn('flex items-center gap-2 text-sm', PUBLIC_FORM_HINT)}>
              <Paperclip className="h-4 w-4 shrink-0 text-[#c45c26]" />
              <span>
                Fotos, vídeos (qualquer tamanho) ou PDF. PDFs viram imagens automaticamente — você pode
                selecionar vários arquivos.
              </span>
            </div>
            <Input
              id={field.field_key}
              type="file"
              multiple
              accept={buildAcceptFromCategories(field.options)}
              disabled={isProcessingFiles}
              className={cn(PUBLIC_FORM_FIELD, 'border-dashed bg-white')}
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                event.target.value = '';
                void addFiles(picked);
              }}
            />
            {isProcessingFiles && (
              <p className={cn(PUBLIC_FORM_HINT, 'flex items-center gap-2 text-[#1a100c]')}>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c45c26]" />
                Convertendo PDF em imagens...
              </p>
            )}
            {selectedFiles.length > 0 && (
              <ul className="space-y-1.5">
                {selectedFiles.map((file) => (
                  <li key={fileIdentity(file)} className={PUBLIC_FILE_ITEM}>
                    <span className="truncate font-medium">
                      {file.name}{' '}
                      <span className="text-[#4a3228]">({formatFileSize(file.size)})</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-[#8a3a18] hover:text-destructive hover:bg-[#fff0eb]"
                      onClick={() => removeFile(file)}
                      aria-label={`Remover ${file.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errorMessage && <p className="text-xs font-medium text-destructive">{errorMessage}</p>}
        </div>
      );
    }

    if (field.field_type === 'select' && field.options && field.options.length > 0) {
      const rawValue = watch(field.field_key);
      const selectedOptions = parseMultiSelectFormValue(rawValue);

      const toggleOption = (option: string, checked: boolean) => {
        const next = checked
          ? [...new Set([...selectedOptions, option])]
          : selectedOptions.filter((item) => item !== option);
        setValue(field.field_key, serializeMultiSelectFormValue(next), {
          shouldValidate: true,
          shouldDirty: true,
        });
      };

      return (
        <div key={field.id} className={PUBLIC_FORM_GROUP}>
          <Label className={cn(PUBLIC_FORM_LABEL, error && 'text-destructive')}>
            {field.field_label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <p className={PUBLIC_FORM_HINT}>Você pode marcar mais de uma opção.</p>
          <div className="space-y-2">
            {field.options.map((option) => {
              const checked = selectedOptions.includes(option);
              const optionId = `${field.field_key}-${option}`;
              return (
                <label
                  key={option}
                  htmlFor={optionId}
                  className={cn(
                    PUBLIC_OPTION_CARD,
                    checked && PUBLIC_OPTION_CARD_SELECTED,
                  )}
                >
                  <Checkbox
                    id={optionId}
                    checked={checked}
                    onCheckedChange={(state) => toggleOption(option, state === true)}
                    className="border-[#8a6b5a] shadow-sm data-[state=checked]:bg-[#c45c26] data-[state=checked]:border-[#c45c26]"
                  />
                  <span className="text-sm font-semibold text-[#1a100c]">{option}</span>
                </label>
              );
            })}
          </div>
          <input type="hidden" {...register(field.field_key)} />
          {errorMessage && <p className="text-xs font-medium text-destructive">{errorMessage}</p>}
        </div>
      );
    }

    const getInputType = () => {
      switch (field.field_type) {
        case 'email':
          return 'email';
        case 'tel':
          return 'tel';
        case 'number':
          return 'text';
        case 'date':
          return 'date';
        default:
          return 'text';
      }
    };

    const getInputMode = (): 'text' | 'email' | 'tel' | 'numeric' | undefined => {
      switch (field.field_type) {
        case 'email':
          return 'email';
        case 'tel':
          return 'tel';
        case 'number':
          return 'numeric';
        case 'date':
          return undefined;
        default:
          return 'text';
      }
    };

    return (
      <div key={field.id} className={PUBLIC_FORM_GROUP}>
        <Label htmlFor={field.field_key} className={cn(PUBLIC_FORM_LABEL, error && 'text-destructive')}>
          {field.field_label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={field.field_key}
          type={getInputType()}
          inputMode={getInputMode()}
          placeholder={field.placeholder || undefined}
          autoComplete="off"
          {...register(field.field_key)}
          className={cn(PUBLIC_FORM_FIELD, error && 'border-destructive focus-visible:ring-destructive')}
        />
        {errorMessage && <p className="text-xs font-medium text-destructive">{errorMessage}</p>}
      </div>
    );
  };

  const handleFormSubmit = handleSubmit(
    (data) => {
      for (const field of customFields) {
        if (field.field_type !== 'file') continue;
        const fieldFiles = files[field.field_key] ?? [];
        if (field.required && fieldFiles.length === 0) {
          toast.error(`Envie pelo menos um arquivo: ${field.field_label}`);
          return;
        }
        for (const file of fieldFiles) {
          const validationError = validateAgendaFile(file, field.options);
          if (validationError) {
            toast.error(`${file.name}: ${validationError}`);
            return;
          }
        }
      }
      void onSubmit(data, files);
    },
    () => toast.error('Preencha os campos obrigatórios.'),
  );

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      <div className={PUBLIC_FORM_GROUP}>
        <Label htmlFor={NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key} className={PUBLIC_FORM_LABEL}>
          {NATIVE_PUBLIC_LEAD_FIELDS.nome.field_label}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          id={NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key}
          type="text"
          inputMode="text"
          placeholder={NATIVE_PUBLIC_LEAD_FIELDS.nome.placeholder}
          autoComplete="name"
          {...register(NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key)}
          className={cn(
            PUBLIC_FORM_FIELD,
            errors[NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key] &&
              'border-destructive focus-visible:ring-destructive',
          )}
        />
        {errors[NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key]?.message && (
          <p className="text-xs font-medium text-destructive">
            {String(errors[NATIVE_PUBLIC_LEAD_FIELDS.nome.field_key]?.message)}
          </p>
        )}
      </div>

      <div className={PUBLIC_FORM_GROUP}>
        <Label htmlFor={NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key} className={PUBLIC_FORM_LABEL}>
          {NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_label}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          id={NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key}
          type="tel"
          inputMode="tel"
          placeholder={NATIVE_PUBLIC_LEAD_FIELDS.telefone.placeholder}
          autoComplete="tel"
          {...register(NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key)}
          className={cn(
            PUBLIC_FORM_FIELD,
            errors[NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key] &&
              'border-destructive focus-visible:ring-destructive',
          )}
        />
        {errors[NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key]?.message && (
          <p className="text-xs font-medium text-destructive">
            {String(errors[NATIVE_PUBLIC_LEAD_FIELDS.telefone.field_key]?.message)}
          </p>
        )}
      </div>

      {customFields.length > 0 && (
        <div className="pt-1">
          <p className={cn(PUBLIC_FORM_HINT, 'mb-4 font-semibold text-[#1a100c]')}>
            Informações adicionais
          </p>
          <div className="space-y-5">
            {customFields.map((field) => renderInput(field))}
          </div>
        </div>
      )}

      <Button
        type="submit"
        className={PUBLIC_PRIMARY_BTN}
        disabled={submitting || processingFileField !== null}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {submitLabel === 'Continuar' ? 'Validando...' : 'Agendando...'}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}

export default function AgendamentoPublico() {
  const { slug, empresaSlug } = useParams<{ slug?: string; empresaSlug?: string }>();
  const agendaSlug = slug || 'agendamento';

  const { config, scope, loading: loadingConfig, createAgendamento, getSlotsDisponiveis } = useAgendaPublic(
    agendaSlug,
    empresaSlug,
  );

  const { fields, isLoading: loadingFields, isError: fieldsError } = useAgendaFormFieldsPublic(config?.id, scope);

  const [step, setStep] = useState<'date' | 'time' | 'form' | 'success'>('form');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [pendingFormData, setPendingFormData] = useState<Record<string, string> | null>(null);
  const [pendingFormFiles, setPendingFormFiles] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  // Assinatura dos campos para forçar remontagem segura do formulário quando o backend muda a configuração
  const formKey = useMemo(() => {
    const signature = fields
      .map((f) => `${f.id}:${f.field_key}:${f.required}:${f.visible}:${f.field_type}`)
      .join('|');
    return `${signature}`;
  }, [fields]);

  // Gerar dias disponíveis (próximos X dias)
  const today = startOfDay(new Date());
  const maxDate = addDays(today, config?.antecedencia_maxima_dias || 30);
  
  const diasDisponiveis: Date[] = useMemo(() => {
    const dias: Date[] = [];
    let currentDate = new Date(today);
    while (currentDate <= maxDate) {
      if (config?.dias_disponiveis.includes(currentDate.getDay())) {
        dias.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }
    return dias;
  }, [config?.dias_disponiveis, config?.antecedencia_maxima_dias]);

  // Slots do dia selecionado
  const slots = selectedDate ? getSlotsDisponiveis(selectedDate) : [];

  const onFormContinue = (
    data: Record<string, string>,
    fileValues: Record<string, File[]>,
  ) => {
    setPendingFormData(data);
    setPendingFormFiles(fileValues);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep('date');
  };

  const onFinalSubmit = async () => {
    if (!selectedTime || !pendingFormData || !scope || !config?.id) return;

    setSubmitting(true);
    try {
      const metadataCapturada = await buildAgendaMetadataCapturada(config);
      const payload: Record<string, string> = { ...pendingFormData };

      for (const field of filterCustomFormFields(fields)) {
        if (field.field_type !== 'file') continue;
        const fieldFiles = pendingFormFiles[field.field_key] ?? [];
        if (fieldFiles.length === 0) continue;

        const uploaded = (
          await Promise.all(
            fieldFiles.map((file) =>
              uploadAgendaPublicFiles(file, scope, config.id, field.field_key),
            ),
          )
        ).flat();
        payload[field.field_key] = serializeAgendaFormUploadFieldValue(uploaded);
      }

      const { nome, whatsapp, email } = resolveConvidadoFromForm(payload, fields);

      await createAgendamento.mutateAsync({
        data_hora_inicio: selectedTime.toISOString(),
        convidado_nome: nome,
        convidado_whatsapp: whatsapp,
        convidado_email: email || undefined,
        resposta_formulario: JSON.stringify(payload),
        metadata_capturada: Object.keys(metadataCapturada).length > 0 ? metadataCapturada : undefined,
      });
      setStep('success');
    } catch (error) {
      console.error('Erro ao agendar:', error);
      toast.error('Erro ao realizar agendamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const loading = loadingConfig;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a100c] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#e8924a]" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#1a100c] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-white/10 bg-[#faf6f2]">
          <CardContent className="py-10 text-center">
            <h2 className="text-xl font-bold mb-2">Agenda não encontrada</h2>
            <p className="text-muted-foreground">
              O link de agendamento não é válido ou foi desativado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AgendamentoPublicoLayout
      config={config}
      step={step}
      empresaLogoUrl={scope?.empresaLogoUrl}
      empresaNome={scope?.empresaNome}
    >
        {step === 'form' && (
          <div className="p-6">
            <div className={PUBLIC_STEP_HEADER}>
              <h2 className={PUBLIC_STEP_TITLE}>
                <User className="h-5 w-5 text-[#c45c26]" />
                Seus dados
              </h2>
              <p className={PUBLIC_STEP_DESC}>Preencha o formulário para continuar</p>
            </div>
              {loadingFields ? (
                <div className="py-6 text-center text-sm text-[#4a3228] font-medium flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#c45c26]" />
                  Carregando formulário...
                </div>
              ) : fieldsError ? (
                <div className="py-6 text-center text-sm text-[#4a3228] font-medium rounded-xl bg-white/70 border border-[#dccbc0]/90">
                  Não foi possível carregar o formulário. Tente recarregar a página.
                </div>
              ) : (
                  <PublicBookingForm
                    key={formKey}
                    fields={fields}
                    submitting={submitting}
                    submitLabel="Continuar"
                    onSubmit={onFormContinue}
                  />
              )}
          </div>
        )}

        {step === 'date' && (
          <div className="p-6">
            <div className={cn('flex items-center gap-2', PUBLIC_STEP_HEADER)}>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#4a3228] hover:bg-[#c45c26]/10 hover:text-[#1a100c] shadow-sm"
                onClick={() => setStep('form')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className={PUBLIC_STEP_TITLE}>
                  <Calendar className="h-5 w-5 text-[#c45c26]" />
                  Selecione uma data
                </h2>
                <p className={PUBLIC_STEP_DESC}>Escolha o dia para sua reunião</p>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {diasDisponiveis.slice(0, 16).map((date) => {
                  const daySlots = getSlotsDisponiveis(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const hasSlots = daySlots.length > 0;

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => hasSlots && setSelectedDate(date)}
                      disabled={!hasSlots}
                      className={cn(
                        PUBLIC_DATE_BTN,
                        isSelected && PUBLIC_DATE_BTN_SELECTED,
                        hasSlots && !isSelected && 'hover:border-[#c45c26]/45 hover:shadow-[0_4px_14px_rgba(26,16,12,0.1)]',
                        !hasSlots && 'opacity-45 cursor-not-allowed bg-[#f5ebe3]',
                      )}
                    >
                      <div
                        className={cn(
                          'text-xs font-bold capitalize tracking-wide text-[#4a3228]',
                          isSelected && 'text-[#9a4518]',
                        )}
                      >
                        {format(date, 'EEE', { locale: ptBR })}
                      </div>
                      <div
                        className={cn(
                          'text-lg font-bold tabular-nums text-[#1a100c]',
                          isSelected && 'text-[#8a3a18]',
                        )}
                      >
                        {format(date, 'd')}
                      </div>
                      <div
                        className={cn(
                          'text-xs font-semibold uppercase tracking-wider text-[#5c4034]',
                          isSelected && 'text-[#a84a1e]',
                        )}
                      >
                        {format(date, 'MMM', { locale: ptBR })}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <Button className={cn(PUBLIC_PRIMARY_BTN, 'mt-6')} onClick={() => setStep('time')}>
                  Continuar
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
          </div>
        )}

        {step === 'time' && selectedDate && (
          <div className="p-6">
            <div className={cn('flex items-center gap-2', PUBLIC_STEP_HEADER)}>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#4a3228] hover:bg-[#c45c26]/10 hover:text-[#1a100c] shadow-sm"
                onClick={() => setStep('date')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className={PUBLIC_STEP_TITLE}>
                  <Clock className="h-5 w-5 text-[#c45c26]" />
                  Selecione um horário
                </h2>
                <p className={PUBLIC_STEP_DESC}>
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
              {slots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedTime && slot.getTime() === selectedTime.getTime();
                    return (
                      <button
                        key={slot.toISOString()}
                        onClick={() => setSelectedTime(slot)}
                        className={cn(
                          PUBLIC_TIME_BTN,
                          isSelected && PUBLIC_TIME_BTN_SELECTED,
                          !isSelected && 'hover:border-[#c45c26]/45 hover:shadow-[0_4px_14px_rgba(26,16,12,0.1)]',
                        )}
                      >
                        {format(slot, 'HH:mm')}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-[#4a3228] font-medium py-8 rounded-xl bg-white/70 border border-[#dccbc0]/90 shadow-inner">
                  Não há horários disponíveis para este dia
                </p>
              )}

              {selectedTime && (
                <Button
                  className={cn(PUBLIC_PRIMARY_BTN, 'mt-6')}
                  onClick={() => void onFinalSubmit()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Agendando...
                    </>
                  ) : (
                    <>
                      Confirmar Agendamento
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
          </div>
        )}

        {step === 'success' && selectedTime && (
          <div className="py-10 px-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-700 mx-auto mb-4 drop-shadow-md" />
            <h2 className="text-xl font-bold text-[#1a100c] mb-2">Agendamento Confirmado!</h2>
            <p className="text-[#4a3228] font-medium mb-4">Sua reunião foi agendada para:</p>
            <div className="rounded-xl p-5 inline-block border border-[#c45c26]/30 bg-white/90 shadow-[0_8px_24px_rgba(196,92,38,0.18)]">
              <p className="font-bold text-[#1a100c]">
                {format(selectedTime, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-2xl font-bold text-[#c45c26] mt-1">{format(selectedTime, 'HH:mm')}</p>
              <p className="text-sm text-[#5c4034] font-medium mt-2">
                Duração: {config.duracao_minutos} minutos
              </p>
            </div>
            <p className="text-sm text-[#4a3228] font-medium mt-6">
              Você receberá uma confirmação em breve.
            </p>
          </div>
        )}
    </AgendamentoPublicoLayout>
  );
}
