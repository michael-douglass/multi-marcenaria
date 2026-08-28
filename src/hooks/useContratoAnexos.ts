import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import {
  attachmentFileExtension,
  CONTRATOS_ANEXOS_BUCKET,
  extractStoragePathFromPublicUrl,
  getAttachmentTipo,
  type AttachmentTipo,
  validateAttachmentFile,
} from '@/lib/attachment-files';
import {
  pdfFileToPreviewDataUrl,
  resolveContratoUploadFiles,
} from '@/lib/contrato-anexo-upload';

export interface ContratoAnexo {
  id: string;
  contrato_id: string;
  titulo: string;
  tipo: AttachmentTipo;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  ordem: number;
  criado_por: string | null;
  created_at: string;
}

export interface PendingContratoAnexo {
  tempId: string;
  file: File;
  previewUrl: string;
  tipo: AttachmentTipo;
  /** Quantas fotos serão geradas ao enviar (PDF = número de páginas). */
  pageCount?: number;
}

function resolveContratosAnexosTable(schema: string | null | undefined) {
  if (isSchemaApiExposed(schema)) return 'contratos_anexos';
  return 'CRM-multi-empresas>contratos_anexos<';
}

function buildStoragePath(
  schema: string | null | undefined,
  contratoId: string,
  fileName: string,
): string {
  const prefix = schema ?? 'master';
  return `${prefix}/${contratoId}/${fileName}`;
}

