import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Regiao {
  id: string;
  nomeTabela: string;
  nomeAmigavel: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface DatabaseRegiao {
  id: string;
  nome_tabela: string;
  nome_amigavel: string;
  criado_em: string;
  atualizado_em: string;
}

function adaptFromDatabase(db: DatabaseRegiao): Regiao {
  return {
    id: db.id,
    nomeTabela: db.nome_tabela,
    nomeAmigavel: db.nome_amigavel,
    criadoEm: db.criado_em,
    atualizadoEm: db.atualizado_em,
  };
}

export function useRegioes() {
  const queryClient = useQueryClient();

  const { data: regioes = [], isLoading } = useQuery({
    queryKey: ['regioes-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>tabela_origem_config<')
        .select('*')
        .order('nome_amigavel', { ascending: true });

      if (error) throw error;
      return (data as DatabaseRegiao[]).map(adaptFromDatabase);
    },
  });

  const addRegiao = useMutation({
    mutationFn: async ({ nomeAmigavel, nomeTabela }: { nomeAmigavel: string; nomeTabela: string }) => {
      // Verificar se já existe
      const exists = regioes.some(
        r => r.nomeAmigavel.toLowerCase() === nomeAmigavel.toLowerCase()
      );

      if (exists) {
        throw new Error('Uma região com este nome já existe');
      }

      const { data, error } = await supabase
        .from('CRM-multi-empresas>tabela_origem_config<')
        .insert([{ 
          nome_amigavel: nomeAmigavel, 
          nome_tabela: nomeTabela || nomeAmigavel.toLowerCase().replace(/\s+/g, '_'),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regioes-config'] });
      queryClient.invalidateQueries({ queryKey: ['tabela-origem-config'] });
      toast.success('Região adicionada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar região');
    },
  });

  const updateRegiao = useMutation({
    mutationFn: async ({ id, nomeAmigavel }: { id: string; nomeAmigavel: string }) => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>tabela_origem_config<')
        .update({ nome_amigavel: nomeAmigavel })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regioes-config'] });
      queryClient.invalidateQueries({ queryKey: ['tabela-origem-config'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Região atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar região');
    },
  });

  const deleteRegiao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('CRM-multi-empresas>tabela_origem_config<')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regioes-config'] });
      queryClient.invalidateQueries({ queryKey: ['tabela-origem-config'] });
      toast.success('Região removida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover região');
    },
  });

  // Lista de nomes amigáveis para dropdowns
  const regioesDisponiveis = regioes.map(r => r.nomeAmigavel);

  // Mapeamento de nome amigável para nome de tabela
  const regiaoToTabelaMap = regioes.reduce((acc, r) => {
    acc[r.nomeAmigavel] = r.nomeTabela;
    return acc;
  }, {} as Record<string, string>);

  return {
    regioes,
    regioesDisponiveis,
    regiaoToTabelaMap,
    isLoading,
    addRegiao,
    updateRegiao,
    deleteRegiao,
  };
}
