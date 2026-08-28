import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { useLeadFormUploadAttachments } from '@/hooks/useLeadFormUploadAttachments';
import { mergeLeadAttachmentsDedupeByUrl } from '@/lib/lead-form-upload-attachments';
import { useLeadWhiteboard } from '@/hooks/useLeadWhiteboard';
import { useOrcamentosPorLead } from '@/hooks/useOrcamentoSlides';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { OrcamentoSlideMidia } from '@/lib/orcamento-slide-types';
import {
  buildSelectableLeadMediaItems,
  type LeadAIMediaItem,
} from '@/lib/lead-ai-media-sources';

const PUBLIC_MIDIAS_TABLE = 'CRM-multi-empresas>orcamento_slide_midias<' as const;

function resolveMidiasTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_midias' : PUBLIC_MIDIAS_TABLE;
}

export function useLeadAIMediaItems(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const { pdfs, isLoading: anexosLoading } = useLeadPDFs(leadId);
  const { formUploadAttachments } = useLeadFormUploadAttachments(leadId);
  const mergedAnexos = useMemo(
    () => mergeLeadAttachmentsDedupeByUrl(pdfs, formUploadAttachments),
    [pdfs, formUploadAttachments],
  );
  const { images: whiteboardImages } = useLeadWhiteboard(leadId);
  const { data: orcamentos = [], isLoading: orcamentosLoading } = useOrcamentosPorLead(leadId);
  const midiasTable = resolveMidiasTable(schemaEmpresa);

  const orcamentoIds = useMemo(
    () => orcamentos.map((orc) => orc.id).filter(Boolean),
    [orcamentos],
  );

  const midiaQueries = useQueries({
    queries: orcamentoIds.map((orcId) => ({
      queryKey: ['orcamento-slide-midias', schemaEmpresa, orcId],
      enabled: queriesReady && !!orcId,
      queryFn: async (): Promise<OrcamentoSlideMidia[]> => {
        const { data, error } = await db
          .from(midiasTable as 'orcamento_slide_midias')
          .select('*')
          .eq('orcamento_id', orcId)
          .order('ordem', { ascending: true });
        if (error) throw error;
        return (data ?? []) as OrcamentoSlideMidia[];
      },
      staleTime: 30_000,
      retry: 1,
    })),
  });

  const midiaQueryDataKey = orcamentoIds
    .map((orcId, index) => `${orcId}:${midiaQueries[index]?.dataUpdatedAt ?? 0}`)
    .join('|');

  const orcamentoMidiasById = useMemo(() => {
    const map: Record<string, OrcamentoSlideMidia[]> = {};
    orcamentoIds.forEach((orcId, index) => {
      map[orcId] = midiaQueries[index]?.data ?? [];
    });
    return map;
  }, [orcamentoIds, midiaQueryDataKey]);

  const items: LeadAIMediaItem[] = useMemo(
    () =>
      buildSelectableLeadMediaItems({
        anexos: mergedAnexos,
        whiteboardImages,
        orcamentos,
        orcamentoMidiasById,
      }),
    [mergedAnexos, whiteboardImages, orcamentos, orcamentoMidiasById],
  );

  const orcamentoMidiasInitialLoading =
    orcamentoIds.length > 0 &&
    midiaQueries.some((query) => query.isPending && query.fetchStatus !== 'idle');

  const isLoading =
    !queriesReady || anexosLoading || orcamentosLoading || orcamentoMidiasInitialLoading;

  const isRefreshing = midiaQueries.some((query) => query.isFetching && !query.isPending);

  return {
    items,
    isLoading,
    isRefreshing,
  };
}
