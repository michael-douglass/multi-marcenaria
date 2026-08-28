import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresaTable } from '@/hooks/useEmpresaTable';
import { WHITEBOARD_ANNOTATION_PREFIX, getDrawingPathData } from '@/lib/whiteboard-annotations';
import { 
  savePendingImage, 
  listPendingImages, 
  removePendingImage, 
  savePendingDrawing,
  listPendingDrawings,
  removePendingDrawing,
  type PendingImage,
  type PendingDrawing
} from '@/lib/offline-storage';
import {
  isLikelyImageFile,
  loadImageDimensionsFromFile,
  prepareWhiteboardImageForUpload,
  WHITEBOARD_MAX_IMAGE_BYTES,
} from '@/lib/whiteboard-image-upload';

export interface LeadWhiteboardImage {
  id: string;
  lead_id: number;
  file_url: string;
  file_name: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  criado_em: string;
  isOffline?: boolean; // Indica se é uma imagem salva localmente aguardando sync
}

export interface LeadWhiteboardDrawing {
  id: string;
  lead_id: number;
  path_data: string;
  cor: string;
  stroke_width: number;
  criado_em: string;
}

const STORAGE_BUCKET = 'marketing-medias';
const MAX_IMAGE_BYTES = WHITEBOARD_MAX_IMAGE_BYTES;

const emptyBoard = {
  images: [] as LeadWhiteboardImage[],
  drawings: [] as LeadWhiteboardDrawing[],
};

function formatWhiteboardError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return 'Não foi possível salvar na lousa';
}

