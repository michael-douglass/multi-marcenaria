import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  PAGE_ZOOM_DEFAULT,
  PAGE_ZOOM_MAX,
  PAGE_ZOOM_MIN,
  PAGE_ZOOM_STEP,
  clampPageZoom,
} from '@/lib/page-zoom-preferences';

export function usePageZoom() {
  const { user } = useAuth();
  const [zoomPercent, setZoomPercent] = useState(PAGE_ZOOM_DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchZoom = async () => {
      if (!user) {
        setZoomPercent(PAGE_ZOOM_DEFAULT);
        setReady(true);
        return;
      }

      setReady(false);
      const { data, error } = await supabase
        .from('crm_multiempresas_ui_preferences')
        .select('page_zoom')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Erro ao buscar zoom da tela:', error);
        setZoomPercent(PAGE_ZOOM_DEFAULT);
      } else {
        setZoomPercent(clampPageZoom(data?.page_zoom ?? PAGE_ZOOM_DEFAULT));
      }
      setReady(true);
    };

    void fetchZoom();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const persist = useCallback(
    async (next: number) => {
      if (!user) return;

      const { error } = await supabase.from('crm_multiempresas_ui_preferences').upsert(
        {
          user_id: user.id,
          page_zoom: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        console.error('Erro ao salvar zoom da tela:', error);
      }
    },
    [user],
  );

  const setZoom = useCallback(
    (next: number) => {
      const clamped = clampPageZoom(next);
      setZoomPercent(clamped);
      void persist(clamped);
    },
    [persist],
  );

  const zoomIn = useCallback(() => {
    setZoom(zoomPercent + PAGE_ZOOM_STEP);
  }, [setZoom, zoomPercent]);

  const zoomOut = useCallback(() => {
    setZoom(zoomPercent - PAGE_ZOOM_STEP);
  }, [setZoom, zoomPercent]);

  const canZoomIn = zoomPercent < PAGE_ZOOM_MAX;
  const canZoomOut = zoomPercent > PAGE_ZOOM_MIN;

  return {
    zoomPercent,
    ready,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
    setZoom,
  };
}
