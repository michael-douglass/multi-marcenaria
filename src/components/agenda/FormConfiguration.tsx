import { useState, useEffect, useMemo } from 'react';
import { Settings, Trash2, Plus, UserPlus, Type, GripVertical } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useAgendaFormFields,
  FormField,
  FormFieldType,
} from '@/hooks/useAgendaFormFields';
import { AgendaConfig } from '@/hooks/useAgenda';
import {
  AGENDA_FIELD_TYPE_OPTIONS,
  AGENDA_FILE_TYPE_OPTIONS,
  createTempFieldId,
} from '@/lib/agenda-form-field-utils';
import { AGENDA_FILE_CATEGORIES } from '@/lib/agenda-file-types';
import { getDefaultAgendaPublicSubtitle } from '@/lib/agenda-public-text';
import { usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FormFieldSortableCard } from '@/components/agenda/FormFieldSortableCard';

interface FormConfigurationProps {
  config: AgendaConfig | null;
  onUpdateConfig: (updates: Partial<AgendaConfig>) => void;
  onDeleteLink?: () => void;
  publicUrl: string;
}

interface LocalFieldState {
  id: string;
  field_key: string;
  field_label: string;
  field_type: FormFieldType;
  placeholder: string | null;
  options: string[] | null;
  visible: boolean;
  required: boolean;
  ordem: number;
  isNew?: boolean;
}

function mapFieldToLocal(f: FormField): LocalFieldState {
  return {
    id: f.id,
    field_key: f.field_key,
    field_label: f.field_label,
    field_type: f.field_type,
    placeholder: f.placeholder,
    options: f.options,
    visible: f.visible,
    required: f.required,
    ordem: f.ordem,
  };
}

function createEmptyField(ordem: number): LocalFieldState {
  return {
    id: createTempFieldId(),
    field_key: '',
    field_label: '',
    field_type: 'text',
    placeholder: null,
    options: null,
    visible: true,
    required: false,
    ordem,
    isNew: true,
  };
}

const DEFAULT_FILE_OPTIONS = [...AGENDA_FILE_CATEGORIES];

interface FileTypesEditorProps {
  options: string[] | null;
  onChange: (options: string[]) => void;
}

function FileTypesEditor({ options, onChange }: FileTypesEditorProps) {
  const selected = options?.length ? options : DEFAULT_FILE_OPTIONS;

  const toggle = (value: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...selected, value])]
      : selected.filter((item) => item !== value);
    onChange(next.length > 0 ? next : [value]);
  };

  return (
    <div className="space-y-2">
      <Label>Tipos de documento permitidos</Label>
      <div className="space-y-2">
        {AGENDA_FILE_TYPE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        O cliente poderá enviar fotos, vídeos ou PDF conforme as opções marcadas.
      </p>
    </div>
  );
}

const DEFAULT_SELECT_OPTIONS = ['', ''];

function normalizeSelectOptions(options: string[] | null | undefined): string[] {
  return (options ?? []).map((option) => option.trim()).filter(Boolean);
}

interface SelectOptionsEditorProps {
  options: string[] | null;
  onChange: (options: string[]) => void;
}

