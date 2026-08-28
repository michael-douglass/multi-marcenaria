import { useEffect, useState } from 'react';
import { renderPdfToImages, type PdfPageImage } from '@/lib/pdf-render';

const PDF_PREVIEW_WIDTH_PX = 1200;

interface UsePdfPageImagesResult {
  pages: PdfPageImage[];
  loading: boolean;
  error: string | null;
}

export function usePdfPageImages(pdfUrl: string | null | undefined): UsePdfPageImagesResult {
  const [pages, setPages] = useState<PdfPageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfUrl?.trim()) {
      setPages([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);

    renderPdfToImages(pdfUrl, PDF_PREVIEW_WIDTH_PX)
      .then((result) => {
        if (!cancelled) setPages(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error('Erro ao converter PDF em imagens:', err);
          setError('Não foi possível abrir este PDF como imagem.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  return { pages, loading, error };
}
