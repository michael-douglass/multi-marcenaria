import { useQuery } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';

const PUBLIC_LEADS = 'CRM-multi-empresas>leads<' as const;

export interface LeadBuscaItem {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  empresa: string | null;
  status: string;
  regiao: string | null;
  origem: string | null;
}

/** Busca leads por nome, telefone, e-mail ou empresa (mínimo 2 caracteres). */
export function useBuscaLeads(search: string, options?: { excludeLeadId?: number | null }) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const leadsTable = table('leads', PUBLIC_LEADS);
  const term = search.trim();
  const excludeLeadId = options?.excludeLeadId ?? null;

  return useQuery({
    queryKey: ['leads-busca', schemaEmpresa, term, excludeLeadId],
    enabled: queriesReady && term.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<LeadBuscaItem[]> => {
      let query = db
        .from(leadsTable)
        .select('id, nome, telefone, email, empresa, status, regiao, origem')
        .or(
          `nome.ilike.%${term}%,telefone.ilike.%${term}%,email.ilike.%${term}%,empresa.ilike.%${term}%`,
        )
        .order('nome', { ascending: true })
        .limit(25);

      if (excludeLeadId != null) {
        query = query.neq('id', excludeLeadId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LeadBuscaItem[];
    },
  });
}
