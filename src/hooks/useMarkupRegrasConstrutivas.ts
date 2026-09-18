import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import type { RegraConstrutiva } from '@/lib/markup-motor-calculo';
import { markupRegrasConstrutivasQueryKey, markupSchemaExtra, resolveMarkupTable } from '@/lib/markup-tables';

export interface MarkupRegraConstrutivaRow extends RegraConstrutiva {
  id: string;
  ordem: number;
  ativo: boolean;
}

type NovaRegra = Omit<MarkupRegraConstrutivaRow, 'id'>;

export function useMarkupRegrasConstrutivas() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveMarkupTable(schemaEmpresa, 'regrasConstrutivas');

  const query = useQuery({
    queryKey: markupRegrasConstrutivasQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<MarkupRegraConstrutivaRow[]> => {
      const { data, error } = await db
        .from(table as 'markup_produtos')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MarkupRegraConstrutivaRow[];
    },
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: markupRegrasConstrutivasQueryKey(schemaEmpresa) });

  const criarRegra = useMutation({
    mutationFn: async (input: NovaRegra) => {
      const { data, error } = await db
        .from(table as 'markup_produtos')
        .insert({ ...input, ...markupSchemaExtra(schemaEmpresa) } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidar();
      toast.success('Regra construtiva criada!');
    },
    onError: (e: Error) => toast.error('Erro ao criar regra', { description: e.message }),
  });

  const atualizarRegra = useMutation({
    mutationFn: async ({ id, ...input }: Partial<MarkupRegraConstrutivaRow> & { id: string }) => {
      const { error } = await db
        .from(table as 'markup_produtos')
        .update({ ...input, atualizado_em: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success('Regra construtiva atualizada!');
    },
    onError: (e: Error) => toast.error('Erro ao atualizar regra', { description: e.message }),
  });

  const removerRegra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table as 'markup_produtos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success('Regra construtiva removida!');
    },
    onError: (e: Error) => toast.error('Erro ao remover regra', { description: e.message }),
  });

  return {
    ...query,
    criarRegra,
    atualizarRegra,
    removerRegra,
  };
}