function SelectOptionsEditor({ options, onChange }: SelectOptionsEditorProps) {
  const optionList = options?.length ? options : DEFAULT_SELECT_OPTIONS;

  const updateOption = (index: number, value: string) => {
    const next = [...optionList];
    next[index] = value;
    onChange(next);
  };

  const addOption = () => {
    onChange([...optionList, '']);
  };

  const removeOption = (index: number) => {
    if (optionList.length <= 2) return;
    onChange(optionList.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>Opções de múltipla escolha</Label>
      <p className="text-xs text-muted-foreground">O cliente poderá marcar uma ou mais opções.</p>
      <div className="space-y-2">
        {optionList.map((option, optIndex) => (
          <div key={optIndex} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(e) => updateOption(optIndex, e.target.value)}
              placeholder={`Opção ${optIndex + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
              disabled={optionList.length <= 2}
              onClick={() => removeOption(optIndex)}
              aria-label={`Remover opção ${optIndex + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addOption}>
        <Plus className="h-4 w-4 mr-2" />
        Adicionar opção
      </Button>
      <p className="text-xs text-muted-foreground">
        O cliente escolherá uma das opções. Informe pelo menos 2 opções preenchidas.
      </p>
    </div>
  );
}

export function FormConfiguration({
  config,
  onUpdateConfig,
  onDeleteLink,
}: FormConfigurationProps) {
  const { fields, isLoading, saveFormFields } = useAgendaFormFields(config?.id);
  const { activeStages, isLoading: loadingStages } = usePipelineCustomStages();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [localFields, setLocalFields] = useState<LocalFieldState[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [formularioAtivo, setFormularioAtivo] = useState(true);
  const [textoPagina, setTextoPagina] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const fieldIds = useMemo(() => localFields.map((field) => field.id), [localFields]);

  useEffect(() => {
    if (fields.length > 0) {
      setLocalFields(fields.map(mapFieldToLocal));
      setDeletedIds([]);
      setHasChanges(false);
    }
  }, [fields]);

  useEffect(() => {
    if (config) {
      setFormularioAtivo((config as AgendaConfig & { formulario_ativo?: boolean }).formulario_ativo !== false);
      setTextoPagina(config.texto_pagina_agendamento ?? '');
    }
  }, [config]);

  const updateFieldLocal = (id: string, patch: Partial<LocalFieldState>) => {
    setLocalFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch };
        if (patch.visible === false) next.required = false;
        if (patch.field_type && patch.field_type !== 'select' && patch.field_type !== 'file') {
          next.options = null;
        }
        if (patch.field_type === 'select' && (!next.options || next.options.length === 0)) {
          next.options = [...DEFAULT_SELECT_OPTIONS];
        }
        if (patch.field_type === 'file' && (!next.options || next.options.length === 0)) {
          next.options = [...DEFAULT_FILE_OPTIONS];
        }
        return next;
      }),
    );
    setHasChanges(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalFields((prev) => {
      const oldIndex = prev.findIndex((field) => field.id === active.id);
      const newIndex = prev.findIndex((field) => field.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;

      return arrayMove(prev, oldIndex, newIndex).map((field, index) => ({
        ...field,
        ordem: index + 1,
      }));
    });
    setHasChanges(true);
  };

  const addField = () => {
    setLocalFields((prev) => [...prev, createEmptyField(prev.length + 1)]);
    setHasChanges(true);
  };

  const removeField = (id: string) => {
    if (!id.startsWith('temp-')) {
      setDeletedIds((prev) => [...prev, id]);
    }
    setLocalFields((prev) =>
      prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, ordem: i + 1 })),
    );
    setHasChanges(true);
  };

  const handleFormularioAtivoChange = (ativo: boolean) => {
    setFormularioAtivo(ativo);
    onUpdateConfig({ formulario_ativo: ativo } as Partial<AgendaConfig>);
  };

  const handleTextoPaginaSave = () => {
    const trimmed = textoPagina.trim();
    onUpdateConfig({
      texto_pagina_agendamento: trimmed || null,
    });
  };

  const handleSave = async () => {
    if (!config?.id) return;

    const normalized = localFields.map((f, index) => {
      const selectOptions =
        f.field_type === 'select' ? normalizeSelectOptions(f.options) : null;
      const fileOptions =
        f.field_type === 'file'
          ? (f.options?.length ? f.options : DEFAULT_FILE_OPTIONS)
          : null;

      return {
        ...f,
        ordem: index + 1,
        field_label: f.field_label.trim(),
        options: selectOptions ?? fileOptions,
      };
    });

    for (const field of normalized) {
      if (!field.field_label) {
        toast.error('Toda pergunta precisa de um texto.');
        return;
      }
      if (field.field_type === 'select') {
        const opts = field.options ?? [];
        if (opts.length < 2) {
          toast.error(`"${field.field_label}": informe pelo menos 2 opções para múltipla escolha.`);
          return;
        }
      }
      if (field.field_type === 'file') {
        const opts = field.options ?? [];
        if (opts.length < 1) {
          toast.error(`"${field.field_label}": selecione pelo menos 1 tipo de documento.`);
          return;
        }
      }
    }

    await saveFormFields.mutateAsync({
      configId: config.id,
      fields: normalized,
      deleteIds: deletedIds,
    });

    setDeletedIds([]);
    setHasChanges(false);
  };

  const handleDeleteLink = () => {
    onUpdateConfig({ ativo: false });
    toast.success('Link desativado');
    onDeleteLink?.();
  };

  if (!config?.id) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Carregando configuração da agenda…
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurar Formulário
          </CardTitle>
          <CardDescription className="text-xs">
            Crie as perguntas que o cliente responderá ao agendar. Arraste pelo ícone{' '}
            <GripVertical className="inline h-3 w-3 align-text-bottom" /> para definir a ordem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={formularioAtivo}
                onCheckedChange={handleFormularioAtivoChange}
                className="data-[state=checked]:bg-amber-500"
              />
              <span className="text-sm font-medium">Formulário ativo</span>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Texto da página de agendamento</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mensagem exibida abaixo do título na página pública. Use{' '}
              <code className="text-[11px] bg-muted px-1 rounded">{'{duracao}'}</code> para
              inserir a duração da reunião automaticamente.
            </p>
            <Textarea
              value={textoPagina}
              onChange={(e) => setTextoPagina(e.target.value)}
              onBlur={handleTextoPaginaSave}
              placeholder={getDefaultAgendaPublicSubtitle(config.duracao_minutos)}
              rows={2}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Prévia:{' '}
              {textoPagina.trim()
                ? textoPagina.replace(/\{duracao\}/gi, String(config.duracao_minutos))
                : getDefaultAgendaPublicSubtitle(config.duracao_minutos)}
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Integração com Leads</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada agendamento pelo link público pode gerar automaticamente um card no pipeline.
              Nome e telefone são campos fixos na página pública e preenchem o card do lead.
            </p>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Criar lead automaticamente</span>
              <Switch
                checked={config.criar_lead_automatico !== false}
                onCheckedChange={(checked) =>
                  onUpdateConfig({ criar_lead_automatico: checked })
                }
                className="data-[state=checked]:bg-amber-500"
              />
            </div>

            {config.criar_lead_automatico !== false && (
              <>
                <div className="space-y-2">
                  <Label>Coluna de destino no pipeline</Label>
                  <Select
                    value={config.lead_status_destino || undefined}
                    onValueChange={(value) => onUpdateConfig({ lead_status_destino: value })}
                    disabled={loadingStages || activeStages.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingStages ? 'Carregando colunas…' : 'Selecione a coluna'} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.nome}>
                          {stage.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!loadingStages && activeStages.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma coluna ativa no pipeline. Configure em Pipeline → Configurações.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Origem do lead (opcional)</Label>
                  <Input
                    value={config.lead_origem ?? 'Agendamento Público'}
                    onChange={(e) => onUpdateConfig({ lead_origem: e.target.value })}
                    placeholder="Ex: Agendamento Público"
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-3">
            {localFields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                Nenhuma pergunta ainda. Clique em &quot;Adicionar pergunta&quot; para começar.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
                  {localFields.map((field, index) => (
                    <FormFieldSortableCard
                      key={field.id}
                      fieldId={field.id}
                      index={index}
                      visible={field.visible}
                      onRemove={() => removeField(field.id)}
                    >
                      <div className="space-y-2">
                        <Label>Pergunta</Label>
                        <Input
                          value={field.field_label}
                          onChange={(e) =>
                            updateFieldLocal(field.id, { field_label: e.target.value })
                          }
                          placeholder="Ex: Qual o objetivo da reunião?"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de resposta</Label>
                        <Select
                          value={field.field_type}
                          onValueChange={(value) =>
                            updateFieldLocal(field.id, { field_type: value as FormFieldType })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="item-aligned" className="max-h-72">
                            {AGENDA_FIELD_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {field.field_type !== 'select' && field.field_type !== 'file' && (
                        <div className="space-y-2">
                          <Label>Texto de ajuda (opcional)</Label>
                          <Input
                            value={field.placeholder ?? ''}
                            onChange={(e) =>
                              updateFieldLocal(field.id, { placeholder: e.target.value || null })
                            }
                            placeholder="Ex: Digite aqui..."
                          />
                        </div>
                      )}

                      {field.field_type === 'select' && (
                        <SelectOptionsEditor
                          options={field.options}
                          onChange={(options) => updateFieldLocal(field.id, { options })}
                        />
                      )}

                      {field.field_type === 'file' && (
                        <FileTypesEditor
                          options={field.options}
                          onChange={(options) => updateFieldLocal(field.id, { options })}
                        />
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={field.visible}
                            onCheckedChange={(checked) =>
                              updateFieldLocal(field.id, { visible: checked === true })
                            }
                          />
                          <span className="text-sm">Exibir no formulário</span>
                        </label>
                        <label
                          className={cn(
                            'flex items-center gap-2',
                            field.visible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                          )}
                        >
                          <Checkbox
                            checked={field.required}
                            disabled={!field.visible}
                            onCheckedChange={(checked) =>
                              updateFieldLocal(field.id, { required: checked === true })
                            }
                          />
                          <span className="text-sm">Obrigatória</span>
                        </label>
                      </div>
                    </FormFieldSortableCard>
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={addField}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar pergunta
          </Button>

          <Button
            onClick={handleSave}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            disabled={!hasChanges || saveFormFields.isPending}
          >
            {saveFormFields.isPending
              ? 'Salvando...'
              : hasChanges
                ? 'Salvar formulário (inclui ordem das perguntas)'
                : 'Salvar formulário'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full bg-red-500 hover:bg-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                EXCLUIR LINK
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desativar link de agendamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá desativar o link público de agendamento. Você poderá reativá-lo
                  posteriormente nas configurações.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteLink}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Desativar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
