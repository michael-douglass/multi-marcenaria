import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

const PUBLIC_PERM = 'CRM-multi-empresas>lead_prestador_permissoes<' as const;

export interface LeadPrestadorPermissao {
  lead_id: number;
  prestador_id: string;
  pode_ver_detalhes: boolean;
  pode_ver_lousa: boolean;
  pode_ver_anotacoes: boolean;
  pode_ver_anexos: boolean;
  pode_ver_fotos: boolean;
  pode_ver_pdfs: boolean;
  anexos_visiveis: string[] | null;
  pode_ver_orcamento: boolean;
  orcamentos_visiveis: string[] | null;
}

export function normalizePermissao(
  found: Partial<LeadPrestadorPermissao> | undefined,
  leadId: number,
  prestadorId: string,
): LeadPrestadorPermissao {
  const defaults: LeadPrestadorPermissao = {
    lead_id: leadId,
    prestador_id: prestadorId,
    pode_ver_detalhes: false,
    pode_ver_lousa: false,
    pode_ver_anotacoes: false,
    pode_ver_anexos: false,
    pode_ver_fotos: false,
    pode_ver_pdfs: false,
    anexos_visiveis: null,
    pode_ver_orcamento: false,
    orcamentos_visiveis: null,
  };
  if (!found) return defaults;
  const legadoAnexos = found.pode_ver_anexos ?? false;
  return {
    ...defaults,
    ...found,
    lead_id: found.lead_id ?? leadId,
    prestador_id: found.prestador_id ?? prestadorId,
    pode_ver_fotos: found.pode_ver_fotos ?? legadoAnexos,
    pode_ver_pdfs: found.pode_ver_pdfs ?? legadoAnexos,
    anexos_visiveis: found.anexos_visiveis ?? null,
    pode_ver_orcamento: found.pode_ver_orcamento ?? false,
    orcamentos_visiveis: found.orcamentos_visiveis ?? null,
    pode_ver_anexos: found.pode_ver_anexos ?? !!(found.pode_ver_fotos || found.pode_ver_pdfs),
  };
}

/** Hook used by admin to control lead visibility for a specific lead */
export function useLeadPrestadorPermissoes(leadId: number | null | undefined) {
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();

  const permTable = table('lead_prestador_permissoes', PUBLIC_PERM);
  const queryKey = ['lead-prestador-permissoes', schemaEmpresa, leadId] as const;

  const { data: permissoes = [] } = useQuery({
    queryKey,
    enabled: !!leadId,
    staleTime: 30_000,
    queryFn: async (): Promise<LeadPrestadorPermissao[]> => {
      const { data, error } = await db
        .from(permTable)
        .select('*')
        .eq('lead_id', leadId!);
      if (error) throw error;
      return (data ?? []) as LeadPrestadorPermissao[];
    },
  });

  const upsertPermissao = useMutation({
    mutationFn: async (input: Omit<LeadPrestadorPermissao, 'lead_id'> & { lead_id?: number }) => {
      const lid = input.lead_id ?? leadId;
      if (!lid) throw new Error('lead_id ausente');
      const { error } = await db.from(permTable).upsert(
        { ...input, lead_id: lid },
        { onConflict: 'lead_id,prestador_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Permissões atualizadas');
    },
    onError: (e: Error) => toast.error('Erro ao salvar permissões', { description: e.message }),
  });

  const getPermissao = (prestadorId: string): LeadPrestadorPermissao => {
    const found = permissoes.find((p) => p.prestador_id === prestadorId);
    return normalizePermissao(found, leadId ?? 0, prestadorId);
  };

  return { permissoes, upsertPermissao, getPermissao };
}

/** Hook used by a prestador to read their permissions for their leads */
export function useMinhasPermissoes(prestadorId: string | null | undefined) {
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const permTable = table('lead_prestador_permissoes', PUBLIC_PERM);

  return useQuery({
    queryKey: ['minhas-permissoes', schemaEmpresa, prestadorId],
    enabled: !!prestadorId,
    staleTime: 60_000,
    queryFn: async (): Promise<LeadPrestadorPermissao[]> => {
      const { data, error } = await db
        .from(permTable)
        .select('*')
        .eq('prestador_id', prestadorId!);
      if (error) throw error;
      return (data ?? []) as LeadPrestadorPermissao[];
    },
  });
}
