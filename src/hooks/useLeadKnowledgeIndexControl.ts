import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { useLeadFormUploadAttachments } from '@/hooks/useLeadFormUploadAttachments';
import { mergeLeadAttachmentsDedupeByUrl } from '@/lib/lead-form-upload-attachments';
import { useLeadWhiteboard } from '@/hooks/useLeadWhiteboard';
import { useIndexLeadKnowledge } from '@/hooks/useLeadSkyChat';
import { buildLeadKnowledgeClientMedia } from '@/lib/lead-knowledge-index-client';
import { toast } from 'sonner';

function autoIndexStorageKey(schemaEmpresa: string | null, leadId: number) {
  return `lead-iris-auto-index:${schemaEmpresa ?? 'master'}:${leadId}`;
}

function readAutoIndexPreference(
  schemaEmpresa: string | null,
  leadId: number | null | undefined,
): boolean {
  if (!leadId) return false;
  return localStorage.getItem(autoIndexStorageKey(schemaEmpresa, leadId)) === 'true';
}

export function useLeadKnowledgeAutoIndexPreference(leadId: number | null | undefined) {
  const { schemaEmpresa } = useEmpresa();
  const [autoIndex, setAutoIndexState] = useState(() =>
    readAutoIndexPreference(schemaEmpresa, leadId),
  );

  useEffect(() => {
    setAutoIndexState(readAutoIndexPreference(schemaEmpresa, leadId));
  }, [leadId, schemaEmpresa]);

  const setAutoIndex = useCallback(
    (value: boolean) => {
      if (!leadId) return;
      localStorage.setItem(autoIndexStorageKey(schemaEmpresa, leadId), String(value));
      setAutoIndexState(value);
    },
    [leadId, schemaEmpresa],
  );

  return { autoIndex, setAutoIndex };
}

export function useLeadKnowledgeIndexNow(leadId: number | null | undefined) {
  const { config } = usePipelineLeadAIConfig();
  const indexMutation = useIndexLeadKnowledge();
  const { pdfs, isLoading: pdfsLoading } = useLeadPDFs(leadId);
  const { formUploadAttachments, isLoading: formUploadsLoading } = useLeadFormUploadAttachments(leadId);
  const mergedAnexos = useMemo(
    () => mergeLeadAttachmentsDedupeByUrl(pdfs, formUploadAttachments),
    [pdfs, formUploadAttachments],
  );
  const { images: whiteboardImages, isLoading: wbLoading } = useLeadWhiteboard(leadId);

  const indexNow = useCallback(
    async (options?: { force?: boolean }) => {
      if (!leadId || !config.irisSkyKnowledgeAtivo) return;
      if (pdfsLoading || formUploadsLoading || wbLoading) {
        toast.message('Aguarde', { description: 'Carregando anexos do lead…' });
        return;
      }

      try {
        const clientMedia = config.irisSkyIncludeMediaVision
          ? await buildLeadKnowledgeClientMedia({
              anexos: mergedAnexos,
              whiteboardImages,
              maxItems: config.irisSkyKnowledgeMaxItems,
              maxPages: config.irisSkyKnowledgeMaxPages,
            })
          : undefined;

        const result = await indexMutation.mutateAsync({
          leadId,
          force: options?.force ?? true,
          includeMediaVision: config.irisSkyIncludeMediaVision,
          clientMedia,
        });

        if (result.skipped) {
          toast.message('Memória já atualizada', {
            description: 'Os documentos deste lead já estão indexados.',
          });
        } else {
          toast.success('Memória da Íris atualizada', {
            description: `${result.chunkCount} trechos prontos para consulta no chat.`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        toast.error('Não foi possível indexar', { description: message });
        throw error;
      }
    },
    [
      leadId,
      config.irisSkyKnowledgeAtivo,
      config.irisSkyIncludeMediaVision,
      config.irisSkyKnowledgeMaxItems,
      config.irisSkyKnowledgeMaxPages,
      mergedAnexos,
      whiteboardImages,
      pdfsLoading,
      formUploadsLoading,
      wbLoading,
      indexMutation,
    ],
  );

  return {
    indexNow,
    isIndexing: indexMutation.isPending,
    mediaLoading: pdfsLoading || formUploadsLoading || wbLoading,
  };
}
