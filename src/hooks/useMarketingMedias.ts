import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface MarketingMedia {
  id: string;
  titulo: string;
  tipo: 'imagem' | 'video' | 'audio' | 'pdf';
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  folder_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function useMarketingMedias() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketing-medias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_medias')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data as MarketingMedia[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (media: {
      titulo: string;
      tipo: 'imagem' | 'video' | 'audio' | 'pdf';
      file_url: string;
      file_name: string;
      file_size?: number | null;
      mime_type?: string | null;
      folder_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_medias')
        .insert({
          titulo: media.titulo,
          tipo: media.tipo,
          file_url: media.file_url,
          file_name: media.file_name,
          file_size: media.file_size ?? null,
          mime_type: media.mime_type ?? null,
          folder_id: media.folder_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingMedia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
      toast({ title: 'Mídia salva com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar mídia', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, titulo, folder_id }: { id: string; titulo?: string; folder_id?: string | null }) => {
      const updateData: { titulo?: string; folder_id?: string | null } = {};
      if (titulo !== undefined) updateData.titulo = titulo;
      if (folder_id !== undefined) updateData.folder_id = folder_id;
      
      const { error } = await supabase
        .from('crm_multiempresas_marketing_medias')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
      toast({ title: 'Mídia atualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar mídia', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First get the media to know the file path
      const { data: media } = await supabase
        .from('crm_multiempresas_marketing_medias')
        .select('file_url')
        .eq('id', id)
        .single();

      // Delete from storage if it's a supabase URL
      if (media?.file_url) {
        const url = new URL(media.file_url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/marketing-medias\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from('marketing-medias').remove([pathMatch[1]]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('crm_multiempresas_marketing_medias')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
      toast({ title: 'Mídia removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover mídia', description: error.message, variant: 'destructive' });
    },
  });

  const uploadFile = async (file: File, titulo: string, folderId?: string | null): Promise<MarketingMedia | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('marketing-medias')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('marketing-medias')
        .getPublicUrl(fileName);

      // Determine tipo based on mime type
      let tipo: 'imagem' | 'video' | 'audio' | 'pdf' = 'imagem';
      if (file.type.startsWith('video/')) {
        tipo = 'video';
      } else if (file.type.startsWith('audio/')) {
        tipo = 'audio';
      } else if (file.type === 'application/pdf') {
        tipo = 'pdf';
      }

      const result = await createMutation.mutateAsync({
        titulo,
        tipo,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        folder_id: folderId ?? null,
      });

      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ title: 'Erro ao fazer upload', description: String(error), variant: 'destructive' });
      return null;
    }
  };

  return {
    medias: query.data || [],
    isLoading: query.isLoading,
    createMedia: createMutation.mutateAsync,
    updateMedia: updateMutation.mutateAsync,
    deleteMedia: deleteMutation.mutateAsync,
    uploadFile,
  };
}
