import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';

interface UseOrcamentoSlideRealtimeOptions {
  orcamentoId?: string | null;
  templateId?: string | null;
  schema?: string | null;
  onOrcamentoChange?: () => void;
  onBlocosChange?: () => void;
  enabled?: boolean;
}

/**
 * Atualiza apresentação / link público quando o orçamento ou os blocos do template mudam.
 */
export function useOrcamentoSlideRealtime({
  orcamentoId,
  templateId,
  schema,
  onOrcamentoChange,
  onBlocosChange,
  enabled = true,
}: UseOrcamentoSlideRealtimeOptions) {
  const db = useEmpresaSupabase();
  const schemaNome = schema ?? (isSchemaApiExposed(db.schema) ? db.schema : 'public');

  useEffect(() => {
    if (!enabled || !orcamentoId || !schemaNome) return;

    const channel = supabase
      .channel(`orcamento-slide-live-${schemaNome}-${orcamentoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: schemaNome,
          table: 'orcamento_slides',
          filter: `id=eq.${orcamentoId}`,
        },
        () => onOrcamentoChange?.(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, orcamentoId, schemaNome, onOrcamentoChange]);

  useEffect(() => {
    if (!enabled || !templateId || !schemaNome) return;

    const channel = supabase
      .channel(`orcamento-blocos-live-${schemaNome}-${templateId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: schemaNome,
          table: 'orcamento_slide_blocos',
          filter: `template_id=eq.${templateId}`,
        },
        () => onBlocosChange?.(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, templateId, schemaNome, onBlocosChange]);
}
