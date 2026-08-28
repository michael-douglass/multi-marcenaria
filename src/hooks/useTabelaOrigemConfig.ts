import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TabelaOrigemConfig } from '@/types/selletos';

interface DatabaseTabelaOrigemConfig {
  id: string;
  nome_tabela: string;
  nome_amigavel: string;
  criado_em: string;
  atualizado_em: string;
}

function adaptConfigFromDatabase(dbConfig: DatabaseTabelaOrigemConfig): TabelaOrigemConfig {
  return {
    id: dbConfig.id,
    nomeTabela: dbConfig.nome_tabela,
    nomeAmigavel: dbConfig.nome_amigavel,
    criadoEm: dbConfig.criado_em,
    atualizadoEm: dbConfig.atualizado_em,
  };
}

export function useTabelaOrigemConfig() {
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['tabela-origem-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>tabela_origem_config<')
        .select('*')
        .order('nome_amigavel', { ascending: true });

      if (error) throw error;
      return (data as DatabaseTabelaOrigemConfig[]).map(adaptConfigFromDatabase);
    },
  });

  const updateNomeAmigavel = useMutation({
    mutationFn: async ({ nomeTabela, novoNomeAmigavel }: { nomeTabela: string; novoNomeAmigavel: string }) => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>tabela_origem_config<')
        .update({ nome_amigavel: novoNomeAmigavel })
        .eq('nome_tabela', nomeTabela)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalida tanto o cache de configs quanto de leads para atualizar os badges
      queryClient.invalidateQueries({ queryKey: ['tabela-origem-config'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Nome amigável atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar nome amigável', {
        description: error.message,
      });
    },
  });

  return {
    configs,
    isLoading,
    updateNomeAmigavel,
  };
}
