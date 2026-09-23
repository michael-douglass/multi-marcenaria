import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { assertCanManagePontuaGarboFinanceiro } from '@/lib/pontua-garbo-access';
import type { LeadCustomFieldDefinition } from '@/hooks/useLeadCustomFields';
import {
  buildPontuaGarboResumoFinanceiro,
  isLeadVendaGanha,
  isPontuaGarboFieldActive,
  resolvePontuaPercentual,
  resolveValorBaseComissaoGarbo,
} from '@/lib/pontua-garbo';
import { isPortalVendaPerdida } from '@/lib/crm-portal';
import { getStatusesContamComoGanho } from '@/lib/vendas-ganhos';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { validarValorSaquePontuaGarbo } from '@/lib/pontua-garbo-saque';
import { withTimeout } from '@/lib/with-timeout';
import {
  isComissaoAguardandoLiberacao,
  isComissaoLiberadaParaSaque,
  isErroTabelaLiberacaoIndisponivel,
  type ComissaoLiberacaoRow,
} from '@/lib/pontua-garbo-comissao-liberacao';

const PUBLIC_DEFS  = 'CRM-multi-empresas>lead_custom_field_definitions<' as const;
const PUBLIC_VALS  = 'CRM-multi-empresas>lead_custom_field_values<' as const;
const PUBLIC_LEADS = 'CRM-multi-empresas>leads<' as const;
const PUBLIC_USERS = 'CRM-multi-empresas>usuarios<' as const;
const PUBLIC_LANC  = 'CRM-multi-empresas>pontua_garbo_lancamentos<' as const;
const PUBLIC_LIB   = 'CRM-multi-empresas>pontua_garbo_comissao_liberacoes<' as const;
const PUBLIC_SAQUES = 'CRM-multi-empresas>prestador_saque_pedidos<' as const;

export interface ComissaoLead {
  leadId: number;
  leadNome: string;
  leadStatus: string;
  valorOrcamento: number;
  fieldNome: string;
  fieldId: string;
  percentual: number;
  comissao: number;
  churned?: boolean;
  vendaGanha?: boolean;
  comissaoLiberada?: boolean;
  comissaoAguardandoLiberacao?: boolean;
  liberacaoId?: string | null;
  vendaRealizadaEm?: string | null;
  dataChegada?: string | null;
  criadoEm?: string | null;
  leadEmail?: string | null;
  leadTelefone?: string | null;
  leadEmpresa?: string | null;
  leadOrigem?: string | null;
  leadRegiao?: string | null;
}

export interface PrestadorFinanceiro {
  id: string;
  nome: string;
  titulo: string | null;
  email: string | null;
  telefone: string | null;
  avatarUrl: string | null;
  criadoEm: string | null;
  leads: ComissaoLead[];
  totalComissao: number;
  totalAjustes: number;
  totalRetirado: number;
  saldoParaSacar: number;
  totalAguardandoLiberacao: number;
  lancamentos: Lancamento[];
}

export interface Lancamento {
  id: string;
  prestador_id: string;
  tipo: 'saque' | 'ajuste';
  valor: number;
  descricao: string | null;
  criado_em: string;
  saque_pedido_id?: string | null;
}

type LeadRow = {
  id: number;
  nome: string;
  status: string;
  valor_orcamento: number;
  valor_negocio: number;
  venda_realizada_em: string | null;
  data_chegada: string | null;
  criado_em: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  origem: string | null;
  regiao: string | null;
};
type UserRow = {
  id: string;
  nome: string;
  titulo: string | null;
  comissao_ativa: boolean;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  criado_em: string | null;
};
type ValRow  = {
  lead_id: number;
  field_id: string;
  valor: string;
  pontua_garbo_percentual: number | null;
};
type LancRow = { tipo: string; valor: number };

