import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import {
  clearPdfCacheKey,
  migratePdfCacheKey,
  pdfCacheKeyForMedia,
  pdfCacheKeyForPending,
  prewarmPdfImages,
  prewarmPdfThumbnail,
  PDF_PREVIEW_WIDTH_PX,
  getCachedPdfPages,
} from '@/lib/pdf-image-cache';
import { toast } from 'sonner';
import { bumpLeadKnowledgeReindex } from '@/lib/lead-knowledge-reindex';

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
}

const ORCAMENTOS_FOLDER_NAME = 'orçamentos';
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

async function getOrCreateOrcamentosFolder(
  schema: string | null,
  foldersTable: string,
): Promise<string> {
  const db = getMarketingDb(schema);

  const { data: existing } = await db
    .from(foldersTable)
    .select('id')
    .eq('nome', ORCAMENTOS_FOLDER_NAME)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await db
    .from(foldersTable)
    .insert({ nome: ORCAMENTOS_FOLDER_NAME, descricao: 'Orçamentos de leads' })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

function buildStoragePath(schema: string | null, fileName: string): string {
  const prefix = schema ?? 'master';
  return `${prefix}/${fileName}`;
}

export function useLeadPDFs(leadId: number | null | undefined) {
  const queryClient = useQueryClient();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);
  const folderIdRef = useRef<string | null>(null);
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

    for (const pdf of list) {
      if (pdf.tipo !== 'pdf') continue;
      const key = pdfCacheKeyForMedia(pdf.id);
      void prewarmPdfImages(key, { url: pdf.file_url }, PDF_PREVIEW_WIDTH_PX);
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

    const useExplicitFolder = folderId !== undefined;
    if (!useExplicitFolder && !folderIdRef.current) {
      folderIdRef.current = await getOrCreateOrcamentosFolder(
        mediasConfig.schema,
        mediasConfig.foldersTable,
      );
    }

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

    // Prévia do PDF em background — não bloqueia o salvamento do lead
    if (tipo === 'pdf') {
      void prewarmPdfImages(cacheKey, { file }, PDF_PREVIEW_WIDTH_PX);
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
        folder_id: useExplicitFolder ? folderId : folderIdRef.current,
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

  const stagePendingPDF = (file: File): void => {
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
      },
    ]);
    if (tipo === 'pdf') {
      void prewarmPdfImages(pdfCacheKeyForPending(tempId), { file }, PDF_PREVIEW_WIDTH_PX);
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

  const uploadPDF = async (file: File): Promise<void> => {
    if (!leadId) {
      stagePendingPDF(file);
      return;
    }

    try {
      await uploadPDFToLead(leadId, file);
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
        await uploadPDFToLead(targetLeadId, pending.file, pending.tempId);
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

  const deletePDF = async (mediaId: string, fileUrl: string): Promise<void> => {
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
      toast.success('Arquivo removido');
    } catch (error) {
      toast.error('Erro ao remover arquivo', { description: String(error) });
    }
  };

  return {
    pdfs: query.data || [],
    pendingPdfs,
    isLoading: query.isLoading,
    uploadPDF,
    uploadAttachment,
    deletePDF,
    removePendingPDF,
    flushPendingPDFs,
    clearPendingPdfs,
    hasPendingPdfs: pendingPdfs.length > 0,
  };
}
