import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { OrcamentoScript } from '@/lib/orcamento-slide-types';

const PUBLIC_TABLE = 'CRM-multi-empresas>orcamento_slide_scripts<' as const;

function resolveTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_scripts' : PUBLIC_TABLE;
}

export function useOrcamentoSlideScripts() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);

  const query = useQuery({
    queryKey: ['orcamento-slide-scripts', schemaEmpresa],
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<OrcamentoScript[]> => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_scripts')
        .select('*')
        .eq('ativo', true)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrcamentoScript[];
    },
  });

  const criarScript = useMutation({
    mutationFn: async (input: Pick<OrcamentoScript, 'titulo' | 'conteudo' | 'categoria'>) => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_scripts')
        .insert({ ...input, ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-scripts', schemaEmpresa] }); toast.success('Script salvo!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const atualizarScript = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrcamentoScript> & { id: string }) => {
      const { error } = await db.from(table as 'orcamento_slide_scripts').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-scripts', schemaEmpresa] }); toast.success('Script atualizado!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const removerScript = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table as 'orcamento_slide_scripts').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-scripts', schemaEmpresa] }); toast.success('Script removido!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  return { scripts: query.data ?? [], isLoading: query.isLoading, criarScript, atualizarScript, removerScript };
}
