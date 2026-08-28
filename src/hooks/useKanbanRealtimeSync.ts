import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { isEmpresaSchema, isSchemaApiExposed, resolveLeadsQueryConfig } from '@/lib/empresa-tables';
import type { LeadWithVendor } from '@/hooks/useLeads';
import { patchLeadInAllCaches, removeLeadFromAllCaches } from '@/lib/leads-cache';
import { shouldIgnoreRealtimeLeadUpdate } from '@/lib/lead-update-guard';

/**
 * Mantém o cache de leads atualizado em tempo real sem refetch agressivo
 * (evita sobrescrever edições em andamento com dados antigos).
 */
export function useKanbanRealtimeSync() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const leadsConfig = resolveLeadsQueryConfig(schemaEmpresa);

  useEffect(() => {
    const invalidateKanbanConfig = () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-config-pages'] });
    };

    const applyLeadRow = (
      eventType: string,
      rowNew: Record<string, unknown> | null,
      rowOld: Record<string, unknown> | null,
    ) => {
      if (eventType === 'DELETE' && rowOld?.id != null) {
        removeLeadFromAllCaches(queryClient, Number(rowOld.id));
        queryClient.invalidateQueries({ queryKey: ['leads', 'manutencao-attention-count'] });
        return;
      }

      if (eventType === 'INSERT' && rowNew?.id != null) {
        queryClient.invalidateQueries({ queryKey: ['leads', 'kanban-page'] });
        queryClient.invalidateQueries({ queryKey: ['leads', 'manutencao-attention-count'] });
        return;
      }

      if (!rowNew?.id) return;
      const leadId = Number(rowNew.id);
      if (shouldIgnoreRealtimeLeadUpdate(leadId)) return;

      patchLeadInAllCaches(queryClient, leadId, rowNew as Partial<LeadWithVendor>);

      const statusChanged =
        rowOld != null &&
        Object.prototype.hasOwnProperty.call(rowOld, 'status') &&
        rowOld.status !== rowNew.status;
      if (statusChanged || rowOld == null) {
        queryClient.invalidateQueries({ queryKey: ['leads', 'manutencao-attention-count'] });
      }
    };

    const channel = supabase
      .channel(`kanban-leads-sync-${schemaEmpresa ?? 'master'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: leadsConfig.schema ?? 'public',
          table: leadsConfig.leadsTable,
        },
        (payload) =>
          applyLeadRow('INSERT', (payload.new as Record<string, unknown>) ?? null, null),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: leadsConfig.schema ?? 'public',
          table: leadsConfig.leadsTable,
        },
        (payload) =>
          applyLeadRow(
            'UPDATE',
            (payload.new as Record<string, unknown>) ?? null,
            (payload.old as Record<string, unknown>) ?? null,
          ),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: leadsConfig.schema ?? 'public',
          table: leadsConfig.leadsTable,
        },
        (payload) =>
          applyLeadRow(
            'DELETE',
            null,
            (payload.old as Record<string, unknown>) ?? null,
          ),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'CRM-multi-empresas>kanban_pages<' }, invalidateKanbanConfig)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'CRM-multi-empresas>kanban_columns<' }, invalidateKanbanConfig)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'CRM-multi-empresas>kanban_column_sources<' }, invalidateKanbanConfig)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'CRM-multi-empresas>kanban_card_overrides<' }, invalidateKanbanConfig);

    if (isSchemaApiExposed(schemaEmpresa) && isEmpresaSchema(schemaEmpresa)) {
      channel
        .on('postgres_changes', { event: '*', schema: schemaEmpresa, table: 'kanban_pages' }, invalidateKanbanConfig)
        .on('postgres_changes', { event: '*', schema: schemaEmpresa, table: 'kanban_columns' }, invalidateKanbanConfig)
        .on('postgres_changes', { event: '*', schema: schemaEmpresa, table: 'kanban_column_sources' }, invalidateKanbanConfig)
        .on('postgres_changes', { event: '*', schema: schemaEmpresa, table: 'kanban_card_overrides' }, invalidateKanbanConfig);
    }

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'CRM-multi-empresas>pipeline_custom_stages<' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pipeline-custom-stages'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, leadsConfig.schema, leadsConfig.leadsTable, schemaEmpresa]);
}
