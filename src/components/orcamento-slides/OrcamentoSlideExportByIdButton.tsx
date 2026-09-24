import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OrcamentoSlideExportMenu } from '@/components/orcamento-slides/OrcamentoSlideExportMenu';
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
import { cn } from '@/lib/utils';

interface ExportJob {
  viewport: OrcamentoExportViewport;
  format: OrcamentoExportFormat;
}

interface OrcamentoSlideExportByIdButtonProps {
  orcamentoId: string;
  /** Nome amigável do arquivo (cliente ou identificador). */
  titulo: string;
  className?: string;
  /** Variante compacta para a lista do card do lead. */
  compact?: boolean;
}

type PresentationProps = Omit<
  OrcamentoSlideApresentacaoProps,
  | 'ref'
  | 'className'
  | 'embeddedInLayout'
  | 'viewport'
  | 'previewMode'
  | 'faithfulPreview'
  | 'omitVideos'
>;

/**
 * Exporta PDF/imagens a partir do id do orçamento — sem abrir a apresentação.
 * Serve no card do lead mesmo quando o orçamento está só para leitura (fechado).
 */
export function OrcamentoSlideExportByIdButton({
  orcamentoId,
  titulo,
  className,
  compact = false,
}: OrcamentoSlideExportByIdButtonProps) {
  const [job, setJob] = useState<ExportJob | null>(null);

  return (
    <>
      <OrcamentoSlideExportMenu
        portalMode="inline"
        onExport={(viewport, format) =>
          setJob((prev) => prev ?? { viewport, format })
        }
        isExporting={!!job}
        label="Exportar"
        className={cn(
          compact &&
            'h-8 gap-1 px-2 text-xs shadow-none bg-amber-600/90 hover:bg-amber-700 border-amber-500/20',
          className,
        )}
      />
      {job ? (
        <OrcamentoSlideExportJob
          orcamentoId={orcamentoId}
          titulo={titulo}
          viewport={job.viewport}
          format={job.format}
          onSettled={() => setJob(null)}
        />
      ) : null}
    </>
  );
}

interface JobProps {
  orcamentoId: string;
  titulo: string;
  viewport: OrcamentoExportViewport;
  format: OrcamentoExportFormat;
  onSettled: () => void;
}

/** Carrega os dados do slide; quando pronto, dispara a exportação. */
function OrcamentoSlideExportJob({
  orcamentoId,
  titulo,
  viewport,
  format,
  onSettled,
}: JobProps) {
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
      description: 'Carregando slides e imagens do orçamento.',
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

  const presentationProps = useMemo((): PresentationProps | null => {
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
  presentationProps: PresentationProps;
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