export function usePontuaGarboFinanceiro(options?: { enabled?: boolean }) {
  const { schemaEmpresa } = useEmpresa();
  const { user, userRole, isSuperAdmin } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const { config: vendasGanhosConfig } = useVendasGanhosConfig();
  const ganhoStatuses = getStatusesContamComoGanho(vendasGanhosConfig);

  const defsTable  = table('lead_custom_field_definitions', PUBLIC_DEFS);
  const valsTable  = table('lead_custom_field_values', PUBLIC_VALS);
  const leadsTable = table('leads', PUBLIC_LEADS);
  const usersTable = table('usuarios', PUBLIC_USERS);
  const lancTable  = table('pontua_garbo_lancamentos', PUBLIC_LANC);
  const libTable   = table('pontua_garbo_comissao_liberacoes', PUBLIC_LIB);
  const saquesTable = table('prestador_saque_pedidos', PUBLIC_SAQUES);
  const queryKey   = ['pontua-garbo-financeiro', schemaEmpresa, ganhoStatuses.join('|')] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      withTimeout(
        20_000,
        'O mural do Pontua demorou demais. Recarregue a página.',
        async (): Promise<PrestadorFinanceiro[]> => {
      const { data: prestadoresAtivos, error: prestadoresErr } = await db
        .from(usersTable)
        .select('id, nome, titulo, comissao_ativa, tipo_usuario, email, telefone, avatar_url, criado_em')
        .eq('tipo_usuario', 'prestador_servico')
        .eq('comissao_ativa', true)
        .order('nome', { ascending: true });
      if (prestadoresErr) throw prestadoresErr;

      const prestadoresMap = new Map<
        string,
        Omit<PrestadorFinanceiro, 'totalAjustes' | 'totalRetirado' | 'saldoParaSacar' | 'lancamentos'>
      >();
      for (const u of (prestadoresAtivos ?? []) as UserRow[]) {
        prestadoresMap.set(u.id, {
          id: u.id,
          nome: u.nome,
          titulo: u.titulo,
          email: u.email ?? null,
          telefone: u.telefone ?? null,
          avatarUrl: u.avatar_url ?? null,
          criadoEm: u.criado_em ?? null,
          leads: [],
          totalComissao: 0,
        });
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

      const usersMap = new Map<string, UserRow>();
      (prestadoresAtivos ?? []).forEach((u: UserRow) => usersMap.set(u.id, u));

      const leadsMap = new Map<number, LeadRow>();
      let valRows: ValRow[] = [];

      if (activeDefs.length > 0) {
        const defIds = activeDefs.map((d) => d.id);

        const { data: vals, error: valsErr } = await db
          .from(valsTable)
          .select('lead_id, field_id, valor, pontua_garbo_percentual')
          .in('field_id', defIds)
          .not('valor', 'is', null);
        if (valsErr) throw valsErr;

        valRows = (vals ?? []) as ValRow[];

        if (valRows.length > 0) {
          const leadIds = [...new Set(valRows.map((v) => v.lead_id))];

          const { data: leadsData, error: leadsErr } = await db
            .from(leadsTable)
            .select('id, nome, status, valor_orcamento, valor_negocio, venda_realizada_em')
            .in('id', leadIds);
          if (leadsErr) throw leadsErr;

          (leadsData ?? []).forEach((l: LeadRow) => leadsMap.set(l.id, l));
        }
      }

      const { data: lancData, error: lancErr } = await db
        .from(lancTable)
        .select('id, prestador_id, tipo, valor, descricao, criado_em, saque_pedido_id')
        .order('criado_em', { ascending: false });
      if (lancErr) throw lancErr;

      const lancRows = (lancData ?? []) as Lancamento[];

      const libKey = (leadId: number, fieldId: string) => `${leadId}:${fieldId}`;
      const libMap = new Map<string, Pick<ComissaoLiberacaoRow, 'id' | 'status'>>();
      const { data: libData, error: libErr } = await db
        .from(libTable)
        .select('id, lead_id, field_id, prestador_id, status');
      if (libErr && !isErroTabelaLiberacaoIndisponivel(libErr)) throw libErr;
      if (!libErr) {
        (libData ?? []).forEach((row: { id: string; lead_id: number; field_id: string; status: string }) => {
          libMap.set(libKey(row.lead_id, row.field_id), {
            id: row.id,
            status: row.status as ComissaoLiberacaoRow['status'],
          });
        });
      }

      for (const val of valRows) {
        const prestador = usersMap.get(val.valor);
        if (!prestador || prestador.comissao_ativa === false) continue;
        const lead = leadsMap.get(val.lead_id);
        if (!lead) continue;
        if (isPortalVendaPerdida(lead.status)) continue;
        const def = activeDefs.find((d) => d.id === val.field_id);
        if (!isPontuaGarboFieldActive(def)) continue;

        const percentual = resolvePontuaPercentual(val, def);
        if (percentual <= 0) continue;
        const baseValor = resolveValorBaseComissaoGarbo(
          lead.status,
          lead.valor_orcamento ?? 0,
          lead.valor_negocio ?? 0,
          ganhoStatuses,
        );
        const comissao = (baseValor * percentual) / 100;

        if (!prestadoresMap.has(val.valor)) continue;

        const p = prestadoresMap.get(val.valor)!;
        const vendaGanha = isLeadVendaGanha(lead.status, ganhoStatuses);
        const liberacao = libMap.get(libKey(val.lead_id, val.field_id));
        const comissaoLiberada = isComissaoLiberadaParaSaque(vendaGanha, liberacao);
        const comissaoAguardandoLiberacao = isComissaoAguardandoLiberacao(vendaGanha, liberacao);
        p.leads.push({
          leadId: val.lead_id,
          leadNome: lead.nome,
          leadStatus: lead.status,
          valorOrcamento: resolveValorBaseComissaoGarbo(
            lead.status,
            lead.valor_orcamento ?? 0,
            lead.valor_negocio ?? 0,
            ganhoStatuses,
          ),
          fieldNome: def.nome,
          fieldId: def.id,
          percentual,
          comissao,
          vendaGanha,
          comissaoLiberada,
          comissaoAguardandoLiberacao,
          liberacaoId: liberacao?.id ?? null,
          vendaRealizadaEm: lead.venda_realizada_em,
        });
      }

      return Array.from(prestadoresMap.values()).map((p) => {
        const myLanc = lancRows.filter((l) => l.prestador_id === p.id);
        const totalAjustes  = myLanc.filter((l) => l.tipo === 'ajuste').reduce((sum, l) => sum + Number(l.valor), 0);
        const totalRetirado = myLanc.filter((l) => l.tipo === 'saque').reduce((sum, l) => sum + Number(l.valor), 0);
        const ganhasLiberadas = p.leads.filter((l) => l.comissaoLiberada);
        const aguardando = p.leads.filter((l) => l.comissaoAguardandoLiberacao);
        const pendentes = p.leads.filter((l) => !l.vendaGanha);
        const resumo = buildPontuaGarboResumoFinanceiro(
          ganhasLiberadas.map((l) => ({
            comissao: l.comissao,
            vendaRealizadaEm: l.vendaRealizadaEm ?? null,
          })),
          pendentes.reduce((s, l) => s + l.comissao, 0),
          totalAjustes,
          totalRetirado,
          aguardando.reduce((s, l) => s + l.comissao, 0),
        );
        return {
          ...p,
          totalAjustes,
          totalRetirado,
          totalComissao: resumo.totalAGanar + resumo.totalComissaoGanha,
          saldoParaSacar: resumo.saldoParaSacar,
          totalAguardandoLiberacao: resumo.totalAguardandoLiberacao,
          lancamentos: myLanc,
        };
      });
        },
      ),
    enabled: (options?.enabled ?? true) && !!user?.id,
    staleTime: 30_000,
  });

  const createLancamento = useMutation({
    mutationFn: async (input: {
      prestadorId: string;
      tipo: 'saque' | 'ajuste';
      valor: number;
      descricao?: string;
    }) => {
      assertCanManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
      if (input.tipo === 'saque') {
        const lista = qc.getQueryData<PrestadorFinanceiro[]>(queryKey) ?? [];
        const prestador = lista.find((p) => p.id === input.prestadorId);
        const saldo = prestador?.saldoParaSacar ?? 0;
        const check = validarValorSaquePontuaGarbo(saldo, input.valor);
        if (!check.ok) throw new Error(check.message);
      }
      const { error } = await db.from(lancTable).insert({
        prestador_id: input.prestadorId,
        tipo: input.tipo,
        valor: input.valor,
        descricao: input.descricao ?? null,
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Lançamento registrado!');
    },
    onError: (e: Error) => toast.error('Erro ao registrar', { description: e.message }),
  });

  const deleteLancamento = useMutation({
    mutationFn: async (id: string) => {
      assertCanManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
      const { data: row, error: fetchErr } = await db
        .from(lancTable)
        .select('id, saque_pedido_id')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!row) throw new Error('Lançamento não encontrado.');

      if (row.saque_pedido_id) {
        const { error: pedidoErr } = await db
          .from(saquesTable)
          .update({
            status: 'pendente',
            processado_em: null,
            processado_por: null,
            obs_admin: null,
          })
          .eq('id', row.saque_pedido_id)
          .eq('status', 'aprovado');
        if (pedidoErr) throw pedidoErr;
      }

      const { error } = await db.from(lancTable).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['saque-pedidos-admin', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
      qc.invalidateQueries({ queryKey: ['pontua-garbo-comissao-liberacao'] });
      toast.success('Lançamento excluído. O saldo do prestador foi recalculado.');
    },
    onError: (e: Error) => toast.error('Erro ao remover', { description: e.message }),
  });

  return { prestadores: data ?? [], isLoading, createLancamento, deleteLancamento };
}

export function useMinhaPontuaGarbo(prestadorId: string | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { config: vendasGanhosConfig } = useVendasGanhosConfig();
  const ganhoStatuses = getStatusesContamComoGanho(vendasGanhosConfig);

  const defsTable  = table('lead_custom_field_definitions', PUBLIC_DEFS);
  const valsTable  = table('lead_custom_field_values', PUBLIC_VALS);
  const leadsTable = table('leads', PUBLIC_LEADS);
  const lancTable  = table('pontua_garbo_lancamentos', PUBLIC_LANC);
  const libTable   = table('pontua_garbo_comissao_liberacoes', PUBLIC_LIB);

  return useQuery({
    queryKey: ['minha-pontua-garbo', schemaEmpresa, prestadorId, ganhoStatuses.join('|')],
    enabled: queriesReady && !!prestadorId,
    staleTime: 30_000,
    queryFn: () =>
      withTimeout(
        20_000,
        'O Pontua demorou demais. Recarregue a página.',
        async () => {
      if (!prestadorId) return null;

      const { data: defs, error: defsErr } = await db
        .from(defsTable)
        .select('id, nome, tipo, ativo, config_pontua_garbo')
        .eq('tipo', 'usuario_sistema')
        .eq('ativo', true);
      if (defsErr) throw defsErr;

      const activeDefs = ((defs ?? []) as LeadCustomFieldDefinition[]).filter((d) =>
        isPontuaGarboFieldActive(d),
      );

      const empty = {
        leads: [] as ComissaoLead[],
        churnedLeads: [] as ComissaoLead[],
        totalAGanar: 0,
        totalComissaoCarteira: 0,
        totalComissaoGanha: 0,
        totalComissao: 0,
        ganhoMesAtual: 0,
        mediaMensalGanhos: 0,
        ganhosPorMes: [] as { key: string; label: string; valor: number }[],
        totalAjustes: 0,
        totalRetirado: 0,
        saldoParaSacar: 0,
        totalAguardandoLiberacao: 0,
      };

      if (activeDefs.length === 0) return empty;

      const { data: vals, error: valsErr } = await db
        .from(valsTable)
        .select('lead_id, field_id, valor, pontua_garbo_percentual')
        .in('field_id', activeDefs.map((d) => d.id))
        .eq('valor', prestadorId);
      if (valsErr) throw valsErr;

      const myVals = (vals ?? []) as ValRow[];

      if (myVals.length === 0) return empty;

      const leadIds = [...new Set(myVals.map((v) => v.lead_id))];

      const { data: leadsData, error: leadsErr } = await db
        .from(leadsTable)
        .select(
          'id, nome, status, valor_orcamento, valor_negocio, venda_realizada_em, data_chegada, criado_em, email, telefone, empresa, origem, regiao',
        )
        .in('id', leadIds);
      if (leadsErr) throw leadsErr;

      const leadsMap = new Map<number, LeadRow>();
      (leadsData ?? []).forEach((l: LeadRow) => leadsMap.set(l.id, l));

      const libKey = (leadId: number, fieldId: string) => `${leadId}:${fieldId}`;
      const libMap = new Map<string, Pick<ComissaoLiberacaoRow, 'id' | 'status'>>();
      const { data: libData, error: libErr } = await db
        .from(libTable)
        .select('id, lead_id, field_id, status')
        .eq('prestador_id', prestadorId);
      if (libErr && !isErroTabelaLiberacaoIndisponivel(libErr)) throw libErr;
      if (!libErr) {
        (libData ?? []).forEach((row: { id: string; lead_id: number; field_id: string; status: string }) => {
          libMap.set(libKey(row.lead_id, row.field_id), {
            id: row.id,
            status: row.status as ComissaoLiberacaoRow['status'],
          });
        });
      }

      const leads: ComissaoLead[] = [];
      const churnedLeads: ComissaoLead[] = [];

      for (const val of myVals) {
        const lead = leadsMap.get(val.lead_id);
        if (!lead) continue;
        const def = activeDefs.find((d) => d.id === val.field_id);
        if (!isPontuaGarboFieldActive(def)) continue;
        const percentual = resolvePontuaPercentual(val, def);
        if (percentual <= 0) continue;
        const vendaGanha = isLeadVendaGanha(lead.status, ganhoStatuses);
        const baseValor = resolveValorBaseComissaoGarbo(
          lead.status,
          lead.valor_orcamento ?? 0,
          lead.valor_negocio ?? 0,
          ganhoStatuses,
        );
        const comissao = (baseValor * percentual) / 100;
        const liberacao = libMap.get(libKey(val.lead_id, val.field_id));
        const comissaoLiberada = isComissaoLiberadaParaSaque(vendaGanha, liberacao);
        const comissaoAguardandoLiberacao = isComissaoAguardandoLiberacao(vendaGanha, liberacao);

        const item: ComissaoLead = {
          leadId: val.lead_id,
          leadNome: lead.nome,
          leadStatus: lead.status,
          valorOrcamento: baseValor,
          fieldNome: def.nome,
          fieldId: def.id,
          percentual,
          comissao,
          vendaGanha,
          comissaoLiberada,
          comissaoAguardandoLiberacao,
          liberacaoId: liberacao?.id ?? null,
          vendaRealizadaEm: lead.venda_realizada_em,
          dataChegada: lead.data_chegada,
          criadoEm: lead.criado_em,
          leadEmail: lead.email,
          leadTelefone: lead.telefone,
          leadEmpresa: lead.empresa,
          leadOrigem: lead.origem,
          leadRegiao: lead.regiao,
        };
        if (isPortalVendaPerdida(lead.status)) {
          churnedLeads.push({ ...item, churned: true });
        } else {
          leads.push(item);
        }
      }

      const { data: lancData } = await db
        .from(lancTable)
        .select('tipo, valor')
        .eq('prestador_id', prestadorId);

      const myLanc = (lancData ?? []) as LancRow[];
      const totalAjustes  = myLanc.filter((l) => l.tipo === 'ajuste').reduce((s, l) => s + Number(l.valor), 0);
      const totalRetirado = myLanc.filter((l) => l.tipo === 'saque').reduce((s, l) => s + Number(l.valor), 0);

      const ganhasLiberadas = leads.filter((l) => l.comissaoLiberada);
      const aguardando = leads.filter((l) => l.comissaoAguardandoLiberacao);
      const pendentes = leads.filter((l) => !l.vendaGanha);
      const resumo = buildPontuaGarboResumoFinanceiro(
        ganhasLiberadas.map((l) => ({
          comissao: l.comissao,
          vendaRealizadaEm: l.vendaRealizadaEm ?? null,
        })),
        pendentes.reduce((s, l) => s + l.comissao, 0),
        totalAjustes,
        totalRetirado,
        aguardando.reduce((s, l) => s + l.comissao, 0),
      );

      return {
        leads,
        churnedLeads,
        ...resumo,
        totalComissao: resumo.totalComissaoCarteira,
        totalAjustes,
        totalRetirado,
      };
        },
      ),
  });
}