export function useLeadWhiteboard(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const { whiteboard_images: imagesTable, whiteboard_drawings: drawingsTable } = useEmpresaTable();
  const queryKey = ['lead-whiteboard', schemaEmpresa ?? 'master', leadId] as const;

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncingImages, setSyncingImages] = useState(false);
  const [syncingDrawings, setSyncingDrawings] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!leadId) return emptyBoard;

      try {
        const [imagesRes, drawingsRes] = await Promise.all([
          db.from(imagesTable).select('*').eq('lead_id', leadId).order('z_index', { ascending: true }),
          db.from(drawingsTable).select('*').eq('lead_id', leadId).order('criado_em', { ascending: true }),
        ]);

        if (imagesRes.error) throw imagesRes.error;
        if (drawingsRes.error) throw drawingsRes.error;

        const [pendingImages, pendingDrawings] = await Promise.all([
          listPendingImages().catch(() => [] as PendingImage[]),
          listPendingDrawings().catch(() => [] as PendingDrawing[]),
        ]);

        const offlineImages: LeadWhiteboardImage[] = pendingImages
          .filter(p => p.leadId === leadId)
          .map(p => ({
            id: p.id,
            lead_id: p.leadId,
            file_url: URL.createObjectURL(p.file),
            file_name: p.fileName,
            position_x: 24 + (p.placementIndex % 4) * 48,
            position_y: 24 + Math.floor(p.placementIndex / 4) * 48,
            width: 300,
            height: 200,
            z_index: 9999,
            criado_em: new Date(p.timestamp).toISOString(),
            isOffline: true,
          }));

        // Converte desenhos pendentes (offline) em registros visíveis
        const offlineDrawings: LeadWhiteboardDrawing[] = pendingDrawings
          .filter(p => p.leadId === leadId)
          .map(p => ({
            id: p.id,
            lead_id: p.leadId,
            path_data: p.path_data,
            cor: p.cor,
            stroke_width: p.stroke_width,
            criado_em: new Date(p.timestamp).toISOString(),
          }));

        const serverDrawings = (drawingsRes.data || []) as LeadWhiteboardDrawing[];
        const allDrawings = [...serverDrawings];
        offlineDrawings.forEach(od => {
          const idx = allDrawings.findIndex(sd => sd.id === od.id);
          if (idx >= 0) allDrawings[idx] = od;
          else allDrawings.push(od);
        });

        return {
          images: [...(imagesRes.data || []), ...offlineImages] as LeadWhiteboardImage[],
          drawings: allDrawings,
        };
      } catch (error) {
        console.warn('[whiteboard] Falha ao carregar lousa:', error);
        const previous = queryClient.getQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(queryKey);
        if (previous) return previous;

        const [pImages, pDrawings] = await Promise.all([listPendingImages(), listPendingDrawings()]);
        
        const offlineImages: LeadWhiteboardImage[] = pImages
          .filter(p => p.leadId === leadId)
          .map(p => ({
            id: p.id,
            lead_id: p.leadId,
            file_url: URL.createObjectURL(p.file),
            file_name: p.fileName,
            position_x: 24 + (p.placementIndex % 4) * 48,
            position_y: 24 + Math.floor(p.placementIndex / 4) * 48,
            width: 300,
            height: 200,
            z_index: 9999,
            criado_em: new Date(p.timestamp).toISOString(),
            isOffline: true,
          }));

        const offlineDrawings: LeadWhiteboardDrawing[] = pDrawings
          .filter(p => p.leadId === leadId)
          .map(p => ({
            id: p.id,
            lead_id: p.leadId,
            path_data: p.path_data,
            cor: p.cor,
            stroke_width: p.stroke_width,
            criado_em: new Date(p.timestamp).toISOString(),
          }));
        
        return {
          images: offlineImages,
          drawings: offlineDrawings,
        };
      }
    },
    enabled: !!leadId,
    retry: 1,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addDrawingMutation = useMutation({
    mutationFn: async (payload: { path_data: string; cor: string; stroke_width: number }) => {
      if (!leadId) throw new Error('Lead não salvo');
      
      if (!isOnline) {
        const id = `tmp_off_${Date.now()}`;
        await savePendingDrawing({
          id,
          leadId,
          ...payload,
          timestamp: Date.now(),
        });
        return { id, lead_id: leadId, ...payload, criado_em: new Date().toISOString() } as LeadWhiteboardDrawing;
      }

      const { data, error } = await db
        .from(drawingsTable)
        .insert({ lead_id: leadId, ...payload })
        .select()
        .single();
      if (error) throw error;
      return data as LeadWhiteboardDrawing;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(queryKey);

      // Após bind WB_IMG:, o prefixo de anotação fica no path interno — sem otimista evita flicker
      // e reduz a chance de “pontos” voltarem após “Limpar desenhos”.
      if (getDrawingPathData(payload.path_data).startsWith(WHITEBOARD_ANNOTATION_PREFIX)) {
        return { previous };
      }

      const optimistic: LeadWhiteboardDrawing = {
        id: `tmp_${Date.now()}`,
        lead_id: leadId as number,
        ...payload,
        criado_em: new Date().toISOString(),
      };
      queryClient.setQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(
        queryKey,
        (old) => (old ? { ...old, drawings: [...old.drawings, optimistic] } : old),
      );
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(
        queryKey,
        (old) => {
          if (!old) return old;
          const withoutTmp = old.drawings.filter((d) => !d.id.startsWith('tmp'));
          const withoutDup = withoutTmp.filter((d) => d.id !== data.id);
          return { ...old, drawings: [...withoutDup, data] };
        },
      );
    },
    retry: 3,
  });

  const updateDrawingMutation = useMutation({
    mutationFn: async ({
      id,
      path_data,
      cor,
      stroke_width,
    }: {
      id: string;
      path_data?: string;
      cor?: string;
      stroke_width?: number;
    }) => {
      if (!isOnline) {
        const drawings = query.data?.drawings || [];
        const existing = drawings.find(d => d.id === id);
        if (existing) {
          await savePendingDrawing({
            id,
            leadId: leadId!,
            path_data: path_data ?? existing.path_data,
            cor: cor ?? existing.cor,
            stroke_width: stroke_width ?? existing.stroke_width,
            timestamp: Date.now(),
            isUpdate: !id.startsWith('tmp_off'),
          });
        }
        return;
      }

      const updates: Record<string, string | number> = {};
      if (path_data !== undefined) updates.path_data = path_data;
      if (cor !== undefined) updates.cor = cor;
      if (stroke_width !== undefined) updates.stroke_width = stroke_width;
      const { error } = await db.from(drawingsTable).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_void, variables) => {
      queryClient.setQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            drawings: old.drawings.map((d) => {
              if (d.id !== variables.id) return d;
              return {
                ...d,
                ...(variables.path_data !== undefined ? { path_data: variables.path_data } : {}),
                ...(variables.cor !== undefined ? { cor: variables.cor } : {}),
                ...(variables.stroke_width !== undefined
                  ? { stroke_width: variables.stroke_width }
                  : {}),
              };
            }),
          };
        },
      );
    },
    onError: (error) => {
      if (isOnline) {
        toast.error('Erro ao atualizar elemento', { description: formatWhiteboardError(error) });
      }
    },
    retry: 3,
  });

  const deleteDrawingMutation = useMutation({
    mutationFn: async (id: string) => {
      // IDs temporários / offline não existem (ou ainda não) como linha no Postgres.
      if (id.startsWith('tmp')) {
        try {
          await removePendingDrawing(id);
        } catch {
          /* ignore */
        }
        return;
      }
      const { error } = await db.from(drawingsTable).delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, {
          ...previous,
          drawings: previous.drawings.filter((d) => d.id !== id),
        });
      }
      return { previous };
    },
    onError: (error, _id, context) => {
      if (isOnline && context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
        toast.error('Erro ao apagar traço', { description: formatWhiteboardError(error) });
      }
    },
    retry: 1,
  });

  const restoreDrawingMutation = useMutation({
    mutationFn: async (drawing: {
      path_data: string;
      cor: string;
      stroke_width: number;
    }) => {
      if (!leadId) throw new Error('Lead não salvo');
      const { data, error } = await db
        .from(drawingsTable)
        .insert({ lead_id: leadId, ...drawing })
        .select()
        .single();
      if (error) throw error;
      return data as LeadWhiteboardDrawing;
    },
    onMutate: async (drawing) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(queryKey);
      const optimistic: LeadWhiteboardDrawing = {
        id: `tmp_${Date.now()}`,
        lead_id: leadId as number,
        ...drawing,
        criado_em: new Date().toISOString(),
      };
      queryClient.setQueryData<{ images: LeadWhiteboardImage[]; drawings: LeadWhiteboardDrawing[] }>(
        queryKey,
        (old) => (old ? { ...old, drawings: [...old.drawings, optimistic] } : old),
      );
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (isOnline && context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
        toast.error('Erro ao restaurar desenho', { description: formatWhiteboardError(error) });
      }
    },
    onSuccess: invalidate,
    retry: 3,
  });

  const clearDrawingsMutation = useMutation({
    mutationFn: async (ids?: string[]) => {
      if (!leadId) return;

      const targetIds = ids?.length
        ? ids
        : (queryClient.getQueryData<{ drawings: LeadWhiteboardDrawing[] }>(queryKey)?.drawings ?? []).map(
            (d) => d.id,
          );

      // IDs locais (tmp_) não existem no banco — só limpar offline storage quando houver.
      for (const id of targetIds) {
        if (id.startsWith('tmp')) {
          try {
            await removePendingDrawing(id);
          } catch {
            /* ignore */
          }
        }
      }

      const realIds = targetIds.filter((id) => !id.startsWith('tmp'));
      if (realIds.length === 0 && ids?.length) return;

      if (ids?.length) {
        if (realIds.length === 0) return;
        const { error } = await db.from(drawingsTable).delete().in('id', realIds);
        if (error) throw error;
        return;
      }

      const { error } = await db.from(drawingsTable).delete().eq('lead_id', leadId);
      if (error) throw error;
    },
    onMutate: async (ids?: string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{
        images: LeadWhiteboardImage[];
        drawings: LeadWhiteboardDrawing[];
      }>(queryKey);

      if (previous) {
        const idSet = ids?.length ? new Set(ids) : null;
        queryClient.setQueryData(queryKey, {
          ...previous,
          drawings: idSet
            ? previous.drawings.filter((d) => !idSet.has(d.id))
            : [],
        });
      }

      return { previous };
    },
    onSuccess: invalidate,
    onError: (error, _ids, context) => {
      if (isOnline && context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
        toast.error('Erro ao limpar desenhos', { description: formatWhiteboardError(error) });
      }
    },
    retry: 1,
  });

  const updateImageMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      position_x?: number;
      position_y?: number;
      width?: number;
      height?: number;
      z_index?: number;
    }) => {
      const { id, ...updates } = payload;
      const { error } = await db
        .from(imagesTable)
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => {
      if (isOnline) {
        toast.error('Erro ao mover imagem', { description: formatWhiteboardError(error) });
      }
    },
    retry: 3,
  });

  const deleteImageMutation = useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl: string }) => {
      // Só remove do Storage se o arquivo foi enviado pela própria lousa (path leads/{leadId}/...).
      // Imagens importadas dos anexos/projeto compartilham o arquivo original e não devem ser apagadas.
      try {
        const url = new URL(fileUrl);
        const match = url.pathname.match(/\/storage\/v1\/object\/public\/marketing-medias\/(.+)/);
        if (match) {
          const storagePath = decodeURIComponent(match[1]);
          const ownedByWhiteboard = leadId
            ? storagePath.startsWith(`leads/${leadId}/`)
            : storagePath.startsWith('leads/');
          if (ownedByWhiteboard) {
            await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
          }
        }
      } catch {
        /* ignore storage cleanup errors */
      }
      const { error } = await db.from(imagesTable).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => {
      if (isOnline) {
        toast.error('Erro ao remover imagem', { description: formatWhiteboardError(error) });
      }
    },
    retry: 3,
  });

  const uploadImage = useCallback(
    async (
      file: File,
      boardWidth: number,
      placementIndex = 0,
      isSyncing = false,
    ): Promise<void> => {
      if (!leadId) {
        toast.error('Salve o lead antes de adicionar fotos');
        return;
      }

      let prepared: File;
      try {
        prepared = await prepareWhiteboardImageForUpload(file);
      } catch (prepError) {
        const message = formatWhiteboardError(prepError);
        if (!isSyncing) {
          toast.error('Não foi possível usar esta foto', { description: message });
          return;
        }
        throw prepError;
      }

      if (!isLikelyImageFile(prepared)) {
        toast.error('Envie apenas imagens (foto, print, etc.)');
        return;
      }
      if (prepared.size > MAX_IMAGE_BYTES) {
        toast.error('Imagem muito grande (máx. 15MB)');
        return;
      }

      if (!isOnline && !isSyncing) {
        const id = `off_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await savePendingImage({
          id,
          leadId,
          file: prepared,
          fileName: prepared.name,
          boardWidth,
          placementIndex,
          timestamp: Date.now(),
        });
        invalidate();
        toast.success('Imagem salva localmente (sem internet). Será enviada quando você estiver online.');
        return;
      }

      try {
        const ext = prepared.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `leads/${leadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const contentType = prepared.type || 'image/jpeg';

        // Dimensões pelo arquivo local — no tablet a URL pública às vezes demora/falha ao decodificar.
        const dimensions = await loadImageDimensionsFromFile(prepared);

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, prepared, {
            upsert: false,
            contentType,
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

        const maxW = Math.min(Math.max(boardWidth, 640), 1600, dimensions.width);
        const scale = Math.min(1, maxW / dimensions.width);
        const width = Math.round(dimensions.width * scale);
        const height = Math.round(dimensions.height * scale);

        const zIndex = (query.data?.images.length ?? 0) + placementIndex + 1;

        const { error: insertError } = await db.from(imagesTable).insert({
          lead_id: leadId,
          file_url: publicUrl,
          file_name: prepared.name,
          position_x: 0,
          position_y: 0,
          width,
          height,
          z_index: zIndex,
        });

        if (insertError) throw insertError;

        if (!isSyncing) {
          invalidate();
          toast.success('Foto adicionada');
        }
      } catch (error) {
        const message = formatWhiteboardError(error);
        if (!isSyncing) {
          toast.error('Erro ao enviar imagem', { description: message });
        } else {
          throw error;
        }
      }
    },
    [leadId, isOnline, query.data?.images.length, db, imagesTable, queryClient, queryKey],
  );

  /** Insere uma imagem do projeto (anexo/IA) na lousa sem reenviar o arquivo ao Storage. */
  const importImageFromUrl = useCallback(
    async (payload: {
      fileUrl: string;
      fileName: string;
      boardWidth: number;
    }): Promise<LeadWhiteboardImage | null> => {
      if (!leadId) {
        toast.error('Salve o lead antes de adicionar fotos');
        return null;
      }
      if (!payload.fileUrl) {
        toast.error('Imagem inválida');
        return null;
      }

      try {
        const dimensions = await loadImageDimensions(payload.fileUrl);
        const maxW = Math.min(Math.max(payload.boardWidth, 640), 1600, dimensions.width);
        const scale = Math.min(1, maxW / dimensions.width);
        const width = Math.round(dimensions.width * scale);
        const height = Math.round(dimensions.height * scale);
        const zIndex = (query.data?.images.length ?? 0) + 1;

        const { data, error } = await db
          .from(imagesTable)
          .insert({
            lead_id: leadId,
            file_url: payload.fileUrl,
            file_name: payload.fileName || 'imagem-projeto.jpg',
            position_x: 0,
            position_y: 0,
            width,
            height,
            z_index: zIndex,
          })
          .select()
          .single();

        if (error) throw error;

        invalidate();
        toast.success('Imagem do projeto adicionada à lousa');
        return data as LeadWhiteboardImage;
      } catch (error) {
        toast.error('Erro ao importar imagem', {
          description: formatWhiteboardError(error),
        });
        return null;
      }
    },
    [leadId, query.data?.images.length, db, imagesTable, queryClient, queryKey],
  );

  /** Remove todas as fotos e desenhos da lousa do lead. */
  const clearWhiteboard = useCallback(async () => {
    if (!leadId) return;

    const imagesSnapshot = [...(query.data?.images ?? [])];

    const { error: drawingsError } = await db.from(drawingsTable).delete().eq('lead_id', leadId);
    if (drawingsError) {
      toast.error('Erro ao limpar desenhos', {
        description: formatWhiteboardError(drawingsError),
      });
      throw drawingsError;
    }

    for (const image of imagesSnapshot) {
      if (image.isOffline) {
        try {
          await removePendingImage(image.id);
        } catch {
          /* ignore offline cleanup */
        }
        continue;
      }
      await deleteImageMutation.mutateAsync({ id: image.id, fileUrl: image.file_url });
    }

    invalidate();
  }, [leadId, query.data?.images, db, drawingsTable, deleteImageMutation, queryClient, queryKey]);

  const syncPendingImages = useCallback(async () => {
    if (!isOnline || syncingImages || !leadId) return;
    const pending = await listPendingImages();
    const currentLeadPending = pending.filter((p) => p.leadId === leadId);
    if (currentLeadPending.length === 0) return;

    setSyncingImages(true);
    toast.info(`Sincronizando ${currentLeadPending.length} imagens pendentes...`);

    for (const item of currentLeadPending) {
      try {
        await uploadImage(item.file, item.boardWidth, item.placementIndex, true);
        await removePendingImage(item.id);
      } catch (err) {
        console.error('[whiteboard] Erro ao sincronizar imagem:', err);
      }
    }

    setSyncingImages(false);
    invalidate();
  }, [isOnline, syncingImages, leadId, uploadImage, queryClient, queryKey]);

  const syncPendingDrawings = useCallback(async () => {
    if (!isOnline || syncingDrawings || !leadId) return;
    const pending = await listPendingDrawings();
    const currentLeadPending = pending.filter((p) => p.leadId === leadId);
    if (currentLeadPending.length === 0) return;

    setSyncingDrawings(true);
    toast.info(`Sincronizando ${currentLeadPending.length} desenhos pendentes...`);

    for (const item of currentLeadPending) {
      try {
        if (item.isUpdate) {
          await updateDrawingMutation.mutateAsync({
            id: item.id,
            path_data: item.path_data,
            cor: item.cor,
            stroke_width: item.stroke_width,
          });
        } else {
          await addDrawingMutation.mutateAsync({
            path_data: item.path_data,
            cor: item.cor,
            stroke_width: item.stroke_width,
          });
        }
        await removePendingDrawing(item.id);
      } catch (err) {
        console.error('[whiteboard] Erro ao sincronizar desenho:', err);
      }
    }
    setSyncingDrawings(false);
    invalidate();
  }, [isOnline, syncingDrawings, leadId, updateDrawingMutation, addDrawingMutation]);

  useEffect(() => {
    if (isOnline) {
      void syncPendingImages();
      void syncPendingDrawings();
    }
  }, [isOnline, syncPendingImages, syncPendingDrawings]);

  return {
    images: query.data?.images ?? [],
    drawings: query.data?.drawings ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    addDrawing: addDrawingMutation.mutateAsync,
    updateDrawing: updateDrawingMutation.mutateAsync,
    deleteDrawing: deleteDrawingMutation.mutateAsync,
    restoreDrawing: restoreDrawingMutation.mutateAsync,
    clearDrawings: clearDrawingsMutation.mutateAsync,
    clearWhiteboard,
    updateImage: updateImageMutation.mutateAsync,
    deleteImage: deleteImageMutation.mutateAsync,
    uploadImage,
    importImageFromUrl,
    isOnline,
    isSaving:
      addDrawingMutation.isPending ||
      updateImageMutation.isPending ||
      updateDrawingMutation.isPending ||
      deleteImageMutation.isPending ||
      syncingImages,
  };
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Não foi possível ler as dimensões da imagem'));
    img.src = url;
  });
}
