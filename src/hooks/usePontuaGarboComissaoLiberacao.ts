import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import type { LeadCustomFieldDefinition } from '@/hooks/useLeadCustomFields';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { getStatusesContamComoGanho } from '@/lib/vendas-ganhos';
import {
  COMISSAO_LIBERACAO_AGUARDANDO,
  COMISSAO_LIBERACAO_LIBERADA,
  type ComissaoLiberacaoRow,
} from '@/lib/pontua-garbo-comissao-liberacao';
import {
  isLeadVendaGanha,
  isPontuaGarboFieldActive,
  resolvePontuaPercentual,
  resolveValorBaseComissaoGarbo,
} from '@/lib/pontua-garbo';
import {
  buildDescricaoContaPagarPontuaGarbo,
} from '@/lib/pontua-garbo-conta-pagar';
import { usePontuaGarboFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import { assertCanManagePontuaGarboFinanceiro } from '@/lib/pontua-garbo-access';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

const PUBLIC_LIB = 'CRM-multi-empresas>pontua_garbo_comissao_liberacoes<' as const;
const PUBLIC_DEFS = 'CRM-multi-empresas>lead_custom_field_definitions<' as const;
const PUBLIC_VALS = 'CRM-multi-empresas>lead_custom_field_values<' as const;
const PUBLIC_LEADS = 'CRM-multi-empresas>leads<' as const;
const PUBLIC_USERS = 'CRM-multi-empresas>usuarios<' as const;

export interface ComissaoAguardandoLiberacao {
  liberacaoId: string | null;
  leadId: number;
  fieldId: string;
  prestadorId: string;
  prestadorNome: string;
  leadNome: string;
  leadStatus: string;
  fieldNome: string;
  valorComissao: number;
  percentual: number;
  valorBase: number;
}

export const liberacaoQueryKey = (schema: string) =>
  ['pontua-garbo-comissao-liberacao', schema] as const;

/** Mantém a conta a pagar alinhada à comissão (valor / nome / descrição Pontua Garbo). */
async function syncContaPagarPontuaGarbo(
  contaPagarId: string,
  prestadorNome: string,
  valorComissao: number,
): Promise<void> {
  const valor = Math.round(Math.max(0, valorComissao) * 100) / 100;
  if (valor <= 0) return;

  const nome = (prestadorNome ?? '').trim() || 'Arquiteto';
  const { error } = await supabase
    .from('movelaria_contas_pagar')
    .update({
      fornecedor_nome: nome,
      descricao: buildDescricaoContaPagarPontuaGarbo(nome),
      valor_total: valor,
      valor_parcela: valor,
    })
    .eq('id', contaPagarId)
    .eq('status', 'pendente');

  if (error) {
    console.warn('[pontua-garbo] Falha ao atualizar conta a pagar vinculada:', error.message);
  }
}

/** Após marcar venda como ganha: cria registro aguardando liberação (se houver comissão). */
export async function syncPontuaGarboLiberacaoAposVenda(
  db: ReturnType<typeof useEmpresaSupabase>,
  table: ReturnType<typeof useTableName>,
  leadId: number,
  ganhoStatuses: string[],
): Promise<{ criouOuAtualizou: boolean }> {
  const libTable = table('pontua_garbo_comissao_liberacoes', PUBLIC_LIB);
  const defsTable = table('lead_custom_field_definitions', PUBLIC_DEFS);
  const valsTable = table('lead_custom_field_values', PUBLIC_VALS);
  const leadsTable = table('leads', PUBLIC_LEADS);
  const usersTable = table('usuarios', PUBLIC_USERS);

  const { data: lead, error: leadErr } = await db
    .from(leadsTable)
    .select('id, status, valor_orcamento, valor_negocio')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr) throw leadErr;
  if (!lead || !isLeadVendaGanha(lead.status, ganhoStatuses)) {
    return { criouOuAtualizou: false };
  }

  const { data: defs, error: defsErr } = await db
    .from(defsTable)
    .select('*')
    .eq('tipo', 'usuario_sistema')
    .eq('ativo', true);
  if (defsErr) throw defsErr;

  const activeDefs = ((defs ?? []) as LeadCustomFieldDefinition[]).filter((d) =>
    isPontuaGarboFieldActive(d),
  );
  if (activeDefs.length === 0) return { criouOuAtualizou: false };

  const { data: vals, error: valsErr } = await db
    .from(valsTable)
    .select('lead_id, field_id, valor, pontua_garbo_percentual')
    .eq('lead_id', leadId)
    .in('field_id', activeDefs.map((d) => d.id));
  if (valsErr) throw valsErr;

  let criouOuAtualizou = false;

  for (const val of vals ?? []) {
    const prestadorId = (val.valor ?? '').trim();
    if (!prestadorId) continue;

    const def = activeDefs.find((d) => d.id === val.field_id);
    if (!isPontuaGarboFieldActive(def)) continue;

    const { data: prestador, error: userErr } = await db
      .from(usersTable)
      .select('id, nome, titulo, comissao_ativa, tipo_usuario')
      .eq('id', prestadorId)
      .eq('tipo_usuario', 'prestador_servico')
      .maybeSingle();
    if (userErr) throw userErr;
    if (!prestador?.id || prestador.comissao_ativa === false) continue;

    const percentual = resolvePontuaPercentual(val, def);
    if (percentual <= 0) continue;

    const valorBase = resolveValorBaseComissaoGarbo(
      lead.status,
      lead.valor_orcamento ?? 0,
      lead.valor_negocio ?? 0,
      ganhoStatuses,
    );
    const valorComissao = (valorBase * percentual) / 100;

    const { data: existing } = await db
      .from(libTable)
      .select('id, status, conta_pagar_id')
      .eq('lead_id', leadId)
      .eq('field_id', val.field_id)
      .maybeSingle();

    if (existing?.status === COMISSAO_LIBERACAO_LIBERADA) continue;

    const payload = {
      prestador_id: prestadorId,
      valor_comissao: valorComissao,
      percentual,
      valor_base: valorBase,
      status: COMISSAO_LIBERACAO_AGUARDANDO,
    };

    let liberacaoId: string | null = existing?.id ?? null;
    let contaPagarId: string | null = existing?.conta_pagar_id ?? null;

    if (existing?.id) {
      const { data: updated, error: upErr } = await db
        .from(libTable)
        .update(payload)
        .eq('id', existing.id)
        .select('id, conta_pagar_id')
        .maybeSingle();
      if (upErr) throw upErr;
      liberacaoId = updated?.id ?? existing.id;
      contaPagarId = updated?.conta_pagar_id ?? existing.conta_pagar_id ?? null;
    } else {
      const { data: inserted, error: insErr } = await db
        .from(libTable)
        .insert({
          lead_id: leadId,
          field_id: val.field_id,
          ...payload,
        })
        .select('id, conta_pagar_id')
        .maybeSingle();
      if (insErr) throw insErr;
      liberacaoId = inserted?.id ?? null;
      contaPagarId = inserted?.conta_pagar_id ?? null;
    }

    criouOuAtualizou = true;

    // Trigger do banco cria a conta no INSERT; se já existia, alinhamos valor/descrição.
    if (contaPagarId) {
      const nomeArquiteto =
        (prestador.titulo as string | null)?.trim() ||
        (prestador.nome as string | null)?.trim() ||
        'Arquiteto';
      await syncContaPagarPontuaGarbo(contaPagarId, nomeArquiteto, valorComissao);
    } else if (liberacaoId) {
      // Fallback: trigger pode não ter rodado (ex.: grant) — tenta via RPC se existir.
      const { data: rpcContaId, error: rpcErr } = await supabase.rpc(
        'movelaria_criar_conta_pagar_pontua_garbo',
        {
          p_liberacao_id: liberacaoId,
          p_prestador_id: prestadorId,
          p_lead_id: leadId,
          p_valor_comissao: valorComissao,
        },
      );
      if (!rpcErr && rpcContaId) {
        await db
          .from(libTable)
          .update({ conta_pagar_id: rpcContaId })
          .eq('id', liberacaoId)
          .is('conta_pagar_id', null);
      } else if (rpcErr) {
        console.warn('[pontua-garbo] RPC conta a pagar:', rpcErr.message);
      }
    }
  }

  return { criouOuAtualizou };
}

