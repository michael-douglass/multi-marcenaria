import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import type { VendasGanhosMetricaFormato, VendasGanhosMetricaTipo } from '@/lib/vendas-ganhos-formula';

const MASTER_TABLE = 'CRM-multi-empresas>pipeline_vendas_metricas<';
const EMPRESA_TABLE = 'pipeline_vendas_metricas';

export interface VendasGanhosMetrica {
  id: string;
  nome: string;
  formula: string;
  tipo: VendasGanhosMetricaTipo;
  formato: VendasGanhosMetricaFormato;
  ordem: number;
  ativo: boolean;
}

interface DBRow {
  id: string;
  nome: string;
  formula: string;
  tipo: VendasGanhosMetricaTipo;
  formato: VendasGanhosMetricaFormato;
  ordem: number;
  ativo: boolean;
}

function adapt(row: DBRow): VendasGanhosMetrica {
  return {
    id: row.id,
    nome: row.nome,
    formula: row.formula,
    tipo: row.tipo,
    formato: row.formato,
    ordem: row.ordem,
    ativo: row.ativo,
  };
}

export function useVendasGanhosMetricas() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const metricasTable = table(EMPRESA_TABLE, MASTER_TABLE);
  const queryKey = ['pipeline-vendas-metricas', schemaEmpresa ?? 'master'] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await db
        .from(metricasTable)
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data as DBRow[]).map(adapt);
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addMetrica = useMutation({
    mutationFn: async (input: {
      nome: string;
      formula: string;
      tipo: VendasGanhosMetricaTipo;
      formato?: VendasGanhosMetricaFormato;
    }) => {
      const maxOrdem = query.data?.reduce((max, m) => Math.max(max, m.ordem), 0) ?? 0;
      const { data, error } = await db
        .from(metricasTable)
        .insert({
          nome: input.nome,
          formula: input.formula,
          tipo: input.tipo,
          formato: input.formato ?? 'currency',
          ordem: maxOrdem + 1,
        })
        .select()
        .single();
      if (error) throw error;
      return adapt(data as DBRow);
    },
    onSuccess: invalidate,
  });

  const updateMetrica = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        nome: string;
        formula: string;
        tipo: VendasGanhosMetricaTipo;
        formato: VendasGanhosMetricaFormato;
        ordem: number;
        ativo: boolean;
      }>;
    }) => {
      const { data, error } = await db
        .from(metricasTable)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return adapt(data as DBRow);
    },
    onSuccess: invalidate,
  });

  const deleteMetrica = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(metricasTable).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const cardMetricas = query.data?.filter((m) => m.tipo === 'card') ?? [];
  const colunaMetricas = query.data?.filter((m) => m.tipo === 'coluna') ?? [];

  return {
    metricas: query.data ?? [],
    cardMetricas,
    colunaMetricas,
    isLoading: query.isLoading,
    addMetrica,
    updateMetrica,
    deleteMetrica,
  };
}
