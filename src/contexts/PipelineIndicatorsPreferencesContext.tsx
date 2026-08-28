import { createContext, useContext, type ReactNode } from 'react';
import { usePipelineIndicatorsPreferences } from '@/hooks/usePipelineIndicatorsPreferences';
import type { PipelineIndicatorKey, PipelineIndicatorsState } from '@/lib/pipeline-indicators-preferences';

interface PipelineIndicatorsPreferencesContextValue {
  indicators: PipelineIndicatorsState;
  /** Preferências já carregadas do banco — evita flash aberto antes de aplicar oculto. */
  ready: boolean;
  setMetricsOpen: (open: boolean) => void;
  setChartOpen: (open: boolean) => void;
  setSectionOpen: (open: boolean) => void;
  setCardOpen: (key: PipelineIndicatorKey, open: boolean) => void;
}

const PipelineIndicatorsPreferencesContext =
  createContext<PipelineIndicatorsPreferencesContextValue | null>(null);

export function PipelineIndicatorsPreferencesProvider({ children }: { children: ReactNode }) {
  const value = usePipelineIndicatorsPreferences();
  return (
    <PipelineIndicatorsPreferencesContext.Provider value={value}>
      {children}
    </PipelineIndicatorsPreferencesContext.Provider>
  );
}

export function usePipelineIndicatorsPreferencesContext() {
  const ctx = useContext(PipelineIndicatorsPreferencesContext);
  if (!ctx) {
    throw new Error(
      'usePipelineIndicatorsPreferencesContext deve ser usado dentro de PipelineIndicatorsPreferencesProvider',
    );
  }
  return ctx;
}
