import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { leadAIRendersQueryKey } from '@/hooks/useLeadAIRenders';
import {
  invokeRenderLeadProject,
  type RenderLeadProjectResult,
} from '@/lib/render-lead-project-api';
import {
  invokeEditLeadRender,
  type EditLeadRenderInput,
  type EditLeadRenderResult,
} from '@/lib/edit-lead-render-api';
import {
  invokeRenderLeadAmbiente,
  type RenderLeadAmbienteResult,
} from '@/lib/render-lead-ambiente-api';
import {
  resolveItemForRenderAPI,
  type LeadAIMediaItem,
  type ResolveItemForRenderOptions,
} from '@/lib/lead-ai-media-sources';

export type LeadAIRenderJobStatus = 'preparing' | 'running' | 'completed' | 'error';

export interface LeadAIRenderBackgroundJob {
  id: string;
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  mediaItem: LeadAIMediaItem;
  pdfPage?: number | null;
  status: LeadAIRenderJobStatus;
  startedAt: number;
  errorMessage?: string;
  result?: RenderLeadProjectResult;
}

export interface StartLeadAIRenderInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  selectedItem: LeadAIMediaItem;
  pdfPage?: number | null;
  caracteristicasExtras?: string;
  renderOptions?: ResolveItemForRenderOptions;
}

export interface LeadAIEditBackgroundJob {
  id: string;
  leadId: number;
  leadName?: string;
  imageLabel: string;
  pontoCount: number;
  thumbnailUrl?: string;
  status: LeadAIRenderJobStatus;
  startedAt: number;
  errorMessage?: string;
  result?: EditLeadRenderResult;
}

export interface StartLeadAIEditInput {
  leadId: number;
  leadName?: string;
  imageLabel: string;
  pontoCount: number;
  thumbnailUrl?: string;
  editPayload: Omit<EditLeadRenderInput, 'leadId' | 'empresaSchema'>;
}

export interface LeadAIAmbienteBackgroundJob {
  id: string;
  leadId: number;
  leadName?: string;
  status: LeadAIRenderJobStatus;
  startedAt: number;
  errorMessage?: string;
  result?: RenderLeadAmbienteResult;
}

export interface StartLeadAIAmbienteRenderInput {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  descricao?: string;
  analiseTexto?: string;
  compositionDataUrl?: string;
  sourceImageDataUrl?: string;
  cenaInventario?: string;
  furnitureReferences?: Array<{ label: string; dataUrl: string }>;
}

interface LeadAIRenderBackgroundContextValue {
  jobs: LeadAIRenderBackgroundJob[];
  editJobs: LeadAIEditBackgroundJob[];
  ambienteJobs: LeadAIAmbienteBackgroundJob[];
  startBackgroundRender: (input: StartLeadAIRenderInput) => Promise<boolean>;
  startBackgroundEdit: (input: StartLeadAIEditInput) => Promise<boolean>;
  startBackgroundAmbienteRender: (input: StartLeadAIAmbienteRenderInput) => Promise<boolean>;
  isRenderingLead: (leadId: number) => boolean;
  isEditingLead: (leadId: number) => boolean;
  getRenderJobForLead: (leadId: number) => LeadAIRenderBackgroundJob | undefined;
  getEditJobForLead: (leadId: number) => LeadAIEditBackgroundJob | undefined;
  getAmbienteJobForLead: (leadId: number) => LeadAIAmbienteBackgroundJob | undefined;
  dismissJob: (jobId: string) => void;
  dismissEditJob: (jobId: string) => void;
  dismissAmbienteJob: (jobId: string) => void;
  dismissCompletedJobs: () => void;
  dismissCompletedEditJobs: () => void;
  dismissCompletedAmbienteJobs: () => void;
}

const LeadAIRenderBackgroundContext =
  createContext<LeadAIRenderBackgroundContextValue | null>(null);

function isActiveJob(status: LeadAIRenderJobStatus): boolean {
  return status === 'preparing' || status === 'running';
}

export function LeadAIRenderBackgroundProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<LeadAIRenderBackgroundJob[]>([]);
  const [editJobs, setEditJobs] = useState<LeadAIEditBackgroundJob[]>([]);
  const [ambienteJobs, setAmbienteJobs] = useState<LeadAIAmbienteBackgroundJob[]>([]);
  const ambienteInFlightRef = useRef(new Set<number>());
  const { schemaEmpresa } = useEmpresa();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const openLeadRenderTab = useCallback(
    (leadId: number) => {
      navigate(`/pipeline?id=${leadId}&tab=analise-ia&iaSubtab=render`);
    },
    [navigate],
  );

  const invalidateRenderQueries = useCallback(
    async (leadId: number) => {
      await queryClient.invalidateQueries({
        queryKey: leadAIRendersQueryKey(schemaEmpresa, leadId),
      });
      await queryClient.invalidateQueries({
        queryKey: ['lead-pdfs', schemaEmpresa ?? 'master', leadId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['lead-midias-para-orcamento', schemaEmpresa, leadId],
      });
      await queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
    },
    [queryClient, schemaEmpresa],
  );

  const updateJob = useCallback(
    (jobId: string, patch: Partial<LeadAIRenderBackgroundJob>) => {
      setJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
      );
    },
    [],
  );

  const updateEditJob = useCallback(
    (jobId: string, patch: Partial<LeadAIEditBackgroundJob>) => {
      setEditJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
      );
    },
    [],
  );

  const startBackgroundRender = useCallback(
    async (input: StartLeadAIRenderInput): Promise<boolean> => {
      const { leadId, leadName, leadOrigin, selectedItem, pdfPage, caracteristicasExtras, renderOptions } =
        input;

      const jobId = crypto.randomUUID();
      const baseJob: LeadAIRenderBackgroundJob = {
        id: jobId,
        leadId,
        leadName,
        leadOrigin,
        mediaItem: selectedItem,
        pdfPage,
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
        toast.info('Renderização já em andamento', {
          description: 'Aguarde a conclusão ou navegue livremente enquanto a IA trabalha.',
        });
        return false;
      }

      toast.message('Renderização em segundo plano', {
        description: 'Você pode fechar o card do lead e continuar usando o sistema.',
        duration: 5000,
      });

      try {
        const payload = await resolveItemForRenderAPI(
          selectedItem,
          selectedItem.kind === 'pdf' ? (pdfPage ?? undefined) : undefined,
          renderOptions,
        );
        if (!payload) {
          throw new Error('Não foi possível preparar a imagem selecionada');
        }

        updateJob(jobId, { status: 'running' });

        const result = await invokeRenderLeadProject({
          leadId,
          leadName,
          leadOrigin,
          item: payload,
          caracteristicasExtras,
          empresaSchema: schemaEmpresa,
        });

        updateJob(jobId, { status: 'completed', result });

        await invalidateRenderQueries(leadId);

        toast.success('Renderização concluída e adicionada aos anexos do lead', {
          description: leadName ? `Lead: ${leadName}` : undefined,
          action: {
            label: 'Ver resultado',
            onClick: () => openLeadRenderTab(leadId),
          },
          duration: 12000,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        updateJob(jobId, { status: 'error', errorMessage: message });
        toast.error('Não foi possível renderizar o projeto', {
          description: message,
        });
        return false;
      }
    },
    [invalidateRenderQueries, openLeadRenderTab, schemaEmpresa, updateJob],
  );

  const startBackgroundEdit = useCallback(
    async (input: StartLeadAIEditInput): Promise<boolean> => {
      const { leadId, leadName, imageLabel, pontoCount, thumbnailUrl, editPayload } = input;

      const jobId = crypto.randomUUID();
      const baseJob: LeadAIEditBackgroundJob = {
        id: jobId,
        leadId,
        leadName,
        imageLabel,
        pontoCount,
        thumbnailUrl,
        status: 'running',
        startedAt: Date.now(),
      };

      let shouldProceed = true;
      setEditJobs((current) => {
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
        toast.info('Edição já em andamento', {
          description: 'Aguarde a conclusão ou continue usando o sistema enquanto a IA trabalha.',
        });
        return false;
      }

      toast.message('Edição em segundo plano', {
        description: 'Você pode fechar este painel e continuar usando o CRM.',
        duration: 5000,
      });

      try {
        const result = await invokeEditLeadRender({
          leadId,
          empresaSchema: schemaEmpresa,
          ...editPayload,
        });

        updateEditJob(jobId, { status: 'completed', result });

        await invalidateRenderQueries(leadId);

        toast.success('Edição salva no lead — você já pode baixar ou excluir', {
          description: leadName ? `${leadName} · ${imageLabel}` : imageLabel,
          action: {
            label: 'Ver resultado',
            onClick: () => openLeadRenderTab(leadId),
          },
          duration: 12000,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        updateEditJob(jobId, { status: 'error', errorMessage: message });
        toast.error('Não foi possível aplicar a edição', {
          description: message,
        });
        return false;
      }
    },
    [invalidateRenderQueries, openLeadRenderTab, schemaEmpresa, updateEditJob],
  );

  const updateAmbienteJob = useCallback(
    (jobId: string, patch: Partial<LeadAIAmbienteBackgroundJob>) => {
      setAmbienteJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
      );
    },
    [],
  );

  const startBackgroundAmbienteRender = useCallback(
    async (input: StartLeadAIAmbienteRenderInput): Promise<boolean> => {
      const {
        leadId,
        leadName,
        leadOrigin,
        descricao,
        analiseTexto,
        compositionDataUrl,
        sourceImageDataUrl,
        cenaInventario,
        furnitureReferences,
      } = input;

      if (ambienteInFlightRef.current.has(leadId)) {
        toast.info('Renderização de ambiente já em andamento', {
          description: 'Aguarde a conclusão. Clicar de novo gera imagens extras.',
        });
        return false;
      }
      ambienteInFlightRef.current.add(leadId);

      const jobId = crypto.randomUUID();
      const baseJob: LeadAIAmbienteBackgroundJob = {
        id: jobId,
        leadId,
        leadName,
        status: 'running',
        startedAt: Date.now(),
      };

      let shouldProceed = true;
      setAmbienteJobs((current) => {
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
        ambienteInFlightRef.current.delete(leadId);
        toast.info('Renderização de ambiente já em andamento', {
          description: 'Aguarde a conclusão ou continue usando o sistema enquanto a IA trabalha.',
        });
        return false;
      }

      toast.message('Renderização de ambiente em segundo plano', {
        description: 'Você pode fechar o card do lead e continuar usando o sistema.',
        duration: 5000,
      });

      try {
        const result = await invokeRenderLeadAmbiente({
          leadId,
          leadName,
          leadOrigin,
          descricao,
          analiseTexto,
          cenaInventario,
          compositionDataUrl,
          sourceImageDataUrl,
          furnitureReferences,
          empresaSchema: schemaEmpresa,
        });

        updateAmbienteJob(jobId, { status: 'completed', result });
        await invalidateRenderQueries(leadId);

        toast.success('Ambiente salvo no lead — você já pode baixar ou excluir', {
          description: leadName ? `Lead: ${leadName}` : undefined,
          action: {
            label: 'Ver resultado',
            onClick: () => openLeadRenderTab(leadId),
          },
          duration: 12000,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        updateAmbienteJob(jobId, { status: 'error', errorMessage: message });
        toast.error('Não foi possível renderizar o ambiente', {
          description: message,
        });
        return false;
      } finally {
        ambienteInFlightRef.current.delete(leadId);
      }
    },
    [invalidateRenderQueries, openLeadRenderTab, schemaEmpresa, updateAmbienteJob],
  );

  const isRenderingLead = useCallback(
    (leadId: number) =>
      jobs.some((job) => job.leadId === leadId && isActiveJob(job.status)) ||
      ambienteJobs.some((job) => job.leadId === leadId && isActiveJob(job.status)),
    [ambienteJobs, jobs],
  );

  const getRenderJobForLead = useCallback(
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

  const isEditingLead = useCallback(
    (leadId: number) =>
      editJobs.some((job) => job.leadId === leadId && isActiveJob(job.status)),
    [editJobs],
  );

  const getEditJobForLead = useCallback(
    (leadId: number) => {
      const active = editJobs.find(
        (job) => job.leadId === leadId && isActiveJob(job.status),
      );
      if (active) return active;

      return editJobs.find(
        (job) =>
          job.leadId === leadId &&
          job.status === 'completed' &&
          Date.now() - job.startedAt < 5 * 60 * 1000,
      );
    },
    [editJobs],
  );

  const getAmbienteJobForLead = useCallback(
    (leadId: number) => {
      const active = ambienteJobs.find(
        (job) => job.leadId === leadId && isActiveJob(job.status),
      );
      if (active) return active;

      return ambienteJobs.find(
        (job) =>
          job.leadId === leadId &&
          job.status === 'completed' &&
          Date.now() - job.startedAt < 5 * 60 * 1000,
      );
    },
    [ambienteJobs],
  );

  const dismissEditJob = useCallback((jobId: string) => {
    setEditJobs((current) => current.filter((job) => job.id !== jobId));
  }, []);

  const dismissCompletedEditJobs = useCallback(() => {
    setEditJobs((current) =>
      current.filter((job) => job.status === 'preparing' || job.status === 'running'),
    );
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    setJobs((current) => current.filter((job) => job.id !== jobId));
  }, []);

  const dismissCompletedJobs = useCallback(() => {
    setJobs((current) =>
      current.filter((job) => job.status === 'preparing' || job.status === 'running'),
    );
  }, []);

  const dismissAmbienteJob = useCallback((jobId: string) => {
    setAmbienteJobs((current) => current.filter((job) => job.id !== jobId));
  }, []);

  const dismissCompletedAmbienteJobs = useCallback(() => {
    setAmbienteJobs((current) =>
      current.filter((job) => job.status === 'preparing' || job.status === 'running'),
    );
  }, []);

  const value = useMemo(
    () => ({
      jobs,
      editJobs,
      ambienteJobs,
      startBackgroundRender,
      startBackgroundEdit,
      startBackgroundAmbienteRender,
      isRenderingLead,
      isEditingLead,
      getRenderJobForLead,
      getEditJobForLead,
      getAmbienteJobForLead,
      dismissJob,
      dismissEditJob,
      dismissAmbienteJob,
      dismissCompletedJobs,
      dismissCompletedEditJobs,
      dismissCompletedAmbienteJobs,
    }),
    [
      ambienteJobs,
      dismissAmbienteJob,
      dismissCompletedAmbienteJobs,
      dismissCompletedEditJobs,
      dismissCompletedJobs,
      dismissEditJob,
      dismissJob,
      editJobs,
      getAmbienteJobForLead,
      getEditJobForLead,
      getRenderJobForLead,
      isEditingLead,
      isRenderingLead,
      jobs,
      startBackgroundAmbienteRender,
      startBackgroundEdit,
      startBackgroundRender,
    ],
  );

  return (
    <LeadAIRenderBackgroundContext.Provider value={value}>
      {children}
    </LeadAIRenderBackgroundContext.Provider>
  );
}

export function useLeadAIRenderBackground(): LeadAIRenderBackgroundContextValue {
  const context = useContext(LeadAIRenderBackgroundContext);
  if (!context) {
    return {
      jobs: [],
      editJobs: [],
      ambienteJobs: [],
      startBackgroundRender: async () => false,
      startBackgroundEdit: async () => false,
      startBackgroundAmbienteRender: async () => false,
      isRenderingLead: () => false,
      isEditingLead: () => false,
      getRenderJobForLead: () => undefined,
      getEditJobForLead: () => undefined,
      getAmbienteJobForLead: () => undefined,
      dismissJob: () => {},
      dismissEditJob: () => {},
      dismissAmbienteJob: () => {},
      dismissCompletedJobs: () => {},
      dismissCompletedEditJobs: () => {},
      dismissCompletedAmbienteJobs: () => {},
    };
  }
  return context;
}
