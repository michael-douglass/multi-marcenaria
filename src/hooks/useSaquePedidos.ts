import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import type { SaquePedido, TipoChavePix } from '@/hooks/usePrestadorPerfil';
import { TIPO_PIX_LABELS } from '@/hooks/usePrestadorPerfil';
import { assertCanManagePontuaGarboFinanceiro } from '@/lib/pontua-garbo-access';

const PUBLIC_SAQUES = 'CRM-multi-empresas>prestador_saque_pedidos<' as const;
const PUBLIC_LANC   = 'CRM-multi-empresas>pontua_garbo_lancamentos<' as const;
const PUBLIC_USERS  = 'CRM-multi-empresas>usuarios<' as const;

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Read all pending saque requests (for admin financeiro view) */
export function useSaquePedidosAdmin(enabled = true) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const { user, userRole, isSuperAdmin } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();

  const saquesTable = table('prestador_saque_pedidos', PUBLIC_SAQUES);
  const lancTable   = table('pontua_garbo_lancamentos', PUBLIC_LANC);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['saque-pedidos-admin', schemaEmpresa],
    queryFn: async (): Promise<SaquePedido[]> => {
      const { data, error } = await db
        .from(saquesTable)
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SaquePedido[];
    },
    enabled: enabled && !!user?.id && queriesReady,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: enabled ? 30_000 : false,
  });

  const aprovar = useMutation({
    mutationFn: async (pedido: SaquePedido) => {
      assertCanManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
      const { error: lancErr } = await db.from(lancTable).insert({
        prestador_id: pedido.prestador_id,
        tipo: 'saque',
        valor: pedido.valor_solicitado,
        descricao: `Retirada via ${TIPO_PIX_LABELS[pedido.tipo_chave_pix as TipoChavePix] ?? pedido.tipo_chave_pix}: ${pedido.chave_pix}`,
        criado_por: user?.id ?? null,
        saque_pedido_id: pedido.id,
      });
      if (lancErr) throw lancErr;
      const { error } = await db
        .from(saquesTable)
        .update({ status: 'aprovado', processado_em: new Date().toISOString(), processado_por: user?.id })
        .eq('id', pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saque-pedidos-admin', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: ['pontua-garbo-financeiro', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo', schemaEmpresa] });
      toast.success('Retirada aprovada!');
    },
    onError: (e: Error) => toast.error('Erro ao aprovar', { description: e.message }),
  });

  const rejeitar = useMutation({
    mutationFn: async ({ id, obs }: { id: string; obs?: string }) => {
      assertCanManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
      const { error } = await db
        .from(saquesTable)
        .update({ status: 'rejeitado', obs_admin: obs ?? null, processado_em: new Date().toISOString(), processado_por: user?.id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saque-pedidos-admin', schemaEmpresa] });
      toast.success('Pedido rejeitado');
    },
    onError: (e: Error) => toast.error('Erro ao rejeitar', { description: e.message }),
  });

  const reverterAprovacao = useMutation({
    mutationFn: async (pedido: SaquePedido) => {
      assertCanManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
      if (pedido.status !== 'aprovado') {
        throw new Error('Só é possível desfazer pedidos que foram marcados como pagos.');
      }

      const { data: porRef, error: refErr } = await db
        .from(lancTable)
        .select('id')
        .eq('saque_pedido_id', pedido.id)
        .maybeSingle();
      if (refErr) throw refErr;

      if (porRef?.id) {
        const { error: delErr } = await db.from(lancTable).delete().eq('id', porRef.id);
        if (delErr) throw delErr;
      } else {
        const { data: legado, error: legErr } = await db
          .from(lancTable)
          .select('id')
          .eq('prestador_id', pedido.prestador_id)
          .eq('tipo', 'saque')
          .eq('valor', pedido.valor_solicitado)
          .ilike('descricao', `%${pedido.chave_pix}%`)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (legErr) throw legErr;
        if (!legado?.id) {
          throw new Error(
            'Não foi encontrado o lançamento desta retirada. Exclua manualmente em Movimentações do prestador.',
          );
        }
        const { error: delErr } = await db.from(lancTable).delete().eq('id', legado.id);
        if (delErr) throw delErr;
      }

      const { error } = await db
        .from(saquesTable)
        .update({
          status: 'pendente',
          processado_em: null,
          processado_por: null,
          obs_admin: null,
        })
        .eq('id', pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saque-pedidos-admin', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: ['pontua-garbo-financeiro', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo', schemaEmpresa] });
      toast.success(
        'Pagamento desfeito. O pedido voltou para aguardar aprovação e o saldo do prestador foi recalculado.',
      );
    },
    onError: (e: Error) => toast.error('Erro ao desfazer pagamento', { description: e.message }),
  });

  const pendentes = pedidos.filter((p) => p.status === 'pendente');

  return { pedidos, pendentes, isLoading, aprovar, rejeitar, reverterAprovacao };
}

/** Prestador reads their own requests */
export function useMeusSaquePedidos(prestadorId: string | null | undefined) {
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const saquesTable = table('prestador_saque_pedidos', PUBLIC_SAQUES);
  const lancTable   = table('pontua_garbo_lancamentos', PUBLIC_LANC);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['meus-saque-pedidos', schemaEmpresa, prestadorId],
    enabled: !!prestadorId,
    staleTime: 20_000,
    queryFn: async (): Promise<SaquePedido[]> => {
      const { data, error } = await db
        .from(saquesTable)
        .select('*')
        .eq('prestador_id', prestadorId!)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SaquePedido[];
    },
  });

  const solicitar = useMutation({
    mutationFn: async (input: { valor: number; chave_pix: string; tipo_chave_pix: string }) => {
      if (!prestadorId) throw new Error('Não identificado');
      const { error } = await db.from(saquesTable).insert({
        prestador_id: prestadorId,
        valor_solicitado: input.valor,
        chave_pix: input.chave_pix,
        tipo_chave_pix: input.tipo_chave_pix,
        status: 'pendente',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['meus-saque-pedidos', schemaEmpresa, prestadorId] });
      qc.invalidateQueries({ queryKey: ['saque-pedidos-admin', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo', schemaEmpresa] });
      toast.success('Saque solicitado no Pontua Garbo', {
        description: `Valor solicitado: ${BRL(variables.valor)}. Aguarde a aprovação do administrador.`,
        duration: 6000,
      });
    },
    onError: (e: Error) => toast.error('Erro ao solicitar retirada', { description: e.message }),
  });

  return { pedidos, isLoading, solicitar };
}

/** Só o nome dos prestadores — para o popup global, sem carregar o mural inteiro. */
export function useNomesPrestadoresPorIds(ids: string[], enabled = true) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const usersTable = table('usuarios', PUBLIC_USERS);
  const unique = [...new Set(ids.filter(Boolean))].sort();

  return useQuery({
    queryKey: ['prestador-nomes-saque', schemaEmpresa, unique.join(',')],
    enabled: enabled && queriesReady && unique.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await db.from(usersTable).select('id, nome').in('id', unique);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        const id = String(row.id ?? '');
        const nome = String(row.nome ?? '').trim();
        if (id && nome) map.set(id, nome);
      }
      return map;
    },
  });
}
