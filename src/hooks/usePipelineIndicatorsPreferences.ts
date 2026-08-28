import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_PIPELINE_INDICATORS,
  normalizePipelineIndicators,
  type PipelineIndicatorKey,
  type PipelineIndicatorsState,
} from '@/lib/pipeline-indicators-preferences';

export function usePipelineIndicatorsPreferences() {
  const { user } = useAuth();
  const [indicators, setIndicators] = useState<PipelineIndicatorsState>(DEFAULT_PIPELINE_INDICATORS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchPreferences = async () => {
      if (!user) {
        setIndicators(DEFAULT_PIPELINE_INDICATORS);
        setReady(true);
        return;
      }

      setReady(false);
      const { data, error } = await supabase
        .from('crm_multiempresas_ui_preferences')
        .select('pipeline_indicators')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Erro ao buscar preferências da pipeline:', error);
        setIndicators(DEFAULT_PIPELINE_INDICATORS);
      } else {
        setIndicators(normalizePipelineIndicators(data?.pipeline_indicators));
      }
      setReady(true);
    };

    void fetchPreferences();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const persist = useCallback(
    async (next: PipelineIndicatorsState) => {
      if (!user) return;

      const { error } = await supabase.from('crm_multiempresas_ui_preferences').upsert(
        {
          user_id: user.id,
          pipeline_indicators: next as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        console.error('Erro ao salvar preferências da pipeline:', error);
      }
    },
    [user],
  );

  const applyAndPersist = useCallback(
    (updater: (prev: PipelineIndicatorsState) => PipelineIndicatorsState) => {
      setIndicators((prev) => {
        const next = updater(prev);
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const setMetricsOpen = useCallback(
    (open: boolean) => {
      applyAndPersist((prev) => ({ ...prev, metricsOpen: open }));
    },
    [applyAndPersist],
  );

  const setChartOpen = useCallback(
    (open: boolean) => {
      applyAndPersist((prev) => ({ ...prev, chartOpen: open }));
    },
    [applyAndPersist],
  );

  const setSectionOpen = useCallback(
    (open: boolean) => {
      applyAndPersist((prev) => ({ ...prev, sectionOpen: open }));
    },
    [applyAndPersist],
  );

  const setCardOpen = useCallback(
    (key: PipelineIndicatorKey, open: boolean) => {
      applyAndPersist((prev) => ({
        ...prev,
        cards: { ...prev.cards, [key]: open },
      }));
    },
    [applyAndPersist],
  );

  return {
    indicators,
    ready,
    setMetricsOpen,
    setChartOpen,
    setSectionOpen,
    setCardOpen,
  };
}
