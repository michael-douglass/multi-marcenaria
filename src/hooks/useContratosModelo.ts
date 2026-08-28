import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';

export interface ContratoModelo {
  id: string;
  nome: string;
  conteudo: string;
  ativo: boolean;
  updated_at: string;
}

function resolveModeloTable(schema: string | null | undefined) {
  if (isSchemaApiExposed(schema)) return 'contratos_modelos';
  return 'CRM-multi-empresas>contratos_modelos<';
}

export function useContratosModelos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveModeloTable(schemaEmpresa);
  const queryKey = ['contratos-modelos', schemaEmpresa];

  const { data: modelos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await db
        .from(table as 'contratos_modelos')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContratoModelo[];
    },
    enabled: !!user?.id && queriesReady,
  });

  const modeloAtivo = modelos.find((m) => m.ativo) ?? null;

  const criarModelo = useMutation({
    mutationFn: async (dados: { nome: string; conteudo?: string }) => {
      const insert: Record<string, unknown> = {
        nome: dados.nome.trim(),
        conteudo: dados.conteudo ?? '',
        ativo: modelos.length === 0,
        updated_at: new Date().toISOString(),
      };
      if (!isSchemaApiExposed(schemaEmpresa)) insert.schema_nome = schemaEmpresa;
      const { data, error } = await db
        .from(table as 'contratos_modelos')
        .insert([insert])
        .select()
        .single();
      if (error) throw error;
      return data as ContratoModelo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Modelo criado!');
    },
    onError: (e: Error) => toast.error('Erro ao criar modelo', { description: e.message }),
  });

  const salvarModelo = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<Pick<ContratoModelo, 'nome' | 'conteudo'>> }) => {
      const { data, error } = await db
        .from(table as 'contratos_modelos')
        .update({ ...dados, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ContratoModelo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Modelo salvo!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar modelo', { description: e.message }),
  });

  const ativarModelo = useMutation({
    mutationFn: async (id: string) => {
      // desativar todos
      await db
        .from(table as 'contratos_modelos')
        .update({ ativo: false })
        .neq('id', id);
      // ativar o escolhido
      const { data, error } = await db
        .from(table as 'contratos_modelos')
        .update({ ativo: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ContratoModelo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Modelo definido como ativo!');
    },
    onError: (e: Error) => toast.error('Erro ao ativar modelo', { description: e.message }),
  });

  const excluirModelo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(table as 'contratos_modelos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Modelo excluído!');
    },
    onError: (e: Error) => toast.error('Erro ao excluir modelo', { description: e.message }),
  });

  return {
    modelos,
    modeloAtivo,
    isLoading,
    criarModelo,
    salvarModelo,
    ativarModelo,
    excluirModelo,
  };
}

/** Atalho: retorna apenas o modelo ativo (compatibilidade com NovoContratoPage). */
export function useContratosModelo() {
  const { modeloAtivo, isLoading, modelos } = useContratosModelos();
  return { modelo: modeloAtivo, isLoading, modelos };
}
