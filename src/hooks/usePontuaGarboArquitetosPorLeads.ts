import { useQuery } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import type { LeadCustomFieldDefinition } from '@/hooks/useLeadCustomFields';
import { isPontuaGarboFieldActive } from '@/lib/pontua-garbo';

const PUBLIC_DEFS = 'CRM-multi-empresas>lead_custom_field_definitions<' as const;
const PUBLIC_VALS = 'CRM-multi-empresas>lead_custom_field_values<' as const;
const PUBLIC_USERS = 'CRM-multi-empresas>usuarios<' as const;

/** Nome do arquiteto Pontua Garbo vinculado ao lead, se houver. */
export function usePontuaGarboArquitetosPorLeads(leadIds: number[]) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const idsKey = [...new Set(leadIds)].sort((a, b) => a - b).join(',');

  const { data } = useQuery({
    queryKey: ['pontua-garbo-arquitetos-leads', schemaEmpresa ?? 'master', idsKey],
    enabled: queriesReady && leadIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<number, string>> => {
      const result = new Map<number, string>();
      const uniqueIds = [...new Set(leadIds)];
      if (uniqueIds.length === 0) return result;

      const defsTable = table('lead_custom_field_definitions', PUBLIC_DEFS);
      const valsTable = table('lead_custom_field_values', PUBLIC_VALS);
      const usersTable = table('usuarios', PUBLIC_USERS);

      const { data: defs, error: defsErr } = await db
        .from(defsTable)
        .select('id, nome, tipo, ativo, config_pontua_garbo')
        .eq('tipo', 'usuario_sistema')
        .eq('ativo', true);
      if (defsErr) throw defsErr;

      const activeDefs = ((defs ?? []) as LeadCustomFieldDefinition[]).filter((d) =>
        isPontuaGarboFieldActive(d),
      );
      if (activeDefs.length === 0) return result;

      const { data: vals, error: valsErr } = await db
        .from(valsTable)
        .select('lead_id, field_id, valor')
        .in('lead_id', uniqueIds)
        .in(
          'field_id',
          activeDefs.map((d) => d.id),
        )
        .not('valor', 'is', null);
      if (valsErr) throw valsErr;

      const usuarioIdByLead = new Map<number, string>();
      for (const row of vals ?? []) {
        const leadId = Number(row.lead_id);
        const usuarioId = typeof row.valor === 'string' ? row.valor.trim() : '';
        if (!leadId || !usuarioId || usuarioIdByLead.has(leadId)) continue;
        usuarioIdByLead.set(leadId, usuarioId);
      }
      if (usuarioIdByLead.size === 0) return result;

      const usuarioIds = [...new Set(usuarioIdByLead.values())];
      const { data: users, error: usersErr } = await db
        .from(usersTable)
        .select('id, nome')
        .in('id', usuarioIds);
      if (usersErr) throw usersErr;

      const nomeById = new Map<string, string>();
      for (const user of users ?? []) {
        const nome = (user.nome as string | null)?.trim();
        if (user.id && nome) nomeById.set(user.id as string, nome);
      }

      for (const [leadId, usuarioId] of usuarioIdByLead) {
        const nome = nomeById.get(usuarioId);
        if (nome) result.set(leadId, nome);
      }
      return result;
    },
  });

  return data ?? new Map<number, string>();
}
