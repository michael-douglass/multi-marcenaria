import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';

/** Admin, super admin e vendedor: gestão completa do módulo de contratos. */
export function podeGerenciarContratos(
  userRole: string | null | undefined,
  isSuperAdmin: boolean,
): boolean {
  return isSuperAdmin || userRole === 'admin' || userRole === 'vendedor';
}

/** @deprecated Preferir `podeGerenciarContratos`. */
export function isAdminContratos(
  userRole: string | null | undefined,
  isSuperAdmin: boolean,
): boolean {
  return podeGerenciarContratos(userRole, isSuperAdmin);
}

export const contratosRascunhosQueryKey = (schema: string | null | undefined) =>
  ['contratos-rascunhos', schema, 'com-lead'] as const;

export type ContratoStatus = 'rascunho' | 'gerado' | 'enviado' | 'assinado' | 'cancelado';

export interface ContratoLeadResumo {
  id: number;
  nome: string;
}

export interface Contrato {
  id: string;
  identificador: string;
  cliente_nome: string;
  status: ContratoStatus;
  campos_valores: Record<string, string>;
  conteudo_final: string;
  criado_por: string | null;
  created_at: string;
  lead_id: number | null;
  /** Preenchido quando a query faz embed do lead vinculado. */
  lead?: ContratoLeadResumo | null;
}

/** Select com lead vinculado (schema emp_* / FK contratos_lead_id_fkey). */
const CONTRATOS_SELECT_COM_LEAD = '*, lead:leads!lead_id(id, nome)';

function normalizeContratoRow(row: Record<string, unknown>): Contrato {
  const leadRaw = row.lead;
  let lead: ContratoLeadResumo | null = null;
  if (leadRaw && typeof leadRaw === 'object' && !Array.isArray(leadRaw)) {
    const obj = leadRaw as { id?: unknown; nome?: unknown };
    if (typeof obj.id === 'number' && typeof obj.nome === 'string') {
      lead = { id: obj.id, nome: obj.nome };
    }
  }
  return { ...(row as unknown as Contrato), lead };
}

export interface CriarContratoInput {
  identificador: string;
  cliente_nome: string;
  campos_valores: Record<string, string>;
  conteudo_final: string;
  lead_id?: number | null;
}

export interface SalvarRascunhoContratoInput {
  id?: string | null;
  identificador: string;
  cliente_nome: string;
  campos_valores: Record<string, string>;
  conteudo_final: string;
  lead_id?: number | null;
}

export interface FinalizarContratoInput {
  id: string;
  identificador: string;
  cliente_nome: string;
  campos_valores: Record<string, string>;
  conteudo_final: string;
  lead_id?: number | null;
}

export interface AtualizarContratoInput {
  id: string;
  identificador: string;
  cliente_nome: string;
  campos_valores: Record<string, string>;
  conteudo_final: string;
}

function resolveContratosTable(schema: string | null | undefined) {
  if (isSchemaApiExposed(schema)) return 'contratos';
  return 'CRM-multi-empresas>contratos<';
}

