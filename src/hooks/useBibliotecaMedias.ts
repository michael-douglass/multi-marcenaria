import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import {
  PUBLIC_WHITEBOARD,
  resolveMarketingMediasConfig,
  resolveScopedTableName,
} from '@/lib/empresa-tables';
import { getBibliotecaFileSizeError } from '@/lib/biblioteca-utils';
import { toast } from '@/hooks/use-toast';

export type BibliotecaMediaOrigem = 'biblioteca' | 'lead_anexo' | 'lead_whiteboard';

export interface BibliotecaMedia {
  id: string;
  sourceId: string;
  titulo: string;
  tipo: 'imagem' | 'video' | 'audio' | 'pdf';
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  folder_id: string | null;
  criado_em: string;
  origem: BibliotecaMediaOrigem;
  lead_id: number | null;
  fixado: boolean;
  ordem_topo: number | null;
}

const STORAGE_BUCKET = 'marketing-medias';

function mapMarketingMedia(row: Record<string, unknown>): BibliotecaMedia {
  const leadId = (row.lead_id as number | null) ?? null;
  const sourceId = row.id as string;
  return {
    id: `mm:${sourceId}`,
    sourceId,
    titulo: (row.titulo as string) || (row.file_name as string) || 'Sem título',
    tipo: row.tipo as BibliotecaMedia['tipo'],
    file_url: row.file_url as string,
    file_name: (row.file_name as string) || 'arquivo',
    file_size: (row.file_size as number | null) ?? null,
    mime_type: (row.mime_type as string | null) ?? null,
    folder_id: (row.folder_id as string | null) ?? null,
    criado_em: row.criado_em as string,
    origem: leadId ? 'lead_anexo' : 'biblioteca',
    lead_id: leadId,
    fixado: row.fixado === true,
    ordem_topo: row.ordem_topo == null ? null : Number(row.ordem_topo),
  };
}

function mapWhiteboardImage(row: Record<string, unknown>): BibliotecaMedia {
  const sourceId = row.id as string;
  const fileName = (row.file_name as string) || 'lousa.jpg';
  return {
    id: `wb:${sourceId}`,
    sourceId,
    titulo: fileName.replace(/\.[^.]+$/, '') || 'Foto do lead',
    tipo: 'imagem',
    file_url: row.file_url as string,
    file_name: fileName,
    file_size: null,
    mime_type: null,
    folder_id: null,
    criado_em: row.criado_em as string,
    origem: 'lead_whiteboard',
    lead_id: (row.lead_id as number) ?? null,
    fixado: false,
    ordem_topo: null,
  };
}

async function removeStorageFile(fileUrl: string): Promise<void> {
  try {
    const url = new URL(fileUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/marketing-medias\/(.+)/);
    if (match) {
      await supabase.storage.from(STORAGE_BUCKET).remove([decodeURIComponent(match[1])]);
    }
  } catch {
    /* ignore storage cleanup errors */
  }
}

export function useBibliotecaMedias() {
  const queryClient = useQueryClient();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);

  const queryKey = ['biblioteca-medias', schemaEmpresa ?? 'master'] as const;

  const query = useQuery({
    queryKey,
    enabled: queriesReady,
    queryFn: async (): Promise<BibliotecaMedia[]> => {
      const items: BibliotecaMedia[] = [];

      try {
        const { data, error } = await db
          .from(mediasConfig.mediasTable as 'marketing_medias')
          .select('*')
          .order('criado_em', { ascending: false });

        if (error) throw error;
        for (const row of data ?? []) {
          items.push(mapMarketingMedia(row as Record<string, unknown>));
        }
      } catch (err) {
        console.error('[biblioteca] Erro ao carregar mídias:', err);
      }

      try {
        const whiteboardTable = resolveScopedTableName(
          schemaEmpresa,
          'lead_whiteboard_images',
          PUBLIC_WHITEBOARD.images,
        );
        const { data, error } = await db
          .from(whiteboardTable as 'lead_whiteboard_images')
          .select('id, lead_id, file_url, file_name, criado_em')
          .order('criado_em', { ascending: false });

        if (error) throw error;
        for (const row of data ?? []) {
          items.push(mapWhiteboardImage(row as Record<string, unknown>));
        }
      } catch (err) {
        console.error('[biblioteca] Erro ao carregar fotos de leads:', err);
      }

      return items.sort(
        (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
      );
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
  };

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      titulo,
      folderId,
      leadId,
    }: {
      file: File;
      titulo: string;
      folderId?: string | null;
      leadId?: number | null;
    }) => {
      const sizeError = getBibliotecaFileSizeError(file);
      if (sizeError) throw new Error(sizeError);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

      // Upload da Biblioteca: imagem, vídeo, áudio ou PDF.
      let tipo: BibliotecaMedia['tipo'] = 'imagem';
      if (file.type.startsWith('video/')) tipo = 'video';
      else if (file.type.startsWith('audio/')) tipo = 'audio';
      else if (file.type === 'application/pdf') tipo = 'pdf';

      const { data, error } = await db
        .from(mediasConfig.mediasTable as 'marketing_medias')
        .insert({
          titulo,
          tipo,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || (tipo === 'imagem' ? 'image/jpeg' : null),
          folder_id: folderId ?? null,
          lead_id: leadId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return mapMarketingMedia(data as Record<string, unknown>);
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['biblioteca-composicao-orcamento'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao enviar arquivo', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (media: BibliotecaMedia) => {
      await removeStorageFile(media.file_url);

      if (media.origem === 'lead_whiteboard') {
        const whiteboardTable = resolveScopedTableName(
          schemaEmpresa,
          'lead_whiteboard_images',
          PUBLIC_WHITEBOARD.images,
        );
        const { error } = await db
          .from(whiteboardTable as 'lead_whiteboard_images')
          .delete()
          .eq('id', media.sourceId);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from(mediasConfig.mediasTable as 'marketing_medias')
        .delete()
        .eq('id', media.sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['lead-whiteboard'] });
      queryClient.invalidateQueries({ queryKey: ['lead-pdfs'] });
      toast({ title: 'Arquivo removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover arquivo', description: error.message, variant: 'destructive' });
    },
  });

  const uploadFile = async (
    file: File,
    titulo: string,
    folderId?: string | null,
    leadId?: number | null,
  ) => {
    return uploadMutation.mutateAsync({ file, titulo, folderId, leadId });
  };

  const deleteMedia = async (media: BibliotecaMedia) => {
    await deleteMutation.mutateAsync(media);
  };

  return {
    medias: query.data ?? [],
    isLoading: query.isLoading,
    uploadFile,
    deleteMedia,
  };
}
