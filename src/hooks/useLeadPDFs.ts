import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import {
  clearPdfCacheKey,
  migratePdfCacheKey,
  pdfCacheKeyForMedia,
  pdfCacheKeyForPending,
  prewarmPdfThumbnail,
} from '@/lib/pdf-image-cache';
import { toast } from 'sonner';
import { bumpLeadKnowledgeReindex } from '@/lib/lead-knowledge-reindex';
import { normalizeFolderName } from '@/lib/lead-media-folders';

export type LeadAttachmentTipo = 'pdf' | 'imagem' | 'video';

export interface LeadPDF {
  id: string;
  titulo: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  lead_id: number;
  folder_id: string | null;
  criado_em: string;
  tipo: LeadAttachmentTipo;
  mime_type: string | null;
}

export interface PendingLeadPDF {
  tempId: string;
  file: File;
  previewUrl: string;
  tipo: LeadAttachmentTipo;
  /** Gaveta escolhida; null = Sem pasta. Ausente = ainda não decidido. */
  folderId?: string | null;
  /** Nome digitado antes do lead existir no banco. */
  folderName?: string;
}

const MAX_ATTACHMENT_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
const STORAGE_BUCKET = 'marketing-medias';
const LEAD_ATTACHMENT_TIPOS: LeadAttachmentTipo[] = ['pdf', 'imagem', 'video'];

export function getLeadAttachmentTipo(file: File): LeadAttachmentTipo | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'imagem';
  if (file.type.startsWith('video/')) return 'video';
  // Extensão de fallback (alguns Chromes entregam type vazio em File de Blob).
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (/\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(name)) return 'imagem';
  if (/\.(mp4|webm|mov|m4v|mkv)$/i.test(name)) return 'video';
  return null;
}

export function isVideoAttachment(item: {
  tipo?: LeadAttachmentTipo;
  mime_type?: string | null;
  file?: File;
}): boolean {
  if (item.tipo === 'video') return true;
  if (item.mime_type?.startsWith('video/')) return true;
  if (item.file) return item.file.type.startsWith('video/');
  return false;
}

export function isPdfAttachment(item: {
  tipo?: LeadAttachmentTipo;
  mime_type?: string | null;
  file?: File;
}): boolean {
  if (item.tipo === 'imagem' || item.tipo === 'video') return false;
  if (item.tipo === 'pdf') return true;
  if (item.mime_type?.startsWith('image/')) return false;
  if (item.mime_type?.startsWith('video/')) return false;
  if (item.file) return item.file.type === 'application/pdf';
  return true;
}

export function getLeadAttachmentViewKind(item: {
  tipo?: LeadAttachmentTipo;
  mime_type?: string | null;
  file?: File;
}): 'pdf' | 'image' | 'video' {
  if (isVideoAttachment(item)) return 'video';
  if (isPdfAttachment(item)) return 'pdf';
  return 'image';
}

function getMarketingDb(schema: string | null) {
  return schema ? supabase.schema(schema) : supabase;
}

function validateAttachmentFile(file: File): string | null {
  const tipo = getLeadAttachmentTipo(file);
  if (!tipo) {
    return 'Apenas PDF, imagens (JPG, PNG, WebP, GIF) e vídeos (MP4, WebM) são permitidos';
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return 'Arquivo muito grande (máx. 200MB)';
  }
  return null;
}

function fileExtension(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : null;
  if (fromName) return fromName.toLowerCase();
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'video/webm') return 'webm';
  if (file.type.startsWith('video/')) return 'mp4';
  return 'jpg';
}

function buildStoragePath(schema: string | null, fileName: string): string {
  const prefix = schema ?? 'master';
  return `${prefix}/${fileName}`;
}

async function ensureLeadFolderId(
  schema: string | null,
  foldersTable: string,
  leadId: number,
  nomeBruto: string,
): Promise<string> {
  const nome = normalizeFolderName(nomeBruto);
  if (!nome) throw new Error('Dê um nome para a pasta');
  const db = getMarketingDb(schema);
  const { data: rows, error: listError } = await db
    .from(foldersTable)
    .select('id, nome')
    .eq('lead_id', leadId);
  if (listError) throw listError;
  const existing = (rows ?? []).find(
    (row) => String(row.nome).trim().toLowerCase() === nome.toLowerCase(),
  );
  if (existing?.id) return String(existing.id);

  const { data: created, error } = await db
    .from(foldersTable)
    .insert({ nome, lead_id: leadId })
    .select('id')
    .single();
  if (error) throw error;
  return String(created.id);
}

