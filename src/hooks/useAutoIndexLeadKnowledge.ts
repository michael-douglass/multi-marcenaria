import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { useLeadFormUploadAttachments } from '@/hooks/useLeadFormUploadAttachments';
import { mergeLeadAttachmentsDedupeByUrl } from '@/lib/lead-form-upload-attachments';
import { useLeadWhiteboard } from '@/hooks/useLeadWhiteboard';
import { useIndexLeadKnowledge, useLeadKnowledgeMeta } from '@/hooks/useLeadSkyChat';
import { buildLeadKnowledgeClientMedia } from '@/lib/lead-knowledge-index-client';
import { LEAD_KNOWLEDGE_REINDEX_KEY } from '@/lib/lead-knowledge-reindex';

function autoIndexFingerprintStorageKey(schema: string | null, leadId: number) {
  return `iris-auto-index-fp:${schema ?? 'master'}:${leadId}`;
}

function buildContentFingerprint(input: {
  leadRevision?: string | null;
  anexos: Array<{ id: string; criado_em: string }>;
  whiteboardImages: Array<{ id: string; criado_em: string }>;
  manualBump: number;
}): string {
  const anexoSig = [...input.anexos]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => `${p.id}:${p.criado_em}`)
    .join(',');
  const wbSig = [...input.whiteboardImages]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) => `${i.id}:${i.criado_em}`)
    .join(',');
  return `${input.leadRevision ?? ''}|${anexoSig}|${wbSig}|${input.manualBump}`;
}

/**
 * Indexa automaticamente dados e mídias do lead na base vetorial da Íris Sky
 * ao abrir o card, alterar anexos ou atualizar o cadastro.
 */
export function useAutoIndexLeadKnowledge(
  leadId: number | null | undefined,
  enabled: boolean,
  leadRevision?: string | null,
  /** Chave local no card do lead — só indexa sozinho quando o usuário ligar */
  userAutoIndexEnabled = false,
) {
  const { schemaEmpresa } = useEmpresa();
  const { config } = usePipelineLeadAIConfig();
  const indexMutation = useIndexLeadKnowledge();
  const { data: knowledgeMeta } = useLeadKnowledgeMeta(
    enabled && userAutoIndexEnabled && config.irisSkyKnowledgeAtivo ? leadId : null,
  );
  const { pdfs, isLoading: pdfsLoading } = useLeadPDFs(leadId);
  const { formUploadAttachments, isLoading: formUploadsLoading } = useLeadFormUploadAttachments(leadId);
  const mergedAnexos = useMemo(
    () => mergeLeadAttachmentsDedupeByUrl(pdfs, formUploadAttachments),
    [pdfs, formUploadAttachments],
  );
  const { images: whiteboardImages, isLoading: wbLoading } = useLeadWhiteboard(leadId);
  const queryClient = useQueryClient();

  const manualBump =
    queryClient.getQueryData<number>([
      LEAD_KNOWLEDGE_REINDEX_KEY,
      schemaEmpresa ?? 'master',
      leadId,
    ]) ?? 0;

  const contentFingerprint = useMemo(
    () =>
      buildContentFingerprint({
        leadRevision,
        anexos: mergedAnexos,
        whiteboardImages,
        manualBump,
      }),
    [mergedAnexos, whiteboardImages, leadRevision, manualBump],
  );

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastIndexedFingerprintRef = useRef<string | null>(null);
  const lastManualBumpRef = useRef(manualBump);
  const failureCooldownUntilRef = useRef(0);
  const runningRef = useRef(false);
  const indexMutateAsyncRef = useRef(indexMutation.mutateAsync);
  indexMutateAsyncRef.current = indexMutation.mutateAsync;
  const isIndexPending = indexMutation.isPending;

  useEffect(() => {
    if (!leadId) return;
    const stored = sessionStorage.getItem(autoIndexFingerprintStorageKey(schemaEmpresa, leadId));
    if (stored) lastIndexedFingerprintRef.current = stored;
  }, [leadId, schemaEmpresa]);

  useEffect(() => {
    if (manualBump !== lastManualBumpRef.current) {
      lastManualBumpRef.current = manualBump;
      lastIndexedFingerprintRef.current = null;
      if (leadId) {
        sessionStorage.removeItem(autoIndexFingerprintStorageKey(schemaEmpresa, leadId));
      }
    }
  }, [leadId, manualBump, schemaEmpresa]);

  useEffect(() => {
    if (!enabled || !leadId || !config.irisSkyKnowledgeAtivo || !userAutoIndexEnabled) return;
    if (pdfsLoading || formUploadsLoading || wbLoading) return;
    if (runningRef.current || isIndexPending) return;
    if (knowledgeMeta?.status === 'indexing') return;
    if (Date.now() < failureCooldownUntilRef.current) return;

    if (
      knowledgeMeta?.status === 'ready' &&
      lastIndexedFingerprintRef.current === contentFingerprint
    ) {
      return;
    }

    if (
      knowledgeMeta?.status === 'ready' &&
      lastIndexedFingerprintRef.current === null
    ) {
      // Servidor já indexou (ex.: após recarregar a página) — sincroniza sem nova chamada.
      lastIndexedFingerprintRef.current = contentFingerprint;
      sessionStorage.setItem(
        autoIndexFingerprintStorageKey(schemaEmpresa, leadId),
        contentFingerprint,
      );
      return;
    }

    if (lastIndexedFingerprintRef.current === contentFingerprint) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void (async () => {
        if (runningRef.current || !leadId) return;
        if (knowledgeMeta?.status === 'indexing' || isIndexPending) return;

        runningRef.current = true;
        try {
          const clientMedia = config.irisSkyIncludeMediaVision
            ? await buildLeadKnowledgeClientMedia({
                anexos: mergedAnexos,
                whiteboardImages,
                maxItems: config.irisSkyKnowledgeMaxItems,
                maxPages: config.irisSkyKnowledgeMaxPages,
              })
            : undefined;

          await indexMutateAsyncRef.current({
            leadId,
            force: false,
            includeMediaVision: config.irisSkyIncludeMediaVision,
            clientMedia,
          });

          lastIndexedFingerprintRef.current = contentFingerprint;
          sessionStorage.setItem(
            autoIndexFingerprintStorageKey(schemaEmpresa, leadId),
            contentFingerprint,
          );
        } catch {
          failureCooldownUntilRef.current = Date.now() + 60_000;
        } finally {
          runningRef.current = false;
        }
      })();
    }, 1500);

    return () => clearTimeout(timerRef.current);
  }, [
    enabled,
    leadId,
    schemaEmpresa,
    config.irisSkyKnowledgeAtivo,
    userAutoIndexEnabled,
    config.irisSkyIncludeMediaVision,
    config.irisSkyKnowledgeMaxItems,
    config.irisSkyKnowledgeMaxPages,
    contentFingerprint,
    knowledgeMeta?.status,
    mergedAnexos,
    whiteboardImages,
    pdfsLoading,
    formUploadsLoading,
    wbLoading,
    isIndexPending,
  ]);

  return { isIndexing: indexMutation.isPending || knowledgeMeta?.status === 'indexing' };
}
