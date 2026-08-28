import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import { normalizeFolderName } from '@/lib/lead-media-folders';
import type { MarketingMediaFolder } from '@/hooks/useMarketingMediaFolders';
import { toast } from 'sonner';

export type LeadMediaFolder = MarketingMediaFolder;

function leadFoldersQueryKey(schemaEmpresa: string | null | undefined, leadId: number) {
  return ['lead-media-folders', schemaEmpresa ?? 'master', leadId] as const;
}

export function useLeadMediaFolders(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);
  const enabled = queriesReady && typeof leadId === 'number';

  const query = useQuery({
    queryKey: leadId ? leadFoldersQueryKey(schemaEmpresa, leadId) : ['lead-media-folders', 'idle'],
    enabled,
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .select('*')
        .eq('lead_id', leadId)
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as LeadMediaFolder[];
    },
  });

  const invalidate = (targetLeadId = leadId) => {
    if (typeof targetLeadId === 'number') {
      queryClient.invalidateQueries({
        queryKey: leadFoldersQueryKey(schemaEmpresa, targetLeadId),
      });
    }
    queryClient.invalidateQueries({ queryKey: ['marketing-media-folders'] });
    queryClient.invalidateQueries({ queryKey: ['biblioteca-medias'] });
  };

  const createMutation = useMutation({
    mutationFn: async (folder: { nome: string; descricao?: string | null }) => {
      if (!leadId) throw new Error('Salve o lead antes de criar pastas');
      const nome = normalizeFolderName(folder.nome);
      if (!nome) throw new Error('Dê um nome para a pasta');

      const duplicated = (query.data ?? []).some(
        (item) => item.nome.trim().toLowerCase() === nome.toLowerCase(),
      );
      if (duplicated) {
        throw new Error('Já existe uma pasta com esse nome neste lead');
      }

      const { data, error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .insert({
          nome,
          descricao: folder.descricao?.trim() || null,
          lead_id: leadId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LeadMediaFolder;
    },
    onSuccess: (created) => {
      invalidate();
      toast.success(`Pasta “${created.nome}” criada`);
    },
    onError: (error: Error) => {
      toast.error('Não foi possível criar a pasta', { description: error.message });
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
      const nextNome = normalizeFolderName(nome);
      if (!nextNome) throw new Error('Dê um nome para a pasta');
      const { error } = await db
        .from(mediasConfig.foldersTable as 'marketing_media_folders')
        .update({ nome: nextNome, descricao: descricao?.trim() || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Pasta atualizada');
    },
    onError: (error: Error) => {
      toast.error('Não foi possível atualizar a pasta', { description: error.message });
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
      queryClient.invalidateQueries({ queryKey: ['lead-pdfs'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
      toast.success('Pasta removida. Os arquivos ficaram sem pasta.');
    },
    onError: (error: Error) => {
      toast.error('Não foi possível remover a pasta', { description: error.message });
    },
  });

  return {
    folders: query.data ?? [],
    isLoading: query.isLoading,
    createFolder: createMutation.mutateAsync,
    updateFolder: updateMutation.mutateAsync,
    deleteFolder: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