export function useLeadPDFs(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);
  const [pendingPdfs, setPendingPdfs] = useState<PendingLeadPDF[]>([]);

  const clearPendingPdfs = useCallback(() => {
    setPendingPdfs((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }, []);

  useEffect(() => {
    if (leadId) {
      clearPendingPdfs();
    }
  }, [leadId, clearPendingPdfs]);

  useEffect(() => () => clearPendingPdfs(), [clearPendingPdfs]);

  const query = useQuery({
    queryKey: ['lead-pdfs', schemaEmpresa ?? 'master', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const db = getMarketingDb(mediasConfig.schema);
      const { data, error } = await db
        .from(mediasConfig.mediasTable)
        .select('*')
        .eq('lead_id', leadId)
        .in('tipo', LEAD_ATTACHMENT_TIPOS)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data as LeadPDF[];
    },
    enabled: queriesReady && !!leadId,
  });

  useEffect(() => {
    const list = query.data;
    if (!list?.length) return;

    // Só a capa (miniatura). Renderizar TODAS as páginas aqui trava tablet
    // com cadernos grandes (ex.: lead 9688 — 2 PDFs de dezenas de páginas).
    for (const pdf of list) {
      if (pdf.tipo !== 'pdf') continue;
      const key = pdfCacheKeyForMedia(pdf.id);
      void prewarmPdfThumbnail(key, { url: pdf.file_url });
    }
  }, [query.data]);

  const invalidateAttachmentQueries = (targetLeadId: number) => {
    queryClient.invalidateQueries({ queryKey: ['lead-pdfs', schemaEmpresa ?? 'master', targetLeadId] });
    queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
    queryClient.invalidateQueries({ queryKey: ['biblioteca-medias'] });
    queryClient.invalidateQueries({ queryKey: ['lead-media-folders'] });
    queryClient.invalidateQueries({ queryKey: ['lead-midias-para-orcamento', schemaEmpresa, targetLeadId] });
    bumpLeadKnowledgeReindex(queryClient, schemaEmpresa, targetLeadId);
  };

  const uploadPDFToLead = async (
    targetLeadId: number,
    file: File,
    pendingTempId?: string,
    folderId?: string | null,
    titulo?: string | null,
  ): Promise<string | void> => {
    const validationError = validateAttachmentFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const tipo = getLeadAttachmentTipo(file)!;

    const cacheKey = pendingTempId
      ? pdfCacheKeyForPending(pendingTempId)
      : `upload:${crypto.randomUUID()}`;

    const storageFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension(file)}`;
    const storagePath = buildStoragePath(mediasConfig.schema, storageFileName);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Prévia leve: só capa. Páginas sob demanda (cadernos grandes no tablet).
    if (tipo === 'pdf') {
      void prewarmPdfThumbnail(cacheKey, { file });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    const db = getMarketingDb(mediasConfig.schema);
    const { data: inserted, error: insertError } = await db
      .from(mediasConfig.mediasTable)
      .insert({
        titulo: titulo?.trim() || file.name.replace(/\.[^.]+$/, ''),
        tipo,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        folder_id: folderId ?? null,
        lead_id: targetLeadId,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    if (inserted?.id && tipo === 'pdf') {
      migratePdfCacheKey(cacheKey, pdfCacheKeyForMedia(inserted.id));
      return inserted.id;
    }
    if (inserted?.id) {
      return inserted.id;
    }
  };

  const stagePendingPDF = (
    file: File,
    folder?: { folderId?: string | null; folderName?: string },
  ): void => {
    const validationError = validateAttachmentFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const tipo = getLeadAttachmentTipo(file)!;
    const tempId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setPendingPdfs((prev) => [
      ...prev,
      {
        tempId,
        file,
        previewUrl: URL.createObjectURL(file),
        tipo,
        folderId: folder?.folderId,
        folderName: folder?.folderName,
      },
    ]);
    if (tipo === 'pdf') {
      void prewarmPdfThumbnail(pdfCacheKeyForPending(tempId), { file });
    }
    toast.success(
      tipo === 'pdf'
        ? 'PDF adicionado — será enviado ao salvar o lead'
        : tipo === 'video'
          ? 'Vídeo adicionado — será enviado ao salvar o lead'
          : 'Imagem adicionada — será enviada ao salvar o lead',
    );
  };

  const removePendingPDF = (tempId: string): void => {
    clearPdfCacheKey(pdfCacheKeyForPending(tempId));
    setPendingPdfs((prev) => {
      const item = prev.find((p) => p.tempId === tempId);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.tempId !== tempId);
    });
  };

  const uploadPDF = async (
    file: File,
    folder?: { folderId?: string | null; folderName?: string },
  ): Promise<void> => {
    if (!leadId) {
      stagePendingPDF(file, folder);
      return;
    }

    try {
      let resolvedFolderId = folder?.folderId ?? null;
      if (folder?.folderName && !folder.folderId) {
        resolvedFolderId = await ensureLeadFolderId(
          mediasConfig.schema,
          mediasConfig.foldersTable,
          leadId,
          folder.folderName,
        );
      }
      await uploadPDFToLead(leadId, file, undefined, resolvedFolderId);
      invalidateAttachmentQueries(leadId);
      toast.success('Arquivo anexado com sucesso');
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : String(error);
      console.error('Erro ao anexar arquivo:', error);
      const sizeExceeded = /exceeded the maximum allowed size|Payload Too Large|EntityTooLarge/i.test(
        message,
      );
      toast.error('Erro ao anexar arquivo', {
        description: sizeExceeded
          ? 'Este arquivo passou de 200MB. Escolha um vídeo menor ou reduza a qualidade (ex.: 720p).'
          : message,
      });
    }
  };

  const uploadAttachment = async (
    file: File,
    folderId?: string | null,
    titulo?: string | null,
  ): Promise<void> => {
    if (!leadId) {
      throw new Error('Salve o lead antes de anexar arquivos');
    }
    await uploadPDFToLead(leadId, file, undefined, folderId, titulo);
    invalidateAttachmentQueries(leadId);
  };

  const flushPendingPDFs = async (targetLeadId: number): Promise<void> => {
    if (pendingPdfs.length === 0) return;

    const queue = [...pendingPdfs];
    let uploaded = 0;

    for (const pending of queue) {
      try {
        await uploadPDFToLead(
          targetLeadId,
          pending.file,
          pending.tempId,
          pending.folderId !== undefined
            ? pending.folderId
            : pending.folderName
              ? await ensureLeadFolderId(
                  mediasConfig.schema,
                  mediasConfig.foldersTable,
                  targetLeadId,
                  pending.folderName,
                )
              : null,
        );
        uploaded += 1;
      } catch (error) {
        const message =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message: string }).message)
            : String(error);
        console.error('Erro ao anexar PDF pendente:', error);
        toast.error(`Falha ao anexar "${pending.file.name}"`, { description: message });
      }
    }

    clearPendingPdfs();

    if (uploaded > 0) {
      invalidateAttachmentQueries(targetLeadId);
      toast.success(
        uploaded === 1 ? 'Arquivo anexado ao lead' : `${uploaded} arquivos anexados ao lead`,
      );
    }
  };

  const assignMediasToFolder = async (mediaIds: string[], folderId: string | null): Promise<void> => {
    const realIds = mediaIds.filter((id) => !id.includes(':'));
    if (realIds.length === 0) return;
    const db = getMarketingDb(mediasConfig.schema);
    const { error } = await db
      .from(mediasConfig.mediasTable)
      .update({ folder_id: folderId })
      .in('id', realIds);
    if (error) throw error;
    if (leadId) invalidateAttachmentQueries(leadId);
  };

  /**
   * Move anexos para uma pasta (ou Sem pasta).
   * IDs reais: só atualiza folder_id.
   * Renders IA virtuais (ainda sem linha em marketing_medias): cria o anexo na pasta destino.
   */
  const moveAttachmentsToFolder = async (
    items: Array<
      Pick<LeadPDF, 'id' | 'titulo' | 'file_url' | 'file_name' | 'tipo' | 'mime_type' | 'file_size'>
    >,
    folderId: string | null,
  ): Promise<number> => {
    if (!leadId) throw new Error('Salve o lead antes de mover arquivos');
    if (items.length === 0) return 0;

    const db = getMarketingDb(mediasConfig.schema);
    const realIds = items.filter((item) => !item.id.includes(':')).map((item) => item.id);
    const virtualAiItems = items.filter((item) => item.id.startsWith('ai-render:'));

    if (realIds.length > 0) {
      const { error } = await db
        .from(mediasConfig.mediasTable)
        .update({ folder_id: folderId })
        .in('id', realIds);
      if (error) throw error;
    }

    for (const item of virtualAiItems) {
      const { error } = await db.from(mediasConfig.mediasTable).insert({
        titulo: item.titulo,
        tipo: item.tipo,
        file_url: item.file_url,
        file_name: item.file_name,
        file_size: item.file_size,
        mime_type: item.mime_type,
        folder_id: folderId,
        lead_id: leadId,
      });
      if (error) throw error;
    }

    invalidateAttachmentQueries(leadId);
    if (virtualAiItems.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['lead-ai-renders'] });
    }
    return realIds.length + virtualAiItems.length;
  };

  const deletePDF = async (
    mediaId: string,
    fileUrl: string,
    options?: { silent?: boolean },
  ): Promise<void> => {
    try {
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(
        /\/storage\/v1\/object\/public\/marketing-medias\/(.+)/,
      );
      if (pathMatch) {
        await supabase.storage.from(STORAGE_BUCKET).remove([decodeURIComponent(pathMatch[1])]);
      }

      const db = getMarketingDb(mediasConfig.schema);
      const { error } = await db.from(mediasConfig.mediasTable).delete().eq('id', mediaId);

      if (error) throw error;

      clearPdfCacheKey(pdfCacheKeyForMedia(mediaId));

      if (leadId) invalidateAttachmentQueries(leadId);
      if (!options?.silent) {
        toast.success('Arquivo removido');
      }
    } catch (error) {
      if (!options?.silent) {
        toast.error('Erro ao remover arquivo', { description: String(error) });
        return;
      }
      throw error;
    }
  };

  return {
    pdfs: query.data || [],
    pendingPdfs,
    isLoading: query.isLoading,
    uploadPDF,
    uploadAttachment,
    assignMediasToFolder,
    moveAttachmentsToFolder,
    deletePDF,
    removePendingPDF,
    flushPendingPDFs,
    clearPendingPdfs,
    hasPendingPdfs: pendingPdfs.length > 0,
  };
}
