import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { OrcamentoFormaPagamento } from '@/lib/orcamento-slide-types';

const PUBLIC_TABLE = 'CRM-multi-empresas>orcamento_slide_formas_pagamento<' as const;

function resolveTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_formas_pagamento' : PUBLIC_TABLE;
}

export function useOrcamentoSlideFormasPagamento() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);
  const queryKey = ['orcamento-slide-formas-pagamento', schemaEmpresa];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<OrcamentoFormaPagamento[]> => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_formas_pagamento')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrcamentoFormaPagamento[];
    },
  });

  const atualizarForma = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrcamentoFormaPagamento> & { id: string }) => {
      const { error } = await db.from(table as 'orcamento_slide_formas_pagamento').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Forma de pagamento atualizada!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar', { description: e.message }),
  });

  return {
    formas: query.data ?? [],
    todasFormas: query.data ?? [],
    isLoading: query.isLoading,
    atualizarForma,
  };
}

/** Lista completa incluindo inativas — só configuração. */
export function useOrcamentoSlideFormasPagamentoAdmin() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);
  const queryKey = ['orcamento-slide-formas-pagamento-admin', schemaEmpresa];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<OrcamentoFormaPagamento[]> => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_formas_pagamento')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrcamentoFormaPagamento[];
    },
  });

  const atualizarForma = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrcamentoFormaPagamento> & { id: string }) => {
      const { error } = await db.from(table as 'orcamento_slide_formas_pagamento').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['orcamento-slide-formas-pagamento', schemaEmpresa] });
      toast.success('Salvo!');
    },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  return { formas: query.data ?? [], isLoading: query.isLoading, atualizarForma };
}
