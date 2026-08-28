import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  FLOATING_AGENDA_ZOOM_DEFAULT,
  FLOATING_AGENDA_ZOOM_MAX,
  FLOATING_AGENDA_ZOOM_MIN,
  FLOATING_AGENDA_ZOOM_STEP,
  clampFloatingAgendaZoom,
} from '@/lib/floating-agenda-zoom-preferences';

export function useFloatingAgendaZoom() {
  const { user } = useAuth();
  const [zoomPercent, setZoomPercent] = useState(FLOATING_AGENDA_ZOOM_DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchZoom = async () => {
      if (!user) {
        setZoomPercent(FLOATING_AGENDA_ZOOM_DEFAULT);
        setReady(true);
        return;
      }

      setReady(false);
      const { data, error } = await supabase
        .from('crm_multiempresas_ui_preferences')
        .select('floating_agenda_zoom')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Erro ao buscar zoom da Agenda Geral:', error);
        setZoomPercent(FLOATING_AGENDA_ZOOM_DEFAULT);
      } else {
        setZoomPercent(clampFloatingAgendaZoom(data?.floating_agenda_zoom ?? FLOATING_AGENDA_ZOOM_DEFAULT));
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
          floating_agenda_zoom: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        console.error('Erro ao salvar zoom da Agenda Geral:', error);
      }
    },
    [user],
  );

  const setZoom = useCallback(
    (next: number) => {
      const clamped = clampFloatingAgendaZoom(next);
      setZoomPercent(clamped);
      void persist(clamped);
    },
    [persist],
  );

  const zoomIn = useCallback(() => {
    setZoom(zoomPercent + FLOATING_AGENDA_ZOOM_STEP);
  }, [setZoom, zoomPercent]);

  const zoomOut = useCallback(() => {
    setZoom(zoomPercent - FLOATING_AGENDA_ZOOM_STEP);
  }, [setZoom, zoomPercent]);

  const canZoomIn = zoomPercent < FLOATING_AGENDA_ZOOM_MAX;
  const canZoomOut = zoomPercent > FLOATING_AGENDA_ZOOM_MIN;

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