export function useContratos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveContratosTable(schemaEmpresa);
  const queryKey = ['contratos', schemaEmpresa, 'com-lead'] as const;
  const rascunhoQueryKey = ['contrato-rascunho-atual', schemaEmpresa, user?.id] as const;
  const rascunhosKey = contratosRascunhosQueryKey(schemaEmpresa);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const useEmbed = isSchemaApiExposed(schemaEmpresa);
      const { data, error } = await db
        .from(table as 'contratos')
        .select(useEmbed ? CONTRATOS_SELECT_COM_LEAD : '*')
        .neq('status', 'rascunho')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) =>
        normalizeContratoRow(row as Record<string, unknown>),
      );
    },
    enabled: !!user?.id && queriesReady,
  });

  const { data: rascunhoAtual, isLoading: isLoadingRascunho } = useQuery({
    queryKey: rascunhoQueryKey,
    queryFn: async () => {
      let q = db
        .from(table as 'contratos')
        .select('*')
        .eq('status', 'rascunho')
        .order('created_at', { ascending: false })
        .limit(1);
      if (user?.id) {
        q = q.eq('criado_por', user.id);
      }
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data as Contrato | null) ?? null;
    },
    enabled: !!user?.id && queriesReady,
    staleTime: 10_000,
  });

  const salvarRascunhoContrato = useMutation({
    mutationFn: async (input: SalvarRascunhoContratoInput) => {
      const row: Record<string, unknown> = {
        identificador: input.identificador,
        cliente_nome: input.cliente_nome,
        campos_valores: input.campos_valores,
        conteudo_final: input.conteudo_final,
        status: 'rascunho',
        criado_por: user?.id ?? null,
      };
      if (input.lead_id != null) {
        row.lead_id = input.lead_id;
      }
      if (!isSchemaApiExposed(schemaEmpresa)) {
        row.schema_nome = schemaEmpresa;
      }

      if (input.id) {
        const updatePayload: Record<string, unknown> = {
          identificador: input.identificador,
          cliente_nome: input.cliente_nome,
          campos_valores: input.campos_valores,
          conteudo_final: input.conteudo_final,
        };
        if (input.lead_id != null) {
          updatePayload.lead_id = input.lead_id;
        }
        const { data, error } = await db
          .from(table as 'contratos')
          .update(updatePayload)
          .eq('id', input.id)
          .eq('status', 'rascunho')
          .select()
          .single();
        if (error) throw error;
        return data as Contrato;
      }

      const { data, error } = await db
        .from(table as 'contratos')
        .insert([row])
        .select()
        .single();
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: rascunhoQueryKey });
      queryClient.invalidateQueries({ queryKey: rascunhosKey });
      queryClient.invalidateQueries({ queryKey: ['contratos-por-lead', schemaEmpresa] });
      if (data.lead_id) {
        queryClient.invalidateQueries({
          queryKey: ['contratos-por-lead', schemaEmpresa, data.lead_id],
        });
      }
    },
  });

  const finalizarContrato = useMutation({
    mutationFn: async (input: FinalizarContratoInput) => {
      const updatePayload: Record<string, unknown> = {
        identificador: input.identificador,
        cliente_nome: input.cliente_nome,
        campos_valores: input.campos_valores,
        conteudo_final: input.conteudo_final,
        status: 'gerado',
      };
      if (input.lead_id != null) {
        updatePayload.lead_id = input.lead_id;
      }
      const { data, error } = await db
        .from(table as 'contratos')
        .update(updatePayload)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: rascunhoQueryKey });
      queryClient.invalidateQueries({ queryKey: rascunhosKey });
      queryClient.invalidateQueries({ queryKey: ['contratos-por-lead', schemaEmpresa] });
      queryClient.invalidateQueries({ queryKey: ['contratos-lead-map', schemaEmpresa] });
      if (data.lead_id) {
        queryClient.invalidateQueries({
          queryKey: ['contratos-por-lead', schemaEmpresa, data.lead_id],
        });
      }
      toast.success('Contrato salvo com sucesso!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar contrato', { description: e.message }),
  });

  const criarContrato = useMutation({
    mutationFn: async (input: CriarContratoInput) => {
      const insert: Record<string, unknown> = {
        ...input,
        status: 'gerado',
        criado_por: user?.id ?? null,
      };
      if (!isSchemaApiExposed(schemaEmpresa)) {
        insert.schema_nome = schemaEmpresa;
      }
      const { data, error } = await db
        .from(table as 'contratos')
        .insert([insert])
        .select()
        .single();
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: rascunhoQueryKey });
      queryClient.invalidateQueries({ queryKey: rascunhosKey });
      queryClient.invalidateQueries({ queryKey: ['contratos-por-lead', schemaEmpresa] });
      queryClient.invalidateQueries({ queryKey: ['contratos-lead-map', schemaEmpresa] });
      if (data.lead_id) {
        queryClient.invalidateQueries({
          queryKey: ['contratos-por-lead', schemaEmpresa, data.lead_id],
        });
      }
      toast.success('Contrato salvo com sucesso!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar contrato', { description: e.message }),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContratoStatus }) => {
      const { data, error } = await db
        .from(table as 'contratos')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Status atualizado!');
    },
    onError: (e: Error) => toast.error('Erro ao atualizar status', { description: e.message }),
  });

  const atualizarContrato = useMutation({
    mutationFn: async (input: AtualizarContratoInput) => {
      const { data, error } = await db
        .from(table as 'contratos')
        .update({
          identificador: input.identificador,
          cliente_nome: input.cliente_nome,
          campos_valores: input.campos_valores,
          conteudo_final: input.conteudo_final,
        })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: rascunhosKey });
      queryClient.invalidateQueries({
        queryKey: ['contrato', schemaEmpresa, variables.id],
      });
      toast.success('Contrato atualizado!');
    },
    onError: (e: Error) =>
      toast.error('Erro ao atualizar contrato', { description: e.message }),
  });

  const excluirContrato = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(table as 'contratos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: rascunhosKey });
      queryClient.invalidateQueries({ queryKey: ['contratos-por-lead', schemaEmpresa] });
      queryClient.invalidateQueries({ queryKey: ['contratos-lead-map', schemaEmpresa] });
      toast.success('Contrato excluído!');
    },
    onError: (e: Error) => toast.error('Erro ao excluir contrato', { description: e.message }),
  });

  return {
    contratos,
    isLoading,
    rascunhoAtual,
    isLoadingRascunho,
    salvarRascunhoContrato,
    finalizarContrato,
    criarContrato,
    atualizarStatus,
    atualizarContrato,
    excluirContrato,
  };
}

