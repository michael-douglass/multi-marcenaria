import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LeadStatus, TabelaOrigemInfo } from '@/types/selletos';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { buildLeadsSelect, resolveLeadsQueryConfig } from '@/lib/empresa-tables';
import {
  enrichLeadsWithChatData,
  enrichLeadsWithVendors,
  fetchAllLeadsRaw,
  fetchLeadByIdEnriched,
} from '@/lib/leads-fetch-helpers';
import {
  leadsListQueryKey,
  leadDetailQueryKey,
  patchLeadInAllCaches,
  removeLeadFromAllCaches,
  setLeadDetailCache,
} from '@/lib/leads-cache';
import { markLeadUpdatedBySelf } from '@/lib/lead-update-guard';

export interface DatabaseLead {
  id: number;
  nome: string;
  empresa?: string | null;
  email?: string | null;
  telefone?: string | null;
  origem?: string | null;
  status: string;
  valor_negocio: number;
  valor_orcamento?: number;
  data_chegada: string;
  criado_em: string;
  atualizado_em: string;
  venda_realizada_em?: string | null;
  vendedor_responsavel_id: string | null;
  motivo_perda?: string | null;
  observacoes?: string | null;
  ordem_manual?: number | null;
  webhook_nome?: string | null;
  tabela_origem?: string | null;
  tabela_origem_info?: TabelaOrigemInfo | null;
  regiao?: string | null;
  regiao_tabela?: string | null;
  dar_atencao?: boolean | null;
  /** Token do formulário público para o cliente iniciar orçamento. */
  token_form_orcamento?: string | null;
  /** Usuário Pontua Garbo vinculado a este card (o lead É o parceiro). */
  pontua_garbo_usuario_id?: string | null;
}

export interface LeadWithVendor extends DatabaseLead {
  vendedor?: {
    id: string;
    nome: string;
    email: string | null;
  };
}

interface UseLeadsOptions {
  fetchLeads?: boolean;
}

