import { useEffect, useState } from 'react';
import { convertPdfPagesToJpegSequential } from '@/lib/pdf-to-image';
import type { OrcamentoExportViewport } from '@/lib/orcamento-slide-export-constants';

export interface OrcamentoPdfPagina {
  pageNumber: number;
  url: string;
}

interface OrcamentoPdfPaginasState {
  paginas: OrcamentoPdfPagina[];
  totalPaginas: number;
  isLoading: boolean;
  error: string | null;
}

/** Celular: páginas estreitas — menos pixels basta para ficarem nítidas na tela. */
const MAX_EDGE: Record<OrcamentoExportViewport, number> = {
  desktop: 1800,
  mobile: 1500,
};

/**
 * Converte o PDF exportado em JPEGs (uma página por vez) para a pré-visualização.
 * As páginas aparecem conforme ficam prontas; URLs são liberadas ao desmontar.
 */
export function useOrcamentoPdfPaginas(
  blob: Blob | null,
  viewport: OrcamentoExportViewport,
): OrcamentoPdfPaginasState {
  const [state, setState] = useState<OrcamentoPdfPaginasState>(INITIAL_STATE);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    const urls: string[] = [];
    setState({ ...INITIAL_STATE, isLoading: true });

    void (async () => {
      try {
        const data = await blob.arrayBuffer();
        await convertPdfPagesToJpegSequential(data, {
          maxPages: 80,
          maxEdge: MAX_EDGE[viewport],
          quality: 0.86,
          onPage: ({ pageNumber, totalPages, blob: pageBlob }) => {
            // Lança para interromper a conversão das páginas restantes.
            if (cancelled) throw new Error('cancelled');
            const url = URL.createObjectURL(pageBlob);
            urls.push(url);
            setState((prev) => ({
              ...prev,
              totalPaginas: totalPages,
              paginas: [...prev.paginas, { pageNumber, url }],
            }));
          },
        });
        if (!cancelled) setState((prev) => ({ ...prev, isLoading: false }));
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Não foi possível abrir o PDF.',
        }));
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [blob, viewport]);

  return state;
}

const INITIAL_STATE: OrcamentoPdfPaginasState = {
  paginas: [],
  totalPaginas: 0,
  isLoading: false,
  error: null,
};
