import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  leadAIAnalysesQueryKey,
} from '@/hooks/useLeadAIAnalyses';
import { invokeAnalyzeLeadPhotos, type AnalyzeLeadPhotosResult } from '@/lib/analyze-lead-photos-api';
import {
  resolveSelectedForAPI,
  type LeadAIMediaItem,
} from '@/lib/lead-ai-media-sources';
import { PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS } from '@/lib/pipeline-lead-ai-config';

export type LeadAIAnalysisJobStatus = 'preparing' | 'running' | 'completed' | 'error';

export interface LeadAIAnalysisBackgroundJob {
  id: string;
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  mediaItems: LeadAIMediaItem[];
  itemCount: number;
  status: LeadAIAnalysisJobStatus;
  startedAt: number;
  errorMessage?: string;
  result?: AnalyzeLeadPhotosResult;
}

export interface StartLeadAIAnalysisInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  itemsToAnalyze: LeadAIMediaItem[];
}

interface LeadAIAnalysisBackgroundContextValue {
  jobs: LeadAIAnalysisBackgroundJob[];
  startBackgroundAnalysis: (input: StartLeadAIAnalysisInput) => Promise<boolean>;
  isAnalyzingLead: (leadId: number) => boolean;
  getJobForLead: (leadId: number) => LeadAIAnalysisBackgroundJob | undefined;
  dismissJob: (jobId: string) => void;
  dismissCompletedJobs: () => void;
}

const LeadAIAnalysisBackgroundContext =
  createContext<LeadAIAnalysisBackgroundContextValue | null>(null);

function isActiveJob(status: LeadAIAnalysisJobStatus): boolean {
  return status === 'preparing' || status === 'running';
}

export function LeadAIAnalysisBackgroundProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<LeadAIAnalysisBackgroundJob[]>([]);
  const { schemaEmpresa } = useEmpresa();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const openLeadCard = useCallback(
    (leadId: number) => {
      navigate(`/pipeline?id=${leadId}&tab=analise-ia`);
    },
    [navigate],
  );

  const updateJob = useCallback(
    (jobId: string, patch: Partial<LeadAIAnalysisBackgroundJob>) => {
      setJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
      );
    },
    [],
  );

  const startBackgroundAnalysis = useCallback(
    async (input: StartLeadAIAnalysisInput): Promise<boolean> => {
      const { leadId, leadName, leadOrigin, itemsToAnalyze } = input;

      if (itemsToAnalyze.length === 0) return false;

      const jobId = crypto.randomUUID();
      const baseJob: LeadAIAnalysisBackgroundJob = {
        id: jobId,
        leadId,
        leadName,
        leadOrigin,
        mediaItems: itemsToAnalyze,
        itemCount: itemsToAnalyze.length,
        status: 'preparing',
        startedAt: Date.now(),
      };

      let shouldProceed = true;
      setJobs((current) => {
        const existingActive = current.find(
          (job) => job.leadId === leadId && isActiveJob(job.status),
        );
        if (existingActive) {
          shouldProceed = false;
          return current;
        }
        return [...current, baseJob];
      });

      if (!shouldProceed) {
        toast.info('Análise já em andamento', {
          description: 'Aguarde a conclusão ou navegue livremente enquanto a IA trabalha.',
        });
        return false;
      }

      toast.message('Análise IA em segundo plano', {
        description: 'Você pode fechar o card do lead e continuar usando o sistema.',
        duration: 5000,
      });

      try {
        const payload = await resolveSelectedForAPI(itemsToAnalyze);
        if (payload.length === 0) {
          throw new Error('Não foi possível preparar as imagens selecionadas');
        }

        const sentImages = payload.reduce(
          (total, entry) => total + (entry.pagesBase64?.length ?? 1),
          0,
        );
        if (sentImages >= PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS) {
          toast.info('Limite de páginas atingido', {
            description: `Foram enviadas as primeiras ${PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS} páginas/imagens para a IA.`,
          });
        } else {
          const pdfPages = payload
            .filter((entry) => entry.kind === 'pdf' && (entry.pagesBase64?.length ?? 0) > 0)
            .reduce((total, entry) => total + (entry.pagesBase64?.length ?? 0), 0);
          if (pdfPages > 1) {
            toast.message('PDF separado em páginas', {
              description: `${pdfPages} páginas convertidas em imagens para a análise.`,
              duration: 4000,
            });
          }
        }

        updateJob(jobId, { status: 'running', itemCount: sentImages });

        const result = await invokeAnalyzeLeadPhotos({
          leadId,
          leadName,
          leadOrigin,
          itens: payload,
          empresaSchema: schemaEmpresa,
        });

        updateJob(jobId, { status: 'completed', result });

        await queryClient.invalidateQueries({
          queryKey: leadAIAnalysesQueryKey(schemaEmpresa, leadId),
        });

        toast.success(
          result.perguntasBriefing
            ? 'Análise e perguntas de briefing concluídas'
            : 'Análise concluída',
          {
            description: leadName ? `Lead: ${leadName}` : undefined,
            action: {
              label: 'Ver resultado',
              onClick: () => openLeadCard(leadId),
            },
            duration: 12000,
          },
        );

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        updateJob(jobId, { status: 'error', errorMessage: message });
        toast.error('Não foi possível analisar as imagens', {
          description: message,
        });
        return false;
      }
    },
    [openLeadCard, queryClient, schemaEmpresa, updateJob],
  );

  const isAnalyzingLead = useCallback(
    (leadId: number) =>
      jobs.some((job) => job.leadId === leadId && isActiveJob(job.status)),
    [jobs],
  );

  const getJobForLead = useCallback(
    (leadId: number) => {
      const active = jobs.find(
        (job) => job.leadId === leadId && isActiveJob(job.status),
      );
      if (active) return active;

      return jobs.find(
        (job) =>
          job.leadId === leadId &&
          job.status === 'completed' &&
          Date.now() - job.startedAt < 5 * 60 * 1000,
      );
    },
    [jobs],
  );

  const dismissJob = useCallback((jobId: string) => {
    setJobs((current) => current.filter((job) => job.id !== jobId));
  }, []);

  const dismissCompletedJobs = useCallback(() => {
    setJobs((current) =>
      current.filter((job) => job.status === 'preparing' || job.status === 'running'),
    );
  }, []);

  const value = useMemo(
    () => ({
      jobs,
      startBackgroundAnalysis,
      isAnalyzingLead,
      getJobForLead,
      dismissJob,
      dismissCompletedJobs,
    }),
    [
      dismissCompletedJobs,
      dismissJob,
      getJobForLead,
      isAnalyzingLead,
      jobs,
      startBackgroundAnalysis,
    ],
  );

  return (
    <LeadAIAnalysisBackgroundContext.Provider value={value}>
      {children}
    </LeadAIAnalysisBackgroundContext.Provider>
  );
}

export function useLeadAIAnalysisBackground(): LeadAIAnalysisBackgroundContextValue {
  const context = useContext(LeadAIAnalysisBackgroundContext);
  if (!context) {
    return {
      jobs: [],
      startBackgroundAnalysis: async () => false,
      isAnalyzingLead: () => false,
      getJobForLead: () => undefined,
      dismissJob: () => {},
      dismissCompletedJobs: () => {},
    };
  }
  return context;
}
