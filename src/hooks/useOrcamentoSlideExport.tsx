import { useCallback, useRef, useState, type RefObject } from 'react';
import { toast } from 'sonner';
import { OrcamentoSlideApresentacao } from '@/components/orcamento-slides/OrcamentoSlideApresentacao';
import type { OrcamentoSlideApresentacaoProps } from '@/components/orcamento-slides/orcamento-slide-apresentacao-props';
import {
  abrirOrcamentoExport,
  resolveExportPageSize,
  type OrcamentoExportFormat,
  type OrcamentoExportViewport,
} from '@/lib/orcamento-slide-export';
import {
  buildExportFingerprint,
  saveCachedPdfExport,
  type OrcamentoSlideExportCacheInput,
} from '@/lib/orcamento-slide-export-cache';
import type { OrcamentoExportProgress } from '@/lib/orcamento-slide-print';

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

interface UseOrcamentoSlideExportOptions {
  titulo: string;
  presentationProps: PresentationProps;
  /** Quando informado, grava o PDF no Storage após gerar (próxima vez só baixa). */
  cacheContext?: {
    empresaSchema: string;
    orcamentoId: string;
  } | null;
}

async function aguardarRenderOffscreen(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

async function aguardarRefMontado(
  ref: RefObject<HTMLDivElement | null>,
  timeoutMs = 8000,
): Promise<HTMLDivElement> {
  const inicio = Date.now();
  while (!ref.current) {
    if (Date.now() - inicio > timeoutMs) {
      throw new Error('Não foi possível preparar a apresentação para exportação.');
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return ref.current;
}

function descricaoProgresso(progress: OrcamentoExportProgress, isImagens: boolean): string {
  if (progress.phase === 'preparando' || progress.total === 0) {
    return 'Preparando slides e imagens…';
  }
  if (progress.phase === 'concluido') {
    return isImagens ? 'Finalizando downloads…' : 'Finalizando PDF…';
  }
  const verbo = progress.phase === 'montando' ? 'Montando' : 'Capturando';
  return `${verbo} slide ${progress.current} de ${progress.total}`;
}

/** Exportação PDF ou imagens — baixa direto ao escolher computador ou celular. */
export function useOrcamentoSlideExport({
  titulo,
  presentationProps,
  cacheContext = null,
}: UseOrcamentoSlideExportOptions) {
  const offscreenRef = useRef<HTMLDivElement>(null);
  const [exportViewport, setExportViewport] = useState<OrcamentoExportViewport | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(
    async (viewport: OrcamentoExportViewport, format: OrcamentoExportFormat = 'pdf') => {
      if (isExporting) return;

      setIsExporting(true);
      setExportViewport(viewport);

      const isImagens = format === 'imagens';
      const toastId = toast.loading(isImagens ? 'Gerando imagens…' : 'Gerando PDF…', {
        description: 'Em segundo plano — um slide por página.',
      });

      try {
        const root = await aguardarRefMontado(offscreenRef);
        await aguardarRenderOffscreen();

        const result = await abrirOrcamentoExport({
          rootElement: root,
          titulo,
          viewport,
          format,
          onProgress: (progress) => {
            toast.loading(isImagens ? 'Gerando imagens…' : 'Gerando PDF…', {
              id: toastId,
              description: descricaoProgresso(progress, isImagens),
            });
          },
        });

        // Cache só para PDF (imagens são vários arquivos).
        if (
          format === 'pdf' &&
          result instanceof Blob &&
          cacheContext?.empresaSchema &&
          cacheContext.orcamentoId
        ) {
          const midias = presentationProps.midiasOrcamento ?? [];
          const fingerprint = await buildExportFingerprint({
            orcamento: presentationProps.orcamento,
            midias,
            viewport,
            format: 'pdf',
          });
          const cacheInput: OrcamentoSlideExportCacheInput = {
            empresaSchema: cacheContext.empresaSchema,
            orcamentoId: cacheContext.orcamentoId,
            viewport,
            format: 'pdf',
            fingerprint,
            titulo,
          };
          // Não bloqueia o sucesso do download se o upload falhar.
          void saveCachedPdfExport(cacheInput, result).catch(() => undefined);
        }

        const modo =
          viewport === 'desktop' ? 'computador (1920×1080)' : 'celular (1080×1920)';
        toast.success(isImagens ? 'Imagens baixadas' : 'PDF baixado', {
          id: toastId,
          description: isImagens
            ? `Um slide por página · ${modo}.`
            : `Um slide por página · ${modo}.`,
          duration: 5000,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        toast.error(
          isImagens ? 'Não foi possível gerar as imagens.' : 'Não foi possível gerar o PDF.',
          {
            id: toastId,
            description: message,
          },
        );
      } finally {
        setIsExporting(false);
        setExportViewport(null);
      }
    },
    [isExporting, titulo, cacheContext, presentationProps.orcamento, presentationProps.midiasOrcamento],
  );

  const pageSize = exportViewport ? resolveExportPageSize(exportViewport) : null;

  const exportPortal =
    exportViewport && pageSize ? (
      <div
        aria-hidden
        style={{
          position: 'fixed',
          // Fora da tela: todos os slides ficam “inteiros” (sem cortar nas páginas seguintes).
          // Sem opacity:0 — o html2canvas ignora camadas invisíveis e o PDF sai em branco.
          left: -pageSize.width - 64,
          top: 0,
          width: pageSize.width,
          height: 'auto',
          minHeight: pageSize.height,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <OrcamentoSlideApresentacao
          ref={offscreenRef}
          {...presentationProps}
          viewport={exportViewport}
          previewMode
          faithfulPreview
          omitVideos
          className="w-full overflow-visible"
        />
      </div>
    ) : null;

  return {
    exportar,
    exportPdf: (viewport: OrcamentoExportViewport) => exportar(viewport, 'pdf'),
    isExporting,
    exportViewport,
    exportPortal,
    /** @deprecated Use exportar */
    openPreview: (viewport: OrcamentoExportViewport) => exportar(viewport, 'pdf'),
    /** @deprecated Use exportPortal */
    previewDialog: exportPortal,
    /** @deprecated Use exportar */
    onExport: (viewport: OrcamentoExportViewport) => exportar(viewport, 'pdf'),
  };
}
