import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  PIPELINE_DASHBOARD_LABEL_DEFAULTS,
  type PipelineDashboardLabelKey,
  type PipelineDashboardLabels,
  loadPipelineDashboardLabels,
  savePipelineDashboardLabels,
} from '@/lib/pipeline-dashboard-labels';

interface PipelineDashboardLabelsContextValue {
  canEdit: boolean;
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  getLabel: (key: PipelineDashboardLabelKey, fallback?: string) => string;
  setLabel: (key: PipelineDashboardLabelKey, value: string) => void;
  resetLabel: (key: PipelineDashboardLabelKey) => void;
  resetAllLabels: () => void;
}

const PipelineDashboardLabelsContext =
  createContext<PipelineDashboardLabelsContextValue | null>(null);

interface PipelineDashboardLabelsProviderProps {
  children: ReactNode;
  canEdit?: boolean;
}

export function PipelineDashboardLabelsProvider({
  children,
  canEdit = false,
}: PipelineDashboardLabelsProviderProps) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id ?? null;
  const [labels, setLabels] = useState<PipelineDashboardLabels>({});
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setLabels(loadPipelineDashboardLabels(empresaId));
    setEditMode(false);
  }, [empresaId]);

  const persist = useCallback(
    (next: PipelineDashboardLabels) => {
      setLabels(next);
      savePipelineDashboardLabels(empresaId, next);
    },
    [empresaId]
  );

  const getLabel = useCallback(
    (key: PipelineDashboardLabelKey, fallback?: string) => {
      const custom = labels[key]?.trim();
      if (custom) return custom;
      return fallback ?? PIPELINE_DASHBOARD_LABEL_DEFAULTS[key];
    },
    [labels]
  );

  const setLabel = useCallback(
    (key: PipelineDashboardLabelKey, value: string) => {
      const trimmed = value.trim();
      const next = { ...labels };
      if (!trimmed || trimmed === PIPELINE_DASHBOARD_LABEL_DEFAULTS[key]) {
        delete next[key];
      } else {
        next[key] = trimmed;
      }
      persist(next);
    },
    [labels, persist]
  );

  const resetLabel = useCallback(
    (key: PipelineDashboardLabelKey) => {
      const next = { ...labels };
      delete next[key];
      persist(next);
    },
    [labels, persist]
  );

  const resetAllLabels = useCallback(() => {
    persist({});
  }, [persist]);

  const value = useMemo(
    () => ({
      canEdit,
      editMode,
      setEditMode,
      getLabel,
      setLabel,
      resetLabel,
      resetAllLabels,
    }),
    [canEdit, editMode, getLabel, setLabel, resetLabel, resetAllLabels]
  );

  return (
    <PipelineDashboardLabelsContext.Provider value={value}>
      {children}
    </PipelineDashboardLabelsContext.Provider>
  );
}

export function usePipelineDashboardLabels() {
  const ctx = useContext(PipelineDashboardLabelsContext);
  if (!ctx) {
    throw new Error(
      'usePipelineDashboardLabels deve ser usado dentro de PipelineDashboardLabelsProvider'
    );
  }
  return ctx;
}

/** Uso opcional fora do provider — retorna apenas o rótulo padrão. */
export function usePipelineDashboardLabelsOptional() {
  return useContext(PipelineDashboardLabelsContext);
}
