import { useQuery } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import type { LeadCustomFieldDefinition } from '@/hooks/useLeadCustomFields';
import {
  buildLeadPontuaSaleInfo,
  isPontuaFieldActive,
  type LeadPontuaSaleInfo,
} from '@/lib/pontua';

export type { LeadPontuaSaleInfo };

const PUBLIC_DEFS = 'CRM-multi-empresas>lead_custom_field_definitions<' as const;
const PUBLIC_VALS = 'CRM-multi-empresas>lead_custom_field_values<' as const;
const PUBLIC_USERS = 'CRM-multi-empresas>usuarios<' as const;

export function useLeadPontuaSaleInfo(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();

  return useQuery({
    queryKey: ['lead-pontua-sale', schemaEmpresa, leadId],
    enabled: queriesReady && !!leadId,
    staleTime: 60_000,
    queryFn: async (): Promise<LeadPontuaSaleInfo | null> => {
      if (!leadId) return null;

      const defsTable = table('lead_custom_field_definitions', PUBLIC_DEFS);
      const valsTable = table('lead_custom_field_values', PUBLIC_VALS);
      const usersTable = table('usuarios', PUBLIC_USERS);

      const { data: defs, error: defsErr } = await db
        .from(defsTable)
        .select('id, nome, tipo, ativo, config_pontua')
        .eq('tipo', 'usuario_sistema')
        .eq('ativo', true);
      if (defsErr) throw defsErr;

      const activeDefs = ((defs ?? []) as LeadCustomFieldDefinition[]).filter((d) =>
        isPontuaFieldActive(d),
      );
      if (activeDefs.length === 0) return null;

      const { data: vals, error: valsErr } = await db
        .from(valsTable)
        .select('field_id, valor, pontua_percentual')
        .eq('lead_id', leadId)
        .in(
          'field_id',
          activeDefs.map((d) => d.id),
        )
        .not('valor', 'is', null);
      if (valsErr) throw valsErr;

      const val = (vals ?? []).find((v) => v.valor?.trim());
      if (!val?.valor?.trim()) return null;

      const def = activeDefs.find((d) => d.id === val.field_id);
      if (!def) return null;

      const { data: user, error: userErr } = await db
        .from(usersTable)
        .select('id, nome, tipo_usuario, comissao_ativa')
        .eq('id', val.valor)
        .maybeSingle();
      if (userErr) throw userErr;
      if (!user?.id) return null;

      return buildLeadPontuaSaleInfo(def, val.valor, user, val);
    },
  });
}
