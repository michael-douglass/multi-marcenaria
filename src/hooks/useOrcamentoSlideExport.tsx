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

/** Exportação PDF ou imagens — baixa direto ao escolher computador ou celular. */
export function useOrcamentoSlideExport({ titulo, presentationProps }: UseOrcamentoSlideExportOptions) {
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
        description: isImagens
          ? 'Baixando um slide por página.'
          : 'Preparando um slide por página.',
      });

      try {
        const root = await aguardarRefMontado(offscreenRef);
        await aguardarRenderOffscreen();

        await abrirOrcamentoExport({
          rootElement: root,
          titulo,
          viewport,
          format,
        });

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
    [isExporting, titulo],
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