export function useComissoesAguardandoLiberacao() {
  const { prestadores, isLoading: loadingFinanceiro } = usePontuaGarboFinanceiro();

  const aguardando = useMemo((): ComissaoAguardandoLiberacao[] => {
    const items: ComissaoAguardandoLiberacao[] = [];
    for (const p of prestadores) {
      for (const lead of p.leads) {
        if (!lead.comissaoAguardandoLiberacao) continue;
        items.push({
          liberacaoId: lead.liberacaoId ?? null,
          leadId: lead.leadId,
          fieldId: lead.fieldId,
          prestadorId: p.id,
          prestadorNome: p.nome,
          leadNome: lead.leadNome,
          leadStatus: lead.leadStatus,
          fieldNome: lead.fieldNome,
          valorComissao: lead.comissao,
          percentual: lead.percentual,
          valorBase: lead.valorOrcamento,
        });
      }
    }
    return items;
  }, [prestadores]);

  return { aguardando, isLoading: loadingFinanceiro };
}

export interface LiberarComissaoInput {
  liberacaoId: string | null;
  leadId: number;
  fieldId: string;
  prestadorId: string;
  valorComissao: number;
  percentual: number;
  valorBase: number;
}

export interface ReverterComissaoInput {
  liberacaoId: string;
  leadId: number;
  fieldId: string;
}

