import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';

const MASTER_CONFIG = 'CRM-multi-empresas>pipeline_metricas_coluna_config<';
const EMPRESA_CONFIG = 'pipeline_metricas_coluna_config';

export const METRICA_COLUNA_CARD_AULAS = 'aulas_experimentais' as const;

export type MetricaColunaCardKey = typeof METRICA_COLUNA_CARD_AULAS;

export const DEFAULT_STATUS_COLUNA_AULAS = 'Aula Experimental Marcada';

export interface MetricasColunaConfig {
  id?: string;
  cardKey: MetricaColunaCardKey;
  statusColuna: string;
}

interface DbRow {
  id: string;
  card_key: string;
  status_coluna: string;
}

function adapt(row: DbRow): MetricasColunaConfig {
  return {
    id: row.id,
    cardKey: row.card_key as MetricaColunaCardKey,
    statusColuna: row.status_coluna?.trim() || DEFAULT_STATUS_COLUNA_AULAS,
  };
}

export function useMetricasColunaConfig(cardKey: MetricaColunaCardKey = METRICA_COLUNA_CARD_AULAS) {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const configTable = table(EMPRESA_CONFIG, MASTER_CONFIG);
  const queryKey = ['pipeline-metricas-coluna-config', schemaEmpresa ?? 'master', cardKey] as const;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<MetricasColunaConfig> => {
      const { data, error } = await db
        .from(configTable)
        .select('*')
        .eq('card_key', cardKey)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const seed = {
          card_key: cardKey,
          status_coluna: DEFAULT_STATUS_COLUNA_AULAS,
        };
        const { data: inserted, error: insertError } = await db
          .from(configTable)
          .insert(seed)
          .select()
          .single();
        if (insertError) throw insertError;
        return adapt(inserted as DbRow);
      }

      return adapt(data as DbRow);
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (input: { id?: string; statusColuna: string }) => {
      const status_coluna = input.statusColuna.trim();
      if (!status_coluna) throw new Error('Escolha uma coluna do pipeline');

      if (input.id) {
        const { error } = await db
          .from(configTable)
          .update({ status_coluna })
          .eq('id', input.id);
        if (error) throw error;
        return;
      }

      const { error } = await db.from(configTable).upsert(
        { card_key: cardKey, status_coluna },
        { onConflict: 'card_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-metricas-coluna-config'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-coluna-movimentos'] });
    },
  });

  return {
    config: query.data ?? { cardKey, statusColuna: DEFAULT_STATUS_COLUNA_AULAS },
    isLoading: query.isLoading,
    saveConfig,
  };
}
