import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { OrcamentoExportViewport } from '@/components/orcamento-slides/OrcamentoSlideExportMenu';
import type { OrcamentoSlideApresentacaoProps } from '@/components/orcamento-slides/orcamento-slide-apresentacao-props';
import { useOrcamentoPorId } from '@/hooks/useOrcamentoSlides';
import { useOrcamentoSlideTemplate } from '@/hooks/useOrcamentoSlideTemplate';
import { useOrcamentoSlideBlocos } from '@/hooks/useOrcamentoSlideBlocos';
import { useOrcamentoSlideMidias } from '@/hooks/useOrcamentoSlideMidias';
import { useOrcamentoSlidePerguntas } from '@/hooks/useOrcamentoSlidePerguntas';
import { useOrcamentoSlideCatalogo } from '@/hooks/useOrcamentoSlideCatalogo';
import { useOrcamentoSlideFormasPagamento } from '@/hooks/useOrcamentoSlideFormasPagamento';
import { useLeadDetail } from '@/hooks/useLeads';
import { useOrcamentoSlideExport } from '@/hooks/useOrcamentoSlideExport';
import { resolverMidiasApresentacao } from '@/lib/orcamento-slide-bloco-imagens';
import type { OrcamentoExportFormat } from '@/lib/orcamento-slide-export';

export type OrcamentoSlideExportPresentationProps = Omit<
  OrcamentoSlideApresentacaoProps,
  | 'ref'
  | 'className'
  | 'embeddedInLayout'
  | 'viewport'
  | 'previewMode'
  | 'faithfulPreview'
  | 'omitVideos'
>;

export interface OrcamentoSlideExportJobRunnerProps {
  orcamentoId: string;
  titulo: string;
  viewport: OrcamentoExportViewport;
  format: OrcamentoExportFormat;
  /** Snapshot opcional (ex.: apresentação aberta) — evita reload e preserva edições locais. */
  presentationProps?: OrcamentoSlideExportPresentationProps | null;
  onSettled: () => void;
}

/**
 * Carrega (se preciso) e gera PDF/imagens fora do card do lead.
 * Deve viver num provider de app — sobrevive a fechar/minimizar o lead.
 */
export function OrcamentoSlideExportJobRunner({
  orcamentoId,
  titulo,
  viewport,
  format,
  presentationProps: snapshotProps = null,
  onSettled,
}: OrcamentoSlideExportJobRunnerProps) {
  if (snapshotProps) {
    return (
      <OrcamentoSlideExportJobReady
        titulo={titulo || snapshotProps.orcamento.cliente_nome || snapshotProps.orcamento.identificador}
        presentationProps={snapshotProps}
        viewport={viewport}
        format={format}
        onSettled={onSettled}
        dismissLoadingToast={() => {}}
      />
    );
  }

  return (
    <OrcamentoSlideExportJobLoader
      orcamentoId={orcamentoId}
      titulo={titulo}
      viewport={viewport}
      format={format}
      onSettled={onSettled}
    />
  );
}

function OrcamentoSlideExportJobLoader({
  orcamentoId,
  titulo,
  viewport,
  format,
  onSettled,
}: Omit<OrcamentoSlideExportJobRunnerProps, 'presentationProps'>) {
  const loadingToastRef = useRef<string | number | null>(null);
  const { data: orcamento, isLoading: loadingOrc, isError, error } = useOrcamentoPorId(orcamentoId);
  const { template, isLoading: loadingTpl } = useOrcamentoSlideTemplate();
  const { blocos, isLoading: loadingBlocos } = useOrcamentoSlideBlocos(template?.id);
  const { midias, isLoading: loadingMidias } = useOrcamentoSlideMidias(orcamentoId);
  const { perguntas, isLoading: loadingPerguntas } = useOrcamentoSlidePerguntas();
  const { itens: catalogoFerragens, isLoading: loadingFerragens } = useOrcamentoSlideCatalogo('ferragem');
  const { itens: catalogoMdf, isLoading: loadingMdf } = useOrcamentoSlideCatalogo('mdf');
  const { formas: formasPagamento, isLoading: loadingFormas } = useOrcamentoSlideFormasPagamento();
  const { data: leadVinculado } = useLeadDetail(orcamento?.lead_id);

  const catalogoItens = useMemo(
    () => [...catalogoFerragens, ...catalogoMdf],
    [catalogoFerragens, catalogoMdf],
  );
  const midiasApresentacao = useMemo(
    () => resolverMidiasApresentacao(midias, blocos),
    [midias, blocos],
  );
  const valorOrcamentoLead = Number(leadVinculado?.valor_orcamento ?? 0);

  const isLoading =
    loadingOrc ||
    loadingTpl ||
    loadingBlocos ||
    loadingMidias ||
    loadingPerguntas ||
    loadingFerragens ||
    loadingMdf ||
    loadingFormas;

  useEffect(() => {
    loadingToastRef.current = toast.loading('Preparando exportação…', {
      description: 'Pode fechar o card — continuamos em segundo plano.',
    });
    return () => {
      if (loadingToastRef.current != null) {
        toast.dismiss(loadingToastRef.current);
        loadingToastRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isError) return;
    if (loadingToastRef.current != null) {
      toast.dismiss(loadingToastRef.current);
      loadingToastRef.current = null;
    }
    toast.error('Não foi possível carregar o orçamento para exportar.', {
      description: error instanceof Error ? error.message : undefined,
    });
    onSettled();
  }, [isError, error, onSettled]);

  const presentationProps = useMemo((): OrcamentoSlideExportPresentationProps | null => {
    if (!orcamento || isLoading) return null;
    return {
      orcamento,
      template,
      blocos,
      midias: midiasApresentacao,
      perguntas,
      catalogoFerragens,
      catalogoItens,
      valorOrcamentoLead,
      formasPagamento,
      midiasOrcamento: midias,
    };
  }, [
    orcamento,
    isLoading,
    template,
    blocos,
    midiasApresentacao,
    perguntas,
    catalogoFerragens,
    catalogoItens,
    valorOrcamentoLead,
    formasPagamento,
    midias,
  ]);

  if (!presentationProps) return null;

  return (
    <OrcamentoSlideExportJobReady
      titulo={titulo || presentationProps.orcamento.cliente_nome || presentationProps.orcamento.identificador}
      presentationProps={presentationProps}
      viewport={viewport}
      format={format}
      onSettled={onSettled}
      dismissLoadingToast={() => {
        if (loadingToastRef.current != null) {
          toast.dismiss(loadingToastRef.current);
          loadingToastRef.current = null;
        }
      }}
    />
  );
}

interface ReadyProps {
  titulo: string;
  presentationProps: OrcamentoSlideExportPresentationProps;
  viewport: OrcamentoExportViewport;
  format: OrcamentoExportFormat;
  onSettled: () => void;
  dismissLoadingToast: () => void;
}

function OrcamentoSlideExportJobReady({
  titulo,
  presentationProps,
  viewport,
  format,
  onSettled,
  dismissLoadingToast,
}: ReadyProps) {
  const startedRef = useRef(false);
  const onSettledRef = useRef(onSettled);
  const dismissRef = useRef(dismissLoadingToast);
  onSettledRef.current = onSettled;
  dismissRef.current = dismissLoadingToast;

  const { exportar, exportPortal } = useOrcamentoSlideExport({
    titulo,
    presentationProps,
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    dismissRef.current();
    void exportar(viewport, format).finally(() => onSettledRef.current());
    // Intencional: dispara uma vez ao montar com dados prontos.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exportar muda ao ligar isExporting
  }, [viewport, format]);

  return exportPortal;
}
