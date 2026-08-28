import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import {
  DEFAULT_VENDAS_GANHOS_CONFIG,
  normalizeVendasGanhosConfig,
  parseFontesFromDb,
  prepareVendasGanhosConfigForSave,
  type VendasGanhosConfig,
  type VendasGanhosFonte,
} from '@/lib/vendas-ganhos';

const MASTER_TABLE = 'CRM-multi-empresas>pipeline_vendas_ganhos_config<';
const EMPRESA_TABLE = 'pipeline_vendas_ganhos_config';

interface DbRow {
  id: string;
  status_destino_ao_ganhar: string;
  fontes: unknown;
}

function adapt(row: DbRow): VendasGanhosConfig & { id: string } {
  const cfg = normalizeVendasGanhosConfig({
    statusDestinoAoGanhar: row.status_destino_ao_ganhar,
    fontes: parseFontesFromDb(row.fontes),
  });
  return { ...cfg, id: row.id };
}

function fontesToDb(fontes: VendasGanhosFonte[]) {
  return fontes.map((f) => ({
    tipo_fonte: f.tipoFonte,
    valor_fonte: f.valorFonte,
    filtro_origem: f.filtroOrigens.length > 0 ? f.filtroOrigens : null,
    filtro_regiao: f.filtroRegioes.length > 0 ? f.filtroRegioes : null,
    ativo: f.ativo,
  }));
}

export function useVendasGanhosConfig() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const configTable = table(EMPRESA_TABLE, MASTER_TABLE);
  const queryKey = ['pipeline-vendas-ganhos-config', schemaEmpresa ?? 'master'] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await db
        .from(configTable)
        .select('*')
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const seed = {
          status_destino_ao_ganhar: DEFAULT_VENDAS_GANHOS_CONFIG.statusDestinoAoGanhar,
          fontes: fontesToDb(DEFAULT_VENDAS_GANHOS_CONFIG.fontes),
        };
        const { data: inserted, error: insertError } = await db
          .from(configTable)
          .insert(seed)
          .select()
          .single();
        if (insertError) throw insertError;
        return { ...adapt(inserted as DbRow), id: (inserted as DbRow).id };
      }
      const row = data as DbRow;
      return { ...adapt(row), id: row.id };
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const saveConfig = useMutation({
    mutationFn: async (input: VendasGanhosConfig & { id?: string }) => {
      const prepared = prepareVendasGanhosConfigForSave(input);
      const payload = {
        status_destino_ao_ganhar: prepared.statusDestinoAoGanhar,
        fontes: fontesToDb(prepared.fontes),
      };

      if (input.id) {
        const { data, error } = await db
          .from(configTable)
          .update(payload)
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return adapt(data as DbRow);
      }

      const { data, error } = await db.from(configTable).insert(payload).select().single();
      if (error) throw error;
      return adapt(data as DbRow);
    },
    onSuccess: (saved) => {
      if (saved) {
        queryClient.setQueryData(queryKey, saved);
      }
      invalidate();
    },
  });

  const config = query.data ?? { ...DEFAULT_VENDAS_GANHOS_CONFIG, id: undefined };

  return {
    config,
    isLoading: query.isLoading,
    saveConfig,
  };
}
