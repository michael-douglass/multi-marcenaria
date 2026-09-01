import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import { getOrCreateComposicaoOrcamentoFolder } from '@/lib/biblioteca-composicao-orcamento';
import { proximaOrdemPinBiblioteca } from '@/lib/biblioteca-priority';
import { toast } from '@/hooks/use-toast';

export interface MarketingMediaFolder {
  id: string;
  nome: string;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
  lead_id: number | null;
  fixado: boolean;
  ordem_topo: number | null;
}

function mapFolder(row: Record<string, unknown>): MarketingMediaFolder {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    descricao: (row.descricao as string | null) ?? null,
    criado_em: String(row.criado_em ?? ''),
    atualizado_em: String(row.atualizado_em ?? ''),
    lead_id: row.lead_id == null ? null : Number(row.lead_id),
    fixado: row.fixado === true,
    ordem_topo: row.ordem_topo == null ? null : Number(row.ordem_topo),
  };
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
      await getOrCreateComposicaoOrcamentoFolder(schemaEmpresa);

      const { data, error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => mapFolder(row as Record<string, unknown>));
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
          lead_id: null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapFolder(data as Record<string, unknown>);
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

  const pinMutation = useMutation({
    mutationFn: async ({ id, fixado }: { id: string; fixado: boolean }) => {
      const ordem = fixado ? proximaOrdemPinBiblioteca(query.data ?? []) : 0;
      const { error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .update({ fixado, ordem_topo: ordem } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      invalidate();
      toast({ title: vars.fixado ? 'Pasta nas favoritas' : 'Pasta saiu do topo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Não deu para fixar a pasta', description: error.message, variant: 'destructive' });
    },
  });

  const reorderPinsMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const total = orderedIds.length;
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await db
          .from(mediasConfig.foldersTable as 'marketing_media_folders')
          .update({ ordem_topo: total - i } as never)
          .eq('id', orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => {
      toast({ title: 'Não deu para reordenar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Pasta removida. Os arquivos ficaram sem pasta.' });
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
    pinFolder: pinMutation.mutateAsync,
    reorderPinnedFolders: reorderPinsMutation.mutateAsync,
    deleteFolder: deleteMutation.mutateAsync,
  };
}
