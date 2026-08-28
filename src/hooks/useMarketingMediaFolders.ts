import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import { getOrCreateComposicaoOrcamentoFolder } from '@/lib/biblioteca-composicao-orcamento';
import { toast } from '@/hooks/use-toast';

export interface MarketingMediaFolder {
  id: string;
  nome: string;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function useMarketingMediaFolders() {
  const queryClient = useQueryClient();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);
  const queryKey = ['marketing-media-folders', schemaEmpresa ?? 'master'] as const;

  const query = useQuery({
    queryKey,
    enabled: queriesReady,
    queryFn: async () => {
      // Garante a pasta especial antes de listar.
      await getOrCreateComposicaoOrcamentoFolder(schemaEmpresa);

      const { data, error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as MarketingMediaFolder[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-media-folders'] });
  };

  const createMutation = useMutation({
    mutationFn: async (folder: { nome: string; descricao?: string | null }) => {
      const { data, error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .insert({
          nome: folder.nome,
          descricao: folder.descricao ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingMediaFolder;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Pasta criada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar pasta', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      nome,
      descricao,
    }: {
      id: string;
      nome: string;
      descricao?: string | null;
    }) => {
      const { error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .update({ nome, descricao: descricao ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Pasta atualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar pasta', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
      queryClient.invalidateQueries({ queryKey: ['biblioteca-medias'] });
      toast({ title: 'Pasta removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover pasta', description: error.message, variant: 'destructive' });
    },
  });

  return {
    folders: query.data || [],
    isLoading: query.isLoading,
    createFolder: createMutation.mutateAsync,
    updateFolder: updateMutation.mutateAsync,
    deleteFolder: deleteMutation.mutateAsync,
  };
}
