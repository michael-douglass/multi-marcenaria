import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type { OrcamentoExportViewport } from '@/components/orcamento-slides/OrcamentoSlideExportMenu';
import {
  OrcamentoSlideExportJobRunner,
  type OrcamentoSlideExportPresentationProps,
} from '@/components/orcamento-slides/OrcamentoSlideExportJobRunner';
import type { OrcamentoExportFormat, OrcamentoPdfPronto } from '@/lib/orcamento-slide-export';

const OrcamentoPdfPreviewDialog = lazy(() =>
  import('@/components/orcamento-slides/pdf-preview/OrcamentoPdfPreviewDialog').then((m) => ({
    default: m.OrcamentoPdfPreviewDialog,
  })),
);

export interface StartOrcamentoSlideExportInput {
  orcamentoId: string;
  titulo: string;
  viewport: OrcamentoExportViewport;
  format: OrcamentoExportFormat;
  /** Snapshot da apresentação aberta (opcional). */
  presentationProps?: OrcamentoSlideExportPresentationProps | null;
}

interface OrcamentoSlideExportBackgroundJob extends StartOrcamentoSlideExportInput {
  id: string;
  startedAt: number;
}

interface OrcamentoSlideExportBackgroundContextValue {
  jobs: OrcamentoSlideExportBackgroundJob[];
  startBackgroundExport: (input: StartOrcamentoSlideExportInput) => string | null;
  isExportingOrcamento: (orcamentoId: string) => boolean;
}

const OrcamentoSlideExportBackgroundContext =
  createContext<OrcamentoSlideExportBackgroundContextValue | null>(null);

function newJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `orc-export-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Mantém a geração de PDF/imagens viva fora do card do lead e da apresentação.
 * Fechar, minimizar ou sair do orçamento não cancela o job.
 */
export function OrcamentoSlideExportBackgroundProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<OrcamentoSlideExportBackgroundJob[]>([]);
  const [pdfPreview, setPdfPreview] = useState<OrcamentoPdfPronto | null>(null);
  const closePdfPreview = useCallback(() => setPdfPreview(null), []);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const settleJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  const startBackgroundExport = useCallback((input: StartOrcamentoSlideExportInput) => {
    if (jobsRef.current.some((job) => job.orcamentoId === input.orcamentoId)) {
      toast.message('Exportação já em andamento', {
        description: 'Aguarde o arquivo atual terminar antes de pedir outro.',
      });
      return null;
    }

    const id = newJobId();
    setJobs((prev) => {
      if (prev.some((job) => job.orcamentoId === input.orcamentoId)) return prev;
      return [
        ...prev,
        {
          id,
          orcamentoId: input.orcamentoId,
          titulo: input.titulo,
          viewport: input.viewport,
          format: input.format,
          presentationProps: input.presentationProps ?? null,
          startedAt: Date.now(),
        },
      ];
    });

    toast.message('Exportação em segundo plano', {
      description: 'Pode fechar o card ou sair do orçamento. Avisamos quando o arquivo estiver pronto.',
      duration: 4500,
    });

    return id;
  }, []);

  const isExportingOrcamento = useCallback(
    (orcamentoId: string) => jobs.some((job) => job.orcamentoId === orcamentoId),
    [jobs],
  );

  const value = useMemo(
    () => ({
      jobs,
      startBackgroundExport,
      isExportingOrcamento,
    }),
    [jobs, startBackgroundExport, isExportingOrcamento],
  );

  return (
    <OrcamentoSlideExportBackgroundContext.Provider value={value}>
      {children}
      {jobs.map((job) => (
        <OrcamentoSlideExportJobRunner
          key={job.id}
          orcamentoId={job.orcamentoId}
          titulo={job.titulo}
          viewport={job.viewport}
          format={job.format}
          presentationProps={job.presentationProps}
          onSettled={() => settleJob(job.id)}
          onPdfReady={setPdfPreview}
        />
      ))}
      {pdfPreview && (
        <Suspense fallback={null}>
          <OrcamentoPdfPreviewDialog
            key={pdfPreview.blob.size + pdfPreview.viewport}
            pdf={pdfPreview}
            onClose={closePdfPreview}
          />
        </Suspense>
      )}
    </OrcamentoSlideExportBackgroundContext.Provider>
  );
}

export function useOrcamentoSlideExportBackground(): OrcamentoSlideExportBackgroundContextValue {
  const context = useContext(OrcamentoSlideExportBackgroundContext);
  if (!context) {
    return {
      jobs: [],
      startBackgroundExport: () => null,
      isExportingOrcamento: () => false,
    };
  }
  return context;
}
