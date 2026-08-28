import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import {
  isPontuaGarboCampoDefinitivo,
  PONTUA_GARBO_CAMPO_NOME,
  PONTUA_GARBO_PERCENTUAL_PADRAO,
} from '@/lib/pontua-garbo';

const PUBLIC_DEFS_TABLE = 'CRM-multi-empresas>lead_custom_field_definitions<' as const;
const PUBLIC_VALS_TABLE = 'CRM-multi-empresas>lead_custom_field_values<' as const;

export type CustomFieldType = 'texto' | 'numero' | 'data' | 'select' | 'usuario_sistema';

export interface PontuaGarboConfig {
  ativo: boolean;
  /** Padrão ao vincular prestador em lead sem % salvo (não é comissão global). */
  percentual_padrao?: number;
  /** Legado — tratado como percentual_padrao */
  percentual?: number;
}

export interface LeadCustomFieldDefinition {
  id: string;
  nome: string;
  tipo: CustomFieldType;
  opcoes: string[] | null;
  ordem: number;
  ativo: boolean;
  /** Configuração do Programa Pontua Garbo (só para tipo usuario_sistema) */
  config_pontua_garbo: PontuaGarboConfig | null;
  criado_em: string;
  atualizado_em: string;
}

export interface LeadCustomFieldValue {
  id: string;
  lead_id: number;
  field_id: string;
  valor: string | null;
  /** Percentual de comissão Pontua Garbo deste lead (0–100) */
  pontua_garbo_percentual: number | null;
  criado_em: string;
  atualizado_em: string;
}

const ERRO_CAMPO_PONTUA_GARBO_SISTEMA =
  'O campo Pontua Garbo é do sistema e não pode ser excluído dos cards.';

type EmpresaDb = ReturnType<typeof useEmpresaSupabase>;

async function fetchFieldDefinition(
  db: EmpresaDb,
  defsTable: string,
  id: string,
): Promise<LeadCustomFieldDefinition | null> {
  const { data, error } = await db.from(defsTable).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as LeadCustomFieldDefinition | null) ?? null;
}

