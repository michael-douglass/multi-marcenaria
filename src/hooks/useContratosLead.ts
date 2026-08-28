import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import type { Contrato } from '@/hooks/useContratos';
import { isSchemaApiExposed } from '@/lib/empresa-tables';

const PUBLIC_CONTRATOS = 'CRM-multi-empresas>contratos<' as const;
const PUBLIC_LEADS = 'CRM-multi-empresas>leads<' as const;

export const contratosPorLeadQueryKey = (
  schema: string | null | undefined,
  leadId: number | null | undefined,
) => ['contratos-por-lead', schema, leadId] as const;

export const contratosLeadMapQueryKey = (schema: string | null | undefined) =>
  ['contratos-lead-map', schema] as const;

function resolveContratosTable(schema: string | null | undefined) {
  if (isSchemaApiExposed(schema)) return 'contratos';
  return PUBLIC_CONTRATOS;
}

export interface LeadBuscaItem {
  id: number;
  nome: string;
  telefone: string | null;
  status: string;
}

export function useContratosPorLead(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveContratosTable(schemaEmpresa);

  return useQuery({
    queryKey: contratosPorLeadQueryKey(schemaEmpresa, leadId),
    enabled: queriesReady && !!leadId,
    queryFn: async (): Promise<Contrato[]> => {
      const { data, error } = await db
        .from(table as 'contratos')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contrato[];
    },
  });
}

/** Rascunho mais recente do lead (ex.: iniciado pelo formulário público). */
export function useContratoRascunhoPorLead(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const { user } = useAuth();
  const db = useEmpresaSupabase();
  const table = resolveContratosTable(schemaEmpresa);

  return useQuery({
    queryKey: ['contrato-rascunho-por-lead', schemaEmpresa, leadId] as const,
    enabled: queriesReady && !!leadId && !!user?.id,
    queryFn: async (): Promise<Contrato | null> => {
      const { data, error } = await db
        .from(table as 'contratos')
        .select('*')
        .eq('lead_id', leadId!)
        .eq('status', 'rascunho')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Contrato | null) ?? null;
    },
  });
}

/** Mapa lead_id → quantidade de contratos (para badge no Kanban). */
export function useContratosLeadIdsMap() {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const { user } = useAuth();
  const db = useEmpresaSupabase();
  const table = resolveContratosTable(schemaEmpresa);

  return useQuery({
    queryKey: contratosLeadMapQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db
        .from(table as 'contratos')
        .select('id, lead_id')
        .not('lead_id', 'is', null)
        .neq('status', 'rascunho');
      if (error) throw error;
      const map = new Map<number, number>();
      for (const row of data ?? []) {
        const lid = row.lead_id as number;
        if (lid) map.set(lid, (map.get(lid) ?? 0) + 1);
      }
      return map;
    },
  });
}

export function useBuscaLeadsParaContrato(search: string) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const leadsTable = table('leads', PUBLIC_LEADS);
  const term = search.trim();

  return useQuery({
    queryKey: ['leads-busca-contrato', schemaEmpresa, term],
    enabled: queriesReady && term.length >= 2,
    queryFn: async (): Promise<LeadBuscaItem[]> => {
      const { data, error } = await db
        .from(leadsTable)
        .select('id, nome, telefone, status')
        .or(`nome.ilike.%${term}%,telefone.ilike.%${term}%`)
        .order('nome', { ascending: true })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as LeadBuscaItem[];
    },
  });
}

export function useVincularContratoLead() {
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveContratosTable(schemaEmpresa);

  return useMutation({
    mutationFn: async ({
      contratoId,
      leadId,
    }: {
      contratoId: string;
      leadId: number | null;
    }) => {
      const { data, error } = await db
        .from(table as 'contratos')
        .update({ lead_id: leadId })
        .eq('id', contratoId)
        .neq('status', 'rascunho')
        .select()
        .single();
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['contratos', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: contratosLeadMapQueryKey(schemaEmpresa) });
      qc.invalidateQueries({ queryKey: ['contratos-rascunhos', schemaEmpresa] });
      if (data.lead_id) {
        qc.invalidateQueries({
          queryKey: contratosPorLeadQueryKey(schemaEmpresa, data.lead_id),
        });
      }
      toast.success(
        data.lead_id
          ? 'Contrato vinculado ao lead!'
          : 'Vínculo com o lead removido.',
      );
    },
    onError: (e: Error) =>
      toast.error('Erro ao vincular contrato', { description: e.message }),
  });
}
