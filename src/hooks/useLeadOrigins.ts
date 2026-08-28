import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';

const MASTER_TABLE = 'CRM-multi-empresas>lead_origins<';
const EMPRESA_TABLE = 'lead_origins';

export interface LeadOrigin {
  id: string;
  nome: string;
  is_default: boolean;
  criado_em: string;
}

export function useLeadOrigins() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const originsTable = table(EMPRESA_TABLE, MASTER_TABLE);
  const queryKey = ['lead-origins', schemaEmpresa ?? 'master'] as const;

  const { data: origins = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await db
        .from(originsTable)
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as LeadOrigin[];
    },
  });

  const createOrigin = useMutation({
    mutationFn: async (name: string) => {
      const exists = origins.some(
        (o) => o.nome.toLowerCase() === name.toLowerCase(),
      );

      if (exists) {
        throw new Error('Uma origem com este nome já existe');
      }

      const { data, error } = await db
        .from(originsTable)
        .insert([{ nome: name, is_default: false }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Origem criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar origem');
    },
  });

  const deleteOrigin = useMutation({
    mutationFn: async (id: string) => {
      const origin = origins.find((o) => o.id === id);

      if (origin?.is_default) {
        throw new Error('Origens padrão não podem ser deletadas');
      }

      const { error } = await db.from(originsTable).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.refetchQueries({ queryKey });
      toast.success('Origem deletada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao deletar origem');
    },
  });

  const updateOrigin = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { data, error } = await db
        .from(originsTable)
        .update({ nome })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Origem atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar origem');
    },
  });

  return {
    origins,
    isLoading,
    createOrigin: (name: string) => createOrigin.mutateAsync(name),
    deleteOrigin: (id: string) => deleteOrigin.mutateAsync(id),
    updateOrigin,
  };
}