export function useLeads(options?: UseLeadsOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const leadsConfig = resolveLeadsQueryConfig(schemaEmpresa);
  const fetchLeads = options?.fetchLeads !== false;

  const leadsQueryKey = leadsListQueryKey(user?.id, schemaEmpresa);

  const { data: leads, isLoading, isPending, isFetching } = useQuery({
    queryKey: leadsQueryKey,
    queryFn: async () => {
      const leadsData = await fetchAllLeadsRaw(schemaEmpresa);
      return enrichLeadsWithChatData(leadsData, schemaEmpresa);
    },
    enabled: fetchLeads && !!user?.id && queriesReady,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  // Restore do cache local pode pausar a 1ª busca: pending + idle, quadro vazio sem loading.
  useEffect(() => {
    if (!fetchLeads || !user?.id || !queriesReady) return;
    if (leads != null || isFetching || !isPending) return;
    void queryClient.refetchQueries({ queryKey: leadsQueryKey });
  }, [
    fetchLeads,
    user?.id,
    queriesReady,
    leads,
    isFetching,
    isPending,
    queryClient,
    leadsQueryKey,
  ]);

  const createLead = useMutation({
    mutationFn: async (
      newLead: Omit<DatabaseLead, 'id' | 'criado_em' | 'atualizado_em'> & { silent?: boolean },
    ) => {
      const { silent: _silent, ...payload } = newLead;
      const leadsTable = table('leads', leadsConfig.leadsTable);
      const { data, error } = await db.from(leadsTable).insert([payload]).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (data?.id) {
        setLeadDetailCache(queryClient, data as LeadWithVendor, schemaEmpresa);
      }
      if (!variables.silent) {
        toast.success('Lead criado com sucesso!');
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar lead', {
        description: error.message,
      });
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<DatabaseLead>;
      silent?: boolean;
    }) => {
      const leadsTable = table('leads', leadsConfig.leadsTable);
      const { data, error } = await db
        .from(leadsTable)
        .update(updates)
        .eq('id', id)
        .select(buildLeadsSelect(leadsConfig))
        .maybeSingle();

      if (error) {
        if (error.code === '406' || (error as { status?: number }).status === 406) {
          throw new Error('Sem permissão para atualizar este lead ou lead não encontrado.');
        }
        // PGRST116 = 0 rows with .single(); com maybeSingle costuma vir data=null
        if (error.code === 'PGRST116') {
          throw new Error('Nenhuma linha atualizada. Verifique suas permissões ou a existência do lead.');
        }
        throw error;
      }

      if (!data) {
        throw new Error('Nenhuma linha atualizada. Verifique suas permissões ou a existência do lead.');
      }

      // Garante vendedor.nome no cache (o select simples não traz a relação em todos os schemas).
      const [withVendor] = await enrichLeadsWithVendors([data], leadsConfig);
      const enriched = await enrichLeadsWithChatData([withVendor], schemaEmpresa);
      return enriched[0] ?? (withVendor as LeadWithVendor);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<LeadWithVendor[]>(leadsQueryKey);
      patchLeadInAllCaches(queryClient, id, updates as Partial<LeadWithVendor>);
      return { previous };
    },
    onSuccess: (data, { id, updates, silent }) => {
      markLeadUpdatedBySelf(id);
      setLeadDetailCache(queryClient, data, schemaEmpresa);
      if (updates.status !== undefined) {
        void queryClient.invalidateQueries({ queryKey: ['pipeline-coluna-movimentos'] });
        void queryClient.invalidateQueries({ queryKey: ['leads', 'kanban-page'] });
      }
      // Troca de vendedor: o card do kanban lê vendedor.nome — já vem no `data` enriquecido.
      if (updates.vendedor_responsavel_id !== undefined) {
        void queryClient.invalidateQueries({ queryKey: ['leads', 'kanban-page'] });
      }
      const isAttentionOnly =
        updates.dar_atencao !== undefined && Object.keys(updates).length === 1;
      if (!silent && !isAttentionOnly) {
        toast.success('Lead atualizado com sucesso!');
      }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(leadsQueryKey, context.previous);
      }
      toast.error('Erro ao atualizar lead', {
        description: error.message,
      });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: number) => {
      const leadsTable = table('leads', leadsConfig.leadsTable);
      // .select() garante que detectamos exclusão bloqueada pelo RLS (0 linhas sem error).
      const { data, error } = await db.from(leadsTable).delete().eq('id', id).select('id');

      if (error) throw error;
      if (!data?.length) {
        throw new Error(
          'Não foi possível excluir o lead. Verifique se você tem permissão de administrador ou se o lead ainda existe.',
        );
      }
    },
    onSuccess: (_data, id) => {
      removeLeadFromAllCaches(queryClient, id);
      toast.success('Lead deletado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao deletar lead', {
        description: error.message,
      });
    },
  });

  return {
    leads,
    isLoading: isLoading || (isPending && leads == null),
    createLead,
    updateLead,
    deleteLead,
    leadsQueryKey,
  };
}

/** Cache dedicado do lead em edição — não depende da lista global recarregar. */
export function useLeadDetail(leadId: number | null | undefined) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const queryClient = useQueryClient();
  const id = leadId ?? 0;

  return useQuery({
    queryKey: leadDetailQueryKey(id, schemaEmpresa),
    queryFn: () => fetchLeadByIdEnriched(id, schemaEmpresa),
    enabled: !!leadId && !!user?.id && queriesReady,
    staleTime: 5 * 60_000,
    gcTime: 1000 * 60 * 60 * 24,
    placeholderData: () => {
      const listKey = leadsListQueryKey(user?.id, schemaEmpresa);
      const list = queryClient.getQueryData<LeadWithVendor[]>(listKey);
      return list?.find((l) => l.id === id);
    },
  });
}