export function useContratoAnexos(contratoId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveContratosAnexosTable(schemaEmpresa);
  const queryKey = ['contrato-anexos', schemaEmpresa, contratoId] as const;

  const [pendingAnexos, setPendingAnexos] = useState<PendingContratoAnexo[]>([]);
  const flushInProgressRef = useRef(false);
  const ordemRef = useRef(0);

  const { data: anexos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!contratoId) return [];
      const { data, error } = await db
        .from(table as 'contratos_anexos')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      ordemRef.current = (data ?? []).length;
      return (data ?? []) as ContratoAnexo[];
    },
    enabled: !!user?.id && queriesReady && !!contratoId,
  });

  const insertAnexoRow = useCallback(
    async (
      targetContratoId: string,
      uploadFile: File,
      ordem: number,
    ) => {
      const tipo = getAttachmentTipo(uploadFile)!;
      const storageFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${attachmentFileExtension(uploadFile)}`;
      const storagePath = buildStoragePath(schemaEmpresa, targetContratoId, storageFileName);

      const { error: uploadError } = await supabase.storage
        .from(CONTRATOS_ANEXOS_BUCKET)
        .upload(storagePath, uploadFile, {
          contentType: uploadFile.type || 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(CONTRATOS_ANEXOS_BUCKET).getPublicUrl(storagePath);

      const row: Record<string, unknown> = {
        contrato_id: targetContratoId,
        titulo: uploadFile.name.replace(/\.[^.]+$/, ''),
        tipo,
        file_url: publicUrl,
        file_name: uploadFile.name,
        file_size: uploadFile.size,
        mime_type: uploadFile.type || null,
        ordem,
        criado_por: user?.id ?? null,
      };
      if (!isSchemaApiExposed(schemaEmpresa)) {
        row.schema_nome = schemaEmpresa;
      }

      const { error: insertError } = await db.from(table as 'contratos_anexos').insert([row]);

      if (insertError) throw insertError;
    },
    [db, schemaEmpresa, table, user?.id],
  );

  const uploadToContrato = useCallback(
    async (targetContratoId: string, file: File) => {
      const validationError = validateAttachmentFile(file);
      if (validationError) throw new Error(validationError);

      const wasPdf = getAttachmentTipo(file) === 'pdf';
      const filesToUpload = await resolveContratoUploadFiles(file);

      let ordem = ordemRef.current;
      for (const uploadFile of filesToUpload) {
        await insertAnexoRow(targetContratoId, uploadFile, ordem);
        ordem += 1;
      }
      ordemRef.current = ordem;

      return { wasPdf, pageCount: filesToUpload.length };
    },
    [insertAnexoRow],
  );

  const stagePending = useCallback((file: File) => {
    const validationError = validateAttachmentFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const tipo = getAttachmentTipo(file)!;
    const tempId = crypto.randomUUID();
    const previewUrl = tipo === 'imagem' ? URL.createObjectURL(file) : '';

    setPendingAnexos((prev) => [
      ...prev,
      {
        tempId,
        file,
        previewUrl,
        tipo,
      },
    ]);

    if (tipo === 'pdf') {
      void resolveContratoUploadFiles(file)
        .then((pages) => {
          setPendingAnexos((prev) =>
            prev.map((p) =>
              p.tempId === tempId ? { ...p, pageCount: pages.length } : p,
            ),
          );
        })
        .catch(() => undefined);

      void pdfFileToPreviewDataUrl(file)
        .then((thumb) => {
          setPendingAnexos((prev) =>
            prev.map((p) => (p.tempId === tempId ? { ...p, previewUrl: thumb } : p)),
          );
        })
        .catch(() => {
          setPendingAnexos((prev) =>
            prev.map((p) =>
              p.tempId === tempId
                ? { ...p, previewUrl: URL.createObjectURL(file) }
                : p,
            ),
          );
        });
    }

    toast.success(
      contratoId
        ? tipo === 'pdf'
          ? 'PDF adicionado — será convertido em fotos ao enviar'
          : 'Arquivo adicionado'
        : tipo === 'pdf'
          ? 'PDF na fila — será convertido em fotos quando o contrato for salvo'
          : 'Arquivo na fila — será enviado quando o contrato for salvo',
    );
  }, [contratoId]);

  const removePending = useCallback((tempId: string) => {
    setPendingAnexos((prev) => {
      const item = prev.find((p) => p.tempId === tempId);
      if (item?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((p) => p.tempId !== tempId);
    });
  }, []);

  const clearPending = useCallback(() => {
    setPendingAnexos((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
  }, []);

  const uploadAnexo = useCallback(
    async (file: File) => {
      if (!contratoId) {
        stagePending(file);
        return;
      }

      try {
        const result = await uploadToContrato(contratoId, file);
        queryClient.invalidateQueries({ queryKey });
        if (result.wasPdf && result.pageCount > 1) {
          toast.success(`PDF convertido em ${result.pageCount} fotos no contrato`);
        } else if (result.wasPdf) {
          toast.success('PDF convertido em foto e anexado ao contrato');
        } else {
          toast.success('Anexo adicionado ao contrato');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Erro ao anexar arquivo ao contrato:', error);
        toast.error('Erro ao anexar arquivo', { description: message });
      }
    },
    [contratoId, queryClient, queryKey, stagePending, uploadToContrato],
  );

  const flushPendingAnexos = useCallback(
    async (targetContratoId: string) => {
      if (pendingAnexos.length === 0 || flushInProgressRef.current) return;

      flushInProgressRef.current = true;
      const queue = [...pendingAnexos];
      let uploadedFiles = 0;
      let pdfPages = 0;

      try {
        for (const pending of queue) {
          try {
            const result = await uploadToContrato(targetContratoId, pending.file);
            uploadedFiles += 1;
            if (result.wasPdf) pdfPages += result.pageCount;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`Falha ao anexar "${pending.file.name}"`, { description: message });
          }
        }

        clearPending();

        if (uploadedFiles > 0) {
          queryClient.invalidateQueries({
            queryKey: ['contrato-anexos', schemaEmpresa, targetContratoId],
          });
          if (pdfPages > 0) {
            toast.success(
              pdfPages === 1
                ? 'PDF convertido em foto e vinculado ao contrato'
                : `${pdfPages} fotos do PDF vinculadas ao contrato`,
            );
          } else {
            toast.success(
              uploadedFiles === 1
                ? 'Anexo vinculado ao contrato'
                : `${uploadedFiles} anexos vinculados ao contrato`,
            );
          }
        }
      } finally {
        flushInProgressRef.current = false;
      }
    },
    [clearPending, pendingAnexos, queryClient, schemaEmpresa, uploadToContrato],
  );

  useEffect(() => {
    if (!contratoId || pendingAnexos.length === 0) return;
    void flushPendingAnexos(contratoId);
  }, [contratoId, pendingAnexos.length, flushPendingAnexos]);

  const deleteAnexo = useCallback(
    async (anexoId: string, fileUrl: string) => {
      try {
        const path = extractStoragePathFromPublicUrl(fileUrl, CONTRATOS_ANEXOS_BUCKET);
        if (path) {
          await supabase.storage.from(CONTRATOS_ANEXOS_BUCKET).remove([path]);
        }

        const { error } = await db
          .from(table as 'contratos_anexos')
          .delete()
          .eq('id', anexoId);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey });
        ordemRef.current = Math.max(0, ordemRef.current - 1);
        toast.success('Anexo removido');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Erro ao remover anexo:', error);
        toast.error('Erro ao remover anexo', { description: message });
      }
    },
    [db, queryClient, queryKey, table],
  );

  return {
    anexos,
    pendingAnexos,
    isLoading,
    uploadAnexo,
    deleteAnexo,
    removePending,
    flushPendingAnexos,
    hasPendingAnexos: pendingAnexos.length > 0,
  };
}