/** Todos os rascunhos em produção — visível para quem gerencia contratos. */
export function useContratosRascunhosEmProducao() {
  const { user, userRole, isSuperAdmin } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveContratosTable(schemaEmpresa);
  const podeGerenciar = podeGerenciarContratos(userRole, isSuperAdmin);

  return useQuery({
    queryKey: contratosRascunhosQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady && podeGerenciar,
    staleTime: 10_000,
    refetchInterval: 15_000,
    queryFn: async (): Promise<Contrato[]> => {
      const useEmbed = isSchemaApiExposed(schemaEmpresa);
      const { data, error } = await db
        .from(table as 'contratos')
        .select(useEmbed ? CONTRATOS_SELECT_COM_LEAD : '*')
        .eq('status', 'rascunho')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) =>
        normalizeContratoRow(row as Record<string, unknown>),
      );
    },
  });
}

/** Carrega um contrato por ID (qualquer status). */
export function useContratoPorId(
  contratoId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveContratosTable(schemaEmpresa);

  return useQuery({
    queryKey: ['contrato', schemaEmpresa, contratoId],
    enabled: (options?.enabled ?? true) && queriesReady && !!contratoId && !!user?.id,
    queryFn: async (): Promise<Contrato | null> => {
      if (!contratoId) return null;
      const { data, error } = await db
        .from(table as 'contratos')
        .select('*')
        .eq('id', contratoId)
        .maybeSingle();
      if (error) throw error;
      return (data as Contrato | null) ?? null;
    },
  });
}

/** Carrega um rascunho por ID (gestores: qualquer; demais: só o próprio). */
export function useContratoRascunhoPorId(
  rascunhoId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { user, userRole, isSuperAdmin } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveContratosTable(schemaEmpresa);
  const podeGerenciar = podeGerenciarContratos(userRole, isSuperAdmin);

  return useQuery({
    queryKey: ['contrato-rascunho', schemaEmpresa, rascunhoId],
    enabled: (options?.enabled ?? true) && queriesReady && !!rascunhoId && !!user?.id,
    queryFn: async (): Promise<Contrato | null> => {
      if (!rascunhoId) return null;
      const { data, error } = await db
        .from(table as 'contratos')
        .select('*')
        .eq('id', rascunhoId)
        .eq('status', 'rascunho')
        .maybeSingle();
      if (error) throw error;
      const row = data as Contrato | null;
      if (!row) return null;
      if (!podeGerenciar && row.criado_por !== user?.id) return null;
      return row;
    },
  });
}
