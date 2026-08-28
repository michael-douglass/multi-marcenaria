import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OrcamentoMetricaFormato, OrcamentoMetricaTipo } from '@/lib/orcamento-formula';

const TABLE = 'CRM-multi-empresas>pipeline_orcamento_metricas<';

export interface OrcamentoMetrica {
  id: string;
  nome: string;
  formula: string;
  tipo: OrcamentoMetricaTipo;
  formato: OrcamentoMetricaFormato;
  ordem: number;
  ativo: boolean;
}

interface DBRow {
  id: string;
  nome: string;
  formula: string;
  tipo: OrcamentoMetricaTipo;
  formato: OrcamentoMetricaFormato;
  ordem: number;
  ativo: boolean;
}

function adapt(row: DBRow): OrcamentoMetrica {
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

export function useOrcamentoMetricas() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pipeline-orcamento-metricas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data as DBRow[]).map(adapt);
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['pipeline-orcamento-metricas'] });

  const addMetrica = useMutation({
    mutationFn: async (input: {
      nome: string;
      formula: string;
      tipo: OrcamentoMetricaTipo;
      formato?: OrcamentoMetricaFormato;
    }) => {
      const maxOrdem =
        query.data?.reduce((max, m) => Math.max(max, m.ordem), 0) ?? 0;

      const { data, error } = await supabase
        .from(TABLE)
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
        tipo: OrcamentoMetricaTipo;
        formato: OrcamentoMetricaFormato;
        ordem: number;
        ativo: boolean;
      }>;
    }) => {
      const { data, error } = await supabase
        .from(TABLE)
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
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
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
    error: query.error,
    addMetrica,
    updateMetrica,
    deleteMetrica,
  };
}
