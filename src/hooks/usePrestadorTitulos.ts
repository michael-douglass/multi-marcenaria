import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';

const MASTER_TABLE = 'CRM-multi-empresas>prestador_titulos<';
const EMPRESA_TABLE = 'prestador_titulos';

export interface PrestadorTitulo {
  id: string;
  nome: string;
  criado_em: string;
}

export function usePrestadorTitulos() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const titulosTable = table(EMPRESA_TABLE, MASTER_TABLE);
  const queryKey = ['prestador-titulos', schemaEmpresa ?? 'master'] as const;

  const { data: titulos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await db
        .from(titulosTable)
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as PrestadorTitulo[];
    },
  });

  const createTitulo = useMutation({
    mutationFn: async (nome: string) => {
      const trimmed = nome.trim();
      if (trimmed.length < 2) {
        throw new Error('O título deve ter no mínimo 2 caracteres');
      }

      const exists = titulos.some(
        (t) => t.nome.toLowerCase() === trimmed.toLowerCase(),
      );
      if (exists) {
        throw new Error('Já existe um título com este nome');
      }

      const { data, error } = await db
        .from(titulosTable)
        .insert([{ nome: trimmed }])
        .select()
        .single();

      if (error) throw error;
      return data as PrestadorTitulo;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.refetchQueries({ queryKey });
      toast.success('Título cadastrado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao cadastrar título');
    },
  });

  const deleteTitulo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(titulosTable).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Título removido');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover título');
    },
  });

  return {
    titulos,
    isLoading,
    createTitulo: (nome: string) => createTitulo.mutateAsync(nome),
    deleteTitulo: (id: string) => deleteTitulo.mutateAsync(id),
    isCreating: createTitulo.isPending,
  };
}
