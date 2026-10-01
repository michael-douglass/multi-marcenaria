import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useLeads } from '@/hooks/useLeads';
import { leadDetailQueryKey } from '@/lib/leads-cache';
import {
  leadNegociacoesQueryKey,
  markupSchemaExtra,
  resolveMarkupTable,
} from '@/lib/markup-tables';

export type LeadNegociacaoStatus = 'rascunho' | 'fechada' | 'aplicada_markup';

export interface LeadNegociacao {
  id: string;
  lead_id: number;
  orcamento_ids: string[];
  custo_material: number;
  preco_original: number;
  margem_minima_percent: number;
  piso: number;
  valor_negociado: number;
  pct_material: number;
  pct_mao_obra: number;
  pct_lucro: number;
  valor_material: number;
  valor_mao_obra: number;
  valor_lucro: number;
  status: LeadNegociacaoStatus;
  observacao: string | null;
  criado_por: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface SalvarLeadNegociacaoInput {
  id?: string;
  lead_id: number;
  orcamento_ids: string[];
  custo_material: number;
  preco_original: number;
  margem_minima_percent: number;
  piso: number;
  valor_negociado: number;
  pct_material: number;
  pct_mao_obra: number;
  pct_lucro: number;
  valor_material: number;
  valor_mao_obra: number;
  valor_lucro: number;
  status?: LeadNegociacaoStatus;
  observacao?: string | null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseNegociacao(row: Record<string, unknown>): LeadNegociacao {
  const ids = Array.isArray(row.orcamento_ids)
    ? row.orcamento_ids.filter((id): id is string => typeof id === 'string')
    : [];
  const statusRaw = typeof row.status === 'string' ? row.status : 'fechada';
  const status: LeadNegociacaoStatus =
    statusRaw === 'rascunho' || statusRaw === 'aplicada_markup' || statusRaw === 'fechada'
      ? statusRaw
      : 'fechada';

  return {
    id: String(row.id),
    lead_id: asNumber(row.lead_id),
    orcamento_ids: ids,
    custo_material: asNumber(row.custo_material),
    preco_original: asNumber(row.preco_original),
    margem_minima_percent: asNumber(row.margem_minima_percent, 100),
    piso: asNumber(row.piso),
    valor_negociado: asNumber(row.valor_negociado),
    pct_material: asNumber(row.pct_material, 33.34),
    pct_mao_obra: asNumber(row.pct_mao_obra, 33.33),
    pct_lucro: asNumber(row.pct_lucro, 33.33),
    valor_material: asNumber(row.valor_material),
    valor_mao_obra: asNumber(row.valor_mao_obra),
    valor_lucro: asNumber(row.valor_lucro),
    status,
    observacao: typeof row.observacao === 'string' ? row.observacao : null,
    criado_por: typeof row.criado_por === 'string' ? row.criado_por : null,
    criado_em: typeof row.criado_em === 'string' ? row.criado_em : undefined,
    atualizado_em: typeof row.atualizado_em === 'string' ? row.atualizado_em : undefined,
  };
}

export function useLeadNegociacoes(leadId?: number | null) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const { updateLead } = useLeads({ fetchLeads: false });
  const table = resolveMarkupTable(schemaEmpresa, 'leadNegociacoes');

  const query = useQuery({
    queryKey: leadNegociacoesQueryKey(schemaEmpresa, leadId),
    enabled: !!user?.id && queriesReady && leadId != null,
    queryFn: async (): Promise<LeadNegociacao[]> => {
      const { data, error } = await db
        .from(table as 'lead_negociacoes')
        .select('*')
        .eq('lead_id', leadId!)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => parseNegociacao(r as Record<string, unknown>));
    },
  });

  const salvarNegociacao = useMutation({
    mutationFn: async (input: SalvarLeadNegociacaoInput) => {
      const payload = {
        lead_id: input.lead_id,
        orcamento_ids: input.orcamento_ids,
        custo_material: input.custo_material,
        preco_original: input.preco_original,
        margem_minima_percent: input.margem_minima_percent,
        piso: input.piso,
        valor_negociado: input.valor_negociado,
        pct_material: input.pct_material,
        pct_mao_obra: input.pct_mao_obra,
        pct_lucro: input.pct_lucro,
        valor_material: input.valor_material,
        valor_mao_obra: input.valor_mao_obra,
        valor_lucro: input.valor_lucro,
        status: input.status ?? 'fechada',
        observacao: input.observacao ?? null,
        criado_por: user?.id ?? null,
        atualizado_em: new Date().toISOString(),
        ...markupSchemaExtra(schemaEmpresa),
      };

      let negociacao: LeadNegociacao;
      if (input.id) {
        const { data, error } = await db
          .from(table as 'lead_negociacoes')
          .update(payload)
          .eq('id', input.id)
          .select('*')
          .single();
        if (error) throw error;
        negociacao = parseNegociacao(data as Record<string, unknown>);
      } else {
        const { data, error } = await db
          .from(table as 'lead_negociacoes')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        negociacao = parseNegociacao(data as Record<string, unknown>);
      }

      // O valor fechado no Negociador vira o "Valor do orçamento" do lead.
      const valorOrcamento = asNumber(negociacao.valor_negociado);
      if (valorOrcamento > 0) {
        await updateLead.mutateAsync({
          id: negociacao.lead_id,
          updates: { valor_orcamento: valorOrcamento },
          silent: true,
        });
      }

      return negociacao;
    },
    onSuccess: (negociacao) => {
      qc.invalidateQueries({ queryKey: leadNegociacoesQueryKey(schemaEmpresa, leadId) });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: leadDetailQueryKey(negociacao.lead_id, schemaEmpresa) });
      toast.success('Negociação salva!', {
        description: 'O valor negociado foi aplicado no Valor do orçamento deste lead.',
      });
    },
    onError: (e: Error) =>
      toast.error('Não foi possível salvar a negociação', { description: e.message }),
  });

  const negociacaoMaisRecente = query.data?.[0] ?? null;
  const negociacaoFechada =
    query.data?.find((n) => n.status === 'fechada' || n.status === 'aplicada_markup') ?? null;

  return {
    ...query,
    negociacoes: query.data ?? [],
    negociacaoMaisRecente,
    negociacaoFechada,
    salvarNegociacao,
  };
}
