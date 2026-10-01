import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useMarkupConfig } from '@/hooks/useMarkupConfig';
import {
  leadNegociadorConfigQueryKey,
  markupSchemaExtra,
  resolveMarkupTable,
} from '@/lib/markup-tables';
import {
  type LeadNegociadorConfigRow,
  type NegociadorConfigEfetiva,
  type NegociadorSplits,
  normalizarMargemMinimaPercent,
  normalizarSplits,
  resolverNegociadorConfig,
  validarSplits,
} from '@/lib/negociador-calculo';

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseLeadConfig(row: Record<string, unknown>): LeadNegociadorConfigRow {
  return {
    lead_id: asNumber(row.lead_id),
    margem_minima_percent: asNumber(row.margem_minima_percent, 100),
    pct_material: asNumber(row.pct_material, 33.34),
    pct_mao_obra: asNumber(row.pct_mao_obra, 33.33),
    pct_lucro: asNumber(row.pct_lucro, 33.33),
  };
}

export type NegociadorConfigEscopo = 'lead' | 'global';

export interface SalvarNegociadorConfigInput {
  escopo: NegociadorConfigEscopo;
  margemMinimaPercent: number;
  splits: NegociadorSplits;
  /** Se true e escopo=lead, remove o override e volta a usar a global. */
  limparOverrideLead?: boolean;
}

/**
 * Config efetiva do Negociador para um lead:
 * - override salvo neste cliente, ou
 * - padrão de todos os clientes (markup_config).
 */
export function useLeadNegociadorConfig(leadId?: number | null) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const { config: globalConfig, salvarConfig, isLoading: loadingGlobal } = useMarkupConfig();
  const table = resolveMarkupTable(schemaEmpresa, 'leadNegociadorConfig');

  const leadQuery = useQuery({
    queryKey: leadNegociadorConfigQueryKey(schemaEmpresa, leadId),
    enabled: !!user?.id && queriesReady && leadId != null,
    queryFn: async (): Promise<LeadNegociadorConfigRow | null> => {
      const { data, error } = await db
        .from(table as 'lead_negociador_config')
        .select('*')
        .eq('lead_id', leadId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return parseLeadConfig(data as Record<string, unknown>);
    },
  });

  const efetiva: NegociadorConfigEfetiva = resolverNegociadorConfig(
    globalConfig,
    leadQuery.data ?? null,
  );

  const salvar = useMutation({
    mutationFn: async (input: SalvarNegociadorConfigInput) => {
      const margem = normalizarMargemMinimaPercent(input.margemMinimaPercent);
      const splits = normalizarSplits(input.splits);
      if (!validarSplits(splits)) {
        throw new Error('Os percentuais de Material, Mão de obra e Lucro precisam somar 100%.');
      }

      if (input.escopo === 'global') {
        await salvarConfig.mutateAsync({
          negociador_margem_minima_percent: margem,
          negociador_pct_material: splits.material,
          negociador_pct_mao_obra: splits.maoObra,
          negociador_pct_lucro: splits.lucro,
          silent: true,
        });
        return { escopo: 'global' as const };
      }

      if (leadId == null) {
        throw new Error('Salve o lead antes de configurar a margem deste cliente.');
      }

      if (input.limparOverrideLead) {
        const { error } = await db
          .from(table as 'lead_negociador_config')
          .delete()
          .eq('lead_id', leadId);
        if (error) throw error;
        return { escopo: 'lead' as const, limpo: true };
      }

      const payload = {
        lead_id: leadId,
        margem_minima_percent: margem,
        pct_material: splits.material,
        pct_mao_obra: splits.maoObra,
        pct_lucro: splits.lucro,
        atualizado_por: user?.id ?? null,
        atualizado_em: new Date().toISOString(),
        ...markupSchemaExtra(schemaEmpresa),
      };

      const { error } = await db
        .from(table as 'lead_negociador_config')
        .upsert(payload, { onConflict: 'lead_id' });
      if (error) throw error;
      return { escopo: 'lead' as const, limpo: false };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({
        queryKey: leadNegociadorConfigQueryKey(schemaEmpresa, leadId),
      });
      if (result.escopo === 'global') {
        toast.success('Configuração salva para todos os clientes');
        return;
      }
      if ('limpo' in result && result.limpo) {
        toast.success('Este cliente voltou a usar a margem geral');
      } else {
        toast.success('Configuração salva só para este cliente');
      }
    },
    onError: (e: Error) =>
      toast.error('Não foi possível salvar a configuração', { description: e.message }),
  });

  return {
    isLoading: loadingGlobal || leadQuery.isLoading,
    globalConfig,
    leadConfig: leadQuery.data ?? null,
    temOverrideLead: Boolean(leadQuery.data),
    efetiva,
    salvar,
  };
}