/** Desfaz liberação: comissão volta a aguardar aprovação e sai do saldo para sacar. */
export function useReverterComissaoLiberacao() {
  const { schemaEmpresa } = useEmpresa();
  const { userRole, isSuperAdmin } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const libTable = table('pontua_garbo_comissao_liberacoes', PUBLIC_LIB);
  const qk = liberacaoQueryKey(schemaEmpresa);

  return useMutation({
    mutationFn: async (input: ReverterComissaoInput) => {
      assertCanManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
      const { error } = await db
        .from(libTable)
        .update({
          status: COMISSAO_LIBERACAO_AGUARDANDO,
          liberado_em: null,
          liberado_por: null,
        })
        .eq('id', input.liberacaoId)
        .eq('status', COMISSAO_LIBERACAO_LIBERADA);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      qc.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
      toast.success(
        'Liberação desfeita. A comissão voltou para aguardar aprovação e o saldo do prestador foi ajustado.',
      );
    },
    onError: (e: Error) =>
      toast.error('Erro ao desfazer liberação', { description: e.message }),
  });
}

export function useLiberarComissaoPontuaGarbo() {
  const { schemaEmpresa } = useEmpresa();
  const { user, userRole, isSuperAdmin } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const libTable = table('pontua_garbo_comissao_liberacoes', PUBLIC_LIB);
  const qk = liberacaoQueryKey(schemaEmpresa);

  return useMutation({
    mutationFn: async (input: LiberarComissaoInput) => {
      assertCanManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
      const payload = {
        status: COMISSAO_LIBERACAO_LIBERADA,
        liberado_em: new Date().toISOString(),
        liberado_por: user?.id ?? null,
        prestador_id: input.prestadorId,
        valor_comissao: input.valorComissao,
        percentual: input.percentual,
        valor_base: input.valorBase,
      };

      if (input.liberacaoId) {
        const { error } = await db
          .from(libTable)
          .update(payload)
          .eq('id', input.liberacaoId);
        if (error) throw error;
        return;
      }

      const { error } = await db.from(libTable).upsert(
        {
          lead_id: input.leadId,
          field_id: input.fieldId,
          ...payload,
        },
        { onConflict: 'lead_id,field_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      qc.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
      toast.success('Comissão liberada! O prestador já pode sacar este valor.');
    },
    onError: (e: Error) =>
      toast.error('Erro ao liberar comissão', { description: e.message }),
  });
}

export function useSyncPontuaGarboLiberacaoAposVenda() {
  const db = useEmpresaSupabase();
  const tableFn = useTableName();
  const { config: vendasGanhosConfig } = useVendasGanhosConfig();
  const ganhoStatuses = getStatusesContamComoGanho(vendasGanhosConfig);
  const qc = useQueryClient();
  const { schemaEmpresa } = useEmpresa();

  return useMutation({
    mutationFn: (leadId: number) =>
      syncPontuaGarboLiberacaoAposVenda(db, tableFn, leadId, ganhoStatuses),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: liberacaoQueryKey(schemaEmpresa) });
      qc.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
      // Contas a pagar (hook local + eventuais caches)
      qc.invalidateQueries({ queryKey: ['contas-pagar'] });
      qc.invalidateQueries({ queryKey: ['contasPagar'] });
    },
  });
}