/** Garante que o campo Pontua Garbo exista e esteja ativo em todos os cards. */
async function ensurePontuaGarboCampoDefinitivo(db: EmpresaDb, defsTable: string) {
  const { data, error: loadErr } = await db.from(defsTable).select('*');
  if (loadErr) throw loadErr;
  const defs = (data ?? []) as LeadCustomFieldDefinition[];
  const existing = defs.find((field) => isPontuaGarboCampoDefinitivo(field));

  if (existing) {
    if (existing.ativo && existing.tipo === 'usuario_sistema') return;
    const percentualPadrao =
      existing.config_pontua_garbo?.percentual_padrao
      ?? existing.config_pontua_garbo?.percentual
      ?? PONTUA_GARBO_PERCENTUAL_PADRAO;
    const { error } = await db
      .from(defsTable)
      .update({
        ativo: true,
        tipo: 'usuario_sistema',
        nome: existing.nome?.trim() || PONTUA_GARBO_CAMPO_NOME,
        config_pontua_garbo: { ativo: true, percentual_padrao: percentualPadrao },
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const maxOrdem = defs.reduce((acc, field) => Math.max(acc, field.ordem), -1);
  const { error } = await db.from(defsTable).insert({
    nome: PONTUA_GARBO_CAMPO_NOME,
    tipo: 'usuario_sistema',
    opcoes: null,
    ordem: Math.max(0, maxOrdem + 1),
    ativo: true,
    config_pontua_garbo: {
      ativo: true,
      percentual_padrao: PONTUA_GARBO_PERCENTUAL_PADRAO,
    },
  });
  if (error) throw error;
}

export function useLeadCustomFieldDefs() {
  const queryClient = useQueryClient();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { schemaEmpresa } = useEmpresa();

  const defsTable = table('lead_custom_field_definitions', PUBLIC_DEFS_TABLE);
  const defsKey = ['lead-custom-field-definitions', schemaEmpresa] as const;

  const { data: fields = [], isLoading } = useQuery({
    queryKey: defsKey,
    queryFn: async (): Promise<LeadCustomFieldDefinition[]> => {
      const loadActive = async (): Promise<LeadCustomFieldDefinition[]> => {
        const { data, error } = await db
          .from(defsTable)
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true });
        if (error) throw error;
        return (data ?? []) as LeadCustomFieldDefinition[];
      };

      const active = await loadActive();
      if (active.some((field) => isPontuaGarboCampoDefinitivo(field))) {
        return active;
      }

      try {
        await ensurePontuaGarboCampoDefinitivo(db, defsTable);
        return await loadActive();
      } catch {
        return active;
      }
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: defsKey });

  const createField = useMutation({
    mutationFn: async (input: {
      nome: string;
      tipo: CustomFieldType;
      opcoes?: string[];
      config_pontua_garbo?: PontuaGarboConfig | null;
    }) => {
      const maxOrdem = fields.reduce((acc, f) => Math.max(acc, f.ordem), -1);
      const { error } = await db.from(defsTable).insert({
        nome: input.nome.trim(),
        tipo: input.tipo,
        opcoes: input.opcoes?.length ? input.opcoes : null,
        ordem: maxOrdem + 1,
        ativo: true,
        config_pontua_garbo: input.config_pontua_garbo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Campo criado'); invalidate(); },
    onError: (e: Error) => toast.error(e.message || 'Erro ao criar campo'),
  });

  const updateField = useMutation({
    mutationFn: async (input: {
      id: string;
      nome: string;
      tipo: CustomFieldType;
      opcoes?: string[] | null;
      config_pontua_garbo?: PontuaGarboConfig | null;
    }) => {
      const current = await fetchFieldDefinition(db, defsTable, input.id);
      if (current && isPontuaGarboCampoDefinitivo(current)) {
        const percentualPadrao =
          input.config_pontua_garbo?.percentual_padrao
          ?? current.config_pontua_garbo?.percentual_padrao
          ?? current.config_pontua_garbo?.percentual
          ?? PONTUA_GARBO_PERCENTUAL_PADRAO;
        const { error } = await db.from(defsTable).update({
          nome: current.nome?.trim() || PONTUA_GARBO_CAMPO_NOME,
          tipo: 'usuario_sistema',
          config_pontua_garbo: { ativo: true, percentual_padrao: percentualPadrao },
        }).eq('id', input.id);
        if (error) throw error;
        return;
      }

      const { error } = await db.from(defsTable).update({
        nome: input.nome.trim(),
        tipo: input.tipo,
        opcoes: input.opcoes?.length ? input.opcoes : null,
        config_pontua_garbo: input.config_pontua_garbo ?? null,
      }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Campo atualizado'); invalidate(); },
    onError: (e: Error) => toast.error(e.message || 'Erro ao atualizar campo'),
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const current = await fetchFieldDefinition(db, defsTable, id);
      if (current && isPontuaGarboCampoDefinitivo(current)) {
        throw new Error(ERRO_CAMPO_PONTUA_GARBO_SISTEMA);
      }
      const { error } = await db.from(defsTable).update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Campo removido'); invalidate(); },
    onError: (e: Error) => toast.error(e.message || 'Erro ao remover campo'),
  });

  return { fields, isLoading, createField, updateField, deleteField };
}

export function useLeadCustomFieldValues(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { schemaEmpresa } = useEmpresa();

  const valsTable = table('lead_custom_field_values', PUBLIC_VALS_TABLE);
  const valuesKey = ['lead-custom-field-values', schemaEmpresa, leadId] as const;

  const { data: values = [], isLoading } = useQuery({
    queryKey: valuesKey,
    queryFn: async (): Promise<LeadCustomFieldValue[]> => {
      const { data, error } = await db
        .from(valsTable)
        .select('*')
        .eq('lead_id', leadId!);
      if (error) throw error;
      return (data ?? []) as LeadCustomFieldValue[];
    },
    enabled: !!leadId,
  });

  const upsertValue = useMutation({
    mutationFn: async (input: {
      field_id: string;
      valor: string | null;
      pontua_garbo_percentual?: number | null;
    }) => {
      const lid = leadId!;
      const patch: Record<string, unknown> = { valor: input.valor };
      if (input.pontua_garbo_percentual !== undefined) {
        patch.pontua_garbo_percentual = input.pontua_garbo_percentual;
      }

      const { data: existing, error: findErr } = await db
        .from(valsTable)
        .select('id')
        .eq('lead_id', lid)
        .eq('field_id', input.field_id)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing) {
        const { error } = await db
          .from(valsTable)
          .update(patch)
          .eq('lead_id', lid)
          .eq('field_id', input.field_id);
        if (error) throw error;
      } else {
        const { error } = await db.from(valsTable).insert({
          lead_id: lid,
          field_id: input.field_id,
          valor: input.valor,
          pontua_garbo_percentual:
            input.pontua_garbo_percentual !== undefined ? input.pontua_garbo_percentual : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: valuesKey });
      void queryClient.invalidateQueries({ queryKey: ['lead-pontua-garbo-sale', schemaEmpresa, leadId] });
      void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-financeiro', schemaEmpresa] });
      void queryClient.invalidateQueries({ queryKey: ['minha-pontua-garbo', schemaEmpresa] });
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao salvar valor'),
  });

  /** Atualiza só a comissão % deste lead (nunca altera outros leads nem o template do campo). */
  const savePontuaGarboPercentual = useMutation({
    mutationFn: async (input: {
      field_id: string;
      valor: string;
      percentual: number;
    }) => {
      const lid = leadId!;
      const { data: existing, error: findErr } = await db
        .from(valsTable)
        .select('id')
        .eq('lead_id', lid)
        .eq('field_id', input.field_id)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing) {
        const { error } = await db
          .from(valsTable)
          .update({ pontua_garbo_percentual: input.percentual })
          .eq('lead_id', lid)
          .eq('field_id', input.field_id);
        if (error) throw error;
      } else {
        const { error } = await db.from(valsTable).insert({
          lead_id: lid,
          field_id: input.field_id,
          valor: input.valor,
          pontua_garbo_percentual: input.percentual,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: valuesKey });
      void queryClient.invalidateQueries({ queryKey: ['lead-pontua-garbo-sale', schemaEmpresa, leadId] });
      void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-financeiro', schemaEmpresa] });
      void queryClient.invalidateQueries({ queryKey: ['minha-pontua-garbo', schemaEmpresa] });
      toast.success('Comissão deste lead salva');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao salvar comissão do lead'),
  });

  const getValueMap = () => {
    const map: Record<string, string> = {};
    values.forEach((v) => { if (v.valor !== null) map[v.field_id] = v.valor; });
    return map;
  };

  return { values, isLoading, upsertValue, savePontuaGarboPercentual, getValueMap };
}
