import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { DEFAULT_AGENDA_FORM_FIELDS, buildDefaultFormFields } from '@/lib/agenda-form-defaults';
import { slugifyFieldKey } from '@/lib/agenda-form-field-utils';
import { getAgendaPublicClient, type AgendaPublicScope } from '@/lib/agenda-public-scope';
import { toast } from 'sonner';

// ============================================
// TIPOS DOS CAMPOS DO FORMULÁRIO
// ============================================

export type FormFieldType = 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea' | 'file' | 'date';

export interface FormField {
  id: string;
  config_id: string;
  field_key: string;
  field_label: string;
  field_type: FormFieldType;
  placeholder: string | null;
  options: string[] | null;
  visible: boolean;
  required: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

async function fetchOrSeedFormFields(
  client: Pick<ReturnType<typeof useEmpresaSupabase>, 'from'>,
  formFieldsTable: string,
  configId: string,
  options?: { seedIfEmpty?: boolean },
): Promise<FormField[]> {
  const { data, error } = await client
    .from(formFieldsTable)
    .select('*')
    .eq('config_id', configId)
    .order('ordem', { ascending: true });

  if (error) {
    console.error('Erro ao buscar campos:', error);
    return [];
  }

  if (data && data.length > 0) {
    return data as FormField[];
  }

  if (!options?.seedIfEmpty) {
    return [];
  }

  const { data: seeded, error: seedError } = await client
    .from(formFieldsTable)
    .insert(
      DEFAULT_AGENDA_FORM_FIELDS.map((field) => ({
        ...field,
        config_id: configId,
      })),
    )
    .select('*')
    .order('ordem', { ascending: true });

  if (seedError) {
    console.error('Erro ao criar campos padrão do formulário:', seedError);
    return [];
  }

  return (seeded ?? []) as FormField[];
}

// ============================================
// HOOK PARA CAMPOS DO FORMULÁRIO (ADMIN)
// ============================================

export function useAgendaFormFields(configId?: string) {
  const queryClient = useQueryClient();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { schemaEmpresa } = useEmpresa();
  const formFieldsTable = table('agenda_form_fields', 'CRM-multi-empresas>agenda_form_fields<');

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['agenda-form-fields', schemaEmpresa, configId],
    queryFn: async () => {
      if (!configId) return [];
      return fetchOrSeedFormFields(db, formFieldsTable, configId, { seedIfEmpty: true });
    },
    enabled: !!configId,
  });

  const updateField = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FormField> & { id: string }) => {
      if (updates.visible === false) {
        updates.required = false;
      }

      const { data, error } = await db
        .from(formFieldsTable)
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-form-fields'] });
      toast.success('Campo atualizado!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar campo:', error);
      toast.error('Erro ao atualizar campo');
    },
  });

  const updateFields = useMutation({
    mutationFn: async (
      updates: Array<{
        id: string;
        field_label?: string;
        field_type?: FormFieldType;
        placeholder?: string | null;
        options?: string[] | null;
        visible?: boolean;
        required?: boolean;
        ordem?: number;
      }>,
    ) => {
      const promises = updates.map(async ({ id, visible, required, ...rest }) => {
        const finalRequired = visible === false ? false : required;

        const { error } = await db
          .from(formFieldsTable)
          .update({
            ...rest,
            visible,
            required: finalRequired,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-form-fields'] });
      toast.success('Configurações salvas!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar campos:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  const saveFormFields = useMutation({
    mutationFn: async (payload: {
      configId: string;
      fields: Array<{
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
      }>;
      deleteIds: string[];
    }) => {
      const { configId, fields, deleteIds } = payload;

      for (const id of deleteIds) {
        const { error } = await db.from(formFieldsTable).delete().eq('id', id);
        if (error) throw error;
      }

      const usedKeys: string[] = [];

      for (const field of fields) {
        const fieldKey =
          field.isNew || field.id.startsWith('temp-')
            ? slugifyFieldKey(field.field_key || field.field_label, usedKeys)
            : field.field_key;

        usedKeys.push(fieldKey);

        const row = {
          field_label: field.field_label.trim() || 'Pergunta',
          field_type: field.field_type,
          placeholder: field.placeholder?.trim() || null,
          options: field.field_type === 'select' || field.field_type === 'file' ? field.options : null,
          visible: field.visible,
          required: field.visible ? field.required : false,
          ordem: field.ordem,
          atualizado_em: new Date().toISOString(),
        };

        if (field.isNew || field.id.startsWith('temp-')) {
          const { error } = await db.from(formFieldsTable).insert({
            ...row,
            config_id: configId,
            field_key: fieldKey,
          });
          if (error) throw error;
        } else {
          const { error } = await db.from(formFieldsTable).update(row).eq('id', field.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-form-fields'] });
      toast.success('Formulário salvo!');
    },
    onError: (error) => {
      console.error('Erro ao salvar formulário:', error);
      toast.error('Erro ao salvar formulário');
    },
  });

  return {
    fields,
    isLoading,
    updateField,
    updateFields,
    saveFormFields,
  };
}

// ============================================
// HOOK PARA CAMPOS PÚBLICOS (SEM AUTH / SEM EMPRESA)
// ============================================

export function useAgendaFormFieldsPublic(configId?: string, scope?: AgendaPublicScope | null) {
  const { data: fields = [], isLoading, isError } = useQuery({
    queryKey: ['agenda-form-fields-public', scope?.schema ?? null, configId],
    queryFn: async () => {
      if (!configId || !scope) return [];

      const client = getAgendaPublicClient(scope);
      const allFields = await fetchOrSeedFormFields(client, scope.formFieldsTable, configId);
      const visibleFields = allFields.filter((field) => field.visible);

      if (visibleFields.length > 0) {
        return visibleFields;
      }

      return buildDefaultFormFields(configId).filter((field) => field.visible);
    },
    enabled: !!configId && !!scope,
  });

  const requiredFields = fields.filter((field) => field.required);

  return {
    fields,
    requiredFields,
    isLoading,
    isError,
  };
}
