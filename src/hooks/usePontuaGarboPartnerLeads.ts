import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadCustomFieldDefinition } from '@/hooks/useLeadCustomFields';
import {
  isPontuaGarboFieldActive,
  PONTUA_GARBO_LEAD_ORIGEM,
  PONTUA_GARBO_LEAD_STATUS_INICIAL,
} from '@/lib/pontua-garbo';
import { accumulateIndicacoesPorMes } from '@/lib/pontua-garbo-indicacoes-mes';
import {
  getStatusesContamComoGanho,
  normalizeVendasGanhosConfig,
  parseFontesFromDb,
} from '@/lib/vendas-ganhos';
import { PONTUA_GARBO_TITULO_PADRAO } from '@/lib/pontua-garbo-arquiteto';
import { canManagePontuaGarboFinanceiro } from '@/lib/pontua-garbo-access';
import { withTimeout } from '@/lib/with-timeout';
import { PASSWORD_MIN_LENGTH } from '@/lib/password-rules';
import { pickPrimaryRole } from '@/lib/app-roles';
import { patchLeadInAllCaches } from '@/lib/leads-cache';
import {
  MIN_SCORE_VINCULO_PONTUA,
  partnerNameTokens,
  pickBestPartnerLead,
  scorePartnerLeadMatch,
  type PartnerLeadCandidate,
} from '@/lib/pontua-garbo-partner-match';
import { EMAIL_FORMATO_INVALIDO, isValidLeadEmail, parseLeadEmail } from '@/lib/lead-email';

const PUBLIC_DEFS = 'CRM-multi-empresas>lead_custom_field_definitions<' as const;
const PUBLIC_VALS = 'CRM-multi-empresas>lead_custom_field_values<' as const;
const PUBLIC_LEADS = 'CRM-multi-empresas>leads<' as const;
const PUBLIC_GANHOS = 'CRM-multi-empresas>pipeline_vendas_ganhos_config<' as const;
const PUBLIC_USERS = 'CRM-multi-empresas>usuarios<' as const;

type EmpresaDb = ReturnType<typeof useEmpresaSupabase>;

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, ' ').trim();
}

async function fetchPartnerLeadCandidates(
  db: EmpresaDb,
  leadsTable: string,
  input: { nome: string; email?: string | null },
): Promise<PartnerLeadCandidate[]> {
  const email = input.email?.trim().toLowerCase() || null;
  const tokens = partnerNameTokens(input.nome);
  const rawFirst = escapeIlike(input.nome.trim().split(/\s+/)[0] ?? '');
  const firstToken = escapeIlike(tokens[0] ?? rawFirst);
  const filters: string[] = [];
  if (email) filters.push(`email.ilike.${email}`);
  if (rawFirst.length >= 3) filters.push(`nome.ilike.%${rawFirst}%`);
  if (firstToken.length >= 3 && firstToken.toLowerCase() !== rawFirst.toLowerCase()) {
    filters.push(`nome.ilike.%${firstToken}%`);
  }
  if (filters.length === 0) return [];

  const { data, error } = await db
    .from(leadsTable)
    .select('id, nome, email, telefone, status, pontua_garbo_usuario_id')
    .or(filters.join(','))
    .order('id', { ascending: true })
    .limit(80);
  if (error) throw error;
  return (data ?? []) as PartnerLeadCandidate[];
}

async function linkLeadToPontuaUsuario(
  db: EmpresaDb,
  leadsTable: string,
  leadId: number,
  usuarioId: string,
): Promise<number> {
  const { data: current } = await db
    .from(leadsTable)
    .select('id')
    .eq('pontua_garbo_usuario_id', usuarioId)
    .maybeSingle();
  if (current?.id && current.id !== leadId) {
    const { error: unlinkErr } = await db
      .from(leadsTable)
      .update({ pontua_garbo_usuario_id: null })
      .eq('id', current.id);
    if (unlinkErr) throw unlinkErr;
  }
  const { error } = await db
    .from(leadsTable)
    .update({ pontua_garbo_usuario_id: usuarioId })
    .eq('id', leadId);
  if (error) throw error;
  return leadId;
}

async function resolveExistingPartnerLead(
  db: EmpresaDb,
  leadsTable: string,
  input: { usuarioId: string; nome: string; email?: string | null; telefone?: string | null },
): Promise<number | null> {
  const { data: linked } = await db
    .from(leadsTable)
    .select('id, nome, email, telefone, status, pontua_garbo_usuario_id')
    .eq('pontua_garbo_usuario_id', input.usuarioId)
    .maybeSingle();

  const candidates = await fetchPartnerLeadCandidates(db, leadsTable, input);
  const userRef = {
    usuarioId: input.usuarioId,
    nome: input.nome,
    email: input.email,
    telefone: input.telefone,
  };
  const best = pickBestPartnerLead(userRef, candidates);
  const bestScore = best ? scorePartnerLeadMatch(userRef, best) : 0;
  const linkedScore = linked
    ? scorePartnerLeadMatch(userRef, linked as PartnerLeadCandidate)
    : 0;

  const shouldRelink =
    Boolean(best) &&
    bestScore >= MIN_SCORE_VINCULO_PONTUA &&
    (!linked || best!.id !== linked.id) &&
    (linkedScore < MIN_SCORE_VINCULO_PONTUA || bestScore > linkedScore + 10);

  if (shouldRelink && best) {
    return linkLeadToPontuaUsuario(db, leadsTable, best.id, input.usuarioId);
  }
  if (linked?.id && linkedScore >= MIN_SCORE_VINCULO_PONTUA) {
    return linked.id as number;
  }
  if (best) {
    return linkLeadToPontuaUsuario(db, leadsTable, best.id, input.usuarioId);
  }
  if (linked?.id) return linked.id as number;
  return null;
}

export interface PontuaGarboPartnerBadge {
  usuarioId: string;
  /** Totais de todos os meses (indicação ainda no funil / já vendida). */
  aberto: number;
  fechado: number;
  /** Totais por mês (YYYY-MM). Aberto = chegada; fechado = data da venda. */
  porMes: Record<string, { aberto: number; fechado: number }>;
  primeiroMes: string | null;
}

export const pontuaGarboPartnerMapQueryKey = (schema: string | null | undefined) =>
  ['pontua-garbo-partner-map', schema, 'por-mes'] as const;

/**
 * Mapa leadId → parceiro Pontua Garbo + orçamentos que ele já indicou
 * (abertos ainda no funil, fechados já vendidos).
 */
export function usePontuaGarboPartnerMap() {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();

  return useQuery({
    queryKey: pontuaGarboPartnerMapQueryKey(schemaEmpresa),
    enabled: queriesReady,
    staleTime: 60_000,
    queryFn: () =>
      withTimeout(
        15_000,
        'O Pontua demorou demais. Recarregue a página.',
        async (): Promise<Map<number, PontuaGarboPartnerBadge>> => {
      const leadsTable = table('leads', PUBLIC_LEADS);
      const defsTable = table('lead_custom_field_definitions', PUBLIC_DEFS);
      const valsTable = table('lead_custom_field_values', PUBLIC_VALS);
      const ganhosTable = table('pipeline_vendas_ganhos_config', PUBLIC_GANHOS);

      const { data: ganhosRow } = await db
        .from(ganhosTable)
        .select('status_destino_ao_ganhar, fontes')
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      const ganhoStatuses = getStatusesContamComoGanho(
        normalizeVendasGanhosConfig({
          statusDestinoAoGanhar: (ganhosRow?.status_destino_ao_ganhar as string | undefined) ?? '',
          fontes: parseFontesFromDb(ganhosRow?.fontes),
        }),
      );

      const { data: partnerRows, error: partnerErr } = await db
        .from(leadsTable)
        .select('id, pontua_garbo_usuario_id')
        .not('pontua_garbo_usuario_id', 'is', null);
      if (partnerErr) throw partnerErr;

      const map = new Map<number, PontuaGarboPartnerBadge>();
      const usuarioToLead = new Map<string, number>();
      for (const row of partnerRows ?? []) {
        const usuarioId = (row.pontua_garbo_usuario_id as string | null)?.trim();
        if (!usuarioId) continue;
        usuarioToLead.set(usuarioId, row.id as number);
        map.set(row.id as number, {
          usuarioId,
          aberto: 0,
          fechado: 0,
          porMes: {},
          primeiroMes: null,
        });
      }
      if (usuarioToLead.size === 0) return map;

      const { data: defs, error: defsErr } = await db
        .from(defsTable)
        .select('id, nome, tipo, ativo, config_pontua_garbo')
        .eq('tipo', 'usuario_sistema');
      if (defsErr) throw defsErr;

      const activeDefs = ((defs ?? []) as LeadCustomFieldDefinition[]).filter((d) =>
        isPontuaGarboFieldActive(d),
      );
      if (activeDefs.length === 0) return map;

      const { data: vals, error: valsErr } = await db
        .from(valsTable)
        .select('lead_id, valor')
        .in(
          'field_id',
          activeDefs.map((d) => d.id),
        )
        .not('valor', 'is', null);
      if (valsErr) throw valsErr;

      const indicatedByUser = new Map<string, number[]>();
      for (const val of vals ?? []) {
        const usuarioId = (val.valor as string | null)?.trim();
        if (!usuarioId || !usuarioToLead.has(usuarioId)) continue;
        const list = indicatedByUser.get(usuarioId) ?? [];
        list.push(val.lead_id as number);
        indicatedByUser.set(usuarioId, list);
      }

      const indicatedIds = [...new Set([...indicatedByUser.values()].flat())];
      if (indicatedIds.length === 0) return map;

      const { data: indicatedLeads, error: indErr } = await db
        .from(leadsTable)
        .select('id, status, data_chegada, venda_realizada_em, criado_em')
        .in('id', indicatedIds);
      if (indErr) throw indErr;

      const indicatedById = new Map<
        number,
        {
          id: number;
          status: string | null;
          data_chegada: string | null;
          venda_realizada_em: string | null;
          criado_em: string | null;
        }
      >();
      for (const lead of indicatedLeads ?? []) {
        indicatedById.set(lead.id as number, {
          id: lead.id as number,
          status: (lead.status as string | null) ?? '',
          data_chegada: (lead.data_chegada as string | null) ?? null,
          venda_realizada_em: (lead.venda_realizada_em as string | null) ?? null,
          criado_em: (lead.criado_em as string | null) ?? null,
        });
      }

      for (const [usuarioId, leadIds] of indicatedByUser) {
        const partnerLeadId = usuarioToLead.get(usuarioId);
        if (partnerLeadId == null) continue;
        const badge = map.get(partnerLeadId);
        if (!badge) continue;
        const leadsDoParceiro = leadIds
          .filter((indicatedId) => indicatedId !== partnerLeadId)
          .map((indicatedId) => indicatedById.get(indicatedId))
          .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));
        const totais = accumulateIndicacoesPorMes(leadsDoParceiro, ganhoStatuses);
        map.set(partnerLeadId, { ...badge, ...totais });
      }

      return map;
        },
      ),
  });
}

export function usePontuaGarboPartnerBadge(leadId: number | null | undefined) {
  const { data: map } = usePontuaGarboPartnerMap();
  if (!leadId || !map) return null;
  return map.get(leadId) ?? null;
}

export interface CadastrarLeadPontuaGarboInput {
  leadId: number;
  nome: string;
  email: string;
  telefone?: string | null;
}

export function useCadastrarLeadComoPontuaGarbo() {
  const queryClient = useQueryClient();
  const { empresa, schemaEmpresa } = useEmpresa();
  const { userRole, isSuperAdmin } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();

  return useMutation({
    mutationFn: async (input: CadastrarLeadPontuaGarboInput) => {
      if (!canManagePontuaGarboFinanceiro(userRole, isSuperAdmin)) {
        throw new Error('Apenas administradores podem cadastrar no Pontua Garbo.');
      }
      if (!empresa?.id || !schemaEmpresa) {
        throw new Error('Selecione a empresa antes de cadastrar o usuário.');
      }

      const parsedEmail = parseLeadEmail(input.email);
      const email = parsedEmail.normalized;
      const telefone = (input.telefone ?? '').replace(/\D/g, '') || undefined;
      const leadsTable = table('leads', PUBLIC_LEADS);
      const usersTable = table('usuarios', PUBLIC_USERS);

      if (email && !isValidLeadEmail(email)) {
        throw new Error(EMAIL_FORMATO_INVALIDO);
      }

      if (email) {
        const { error: emailSaveErr } = await db
          .from(leadsTable)
          .update({ email })
          .eq('id', input.leadId);
        if (emailSaveErr) {
          console.warn('Não foi possível gravar o e-mail no card do lead', emailSaveErr);
        } else {
          patchLeadInAllCaches(queryClient, input.leadId, { email });
        }
      }

      const { data: parceiros, error: parceirosErr } = await db
        .from(usersTable)
        .select('id, nome, email, telefone')
        .eq('tipo_usuario', 'prestador_servico')
        .eq('comissao_ativa', true);
      if (parceirosErr) throw parceirosErr;

      const leadRef: PartnerLeadCandidate = {
        id: input.leadId,
        nome: input.nome,
        email,
        telefone: input.telefone,
      };
      const existente = (parceiros ?? []).find((parceiro) => {
        const emailParceiro = (parceiro.email as string | null)?.trim().toLowerCase() ?? '';
        if (email && emailParceiro && emailParceiro === email) return true;
        return (
          scorePartnerLeadMatch(
            {
              usuarioId: parceiro.id as string,
              nome: (parceiro.nome as string) ?? '',
              email: parceiro.email as string | null,
              telefone: parceiro.telefone as string | null,
            },
            leadRef,
          ) >= MIN_SCORE_VINCULO_PONTUA
        );
      });

      if (existente?.id) {
        await linkLeadToPontuaUsuario(db, leadsTable, input.leadId, existente.id as string);
        return { userId: existente.id as string, senhaEhTelefone: false, unidoExistente: true };
      }

      if (!email || !isValidLeadEmail(email)) {
        throw new Error(`Informe um e-mail válido para criar o acesso. ${EMAIL_FORMATO_INVALIDO}`);
      }

      const { data, error } = await supabase.functions.invoke('create-user-admin', {
        body: {
          nome: input.nome.trim(),
          email,
          telefone,
          role: pickPrimaryRole(['vendedor']),
          roles: ['vendedor'],
          tipo_usuario: 'prestador_servico',
          titulo: PONTUA_GARBO_TITULO_PADRAO,
          comissao_ativa: true,
          empresaId: empresa.id,
          schemaNome: schemaEmpresa,
          leadId: input.leadId,
        },
      });

      const payload = data as {
        success?: boolean;
        error?: string;
        userId?: string;
        message?: string;
      } | null;

      if (payload?.error && payload.success !== true) {
        throw new Error(payload.error);
      }
      if (error) {
        throw new Error(payload?.error || error.message || 'Erro ao criar usuário');
      }
      if (!payload?.userId) {
        throw new Error('Resposta inválida do servidor ao criar o usuário.');
      }

      await linkLeadToPontuaUsuario(db, leadsTable, input.leadId, payload.userId);

      if (telefone && telefone.length >= PASSWORD_MIN_LENGTH) {
        const { data: resetData, error: resetErr } = await supabase.functions.invoke(
          'reset-user-password',
          {
            body: { userId: payload.userId, newPassword: telefone, schemaNome: schemaEmpresa },
          },
        );
        const resetPayload = resetData as { error?: string } | null;
        if (resetErr || resetPayload?.error) {
          console.warn('Senha do Pontua Garbo não foi definida automaticamente', resetErr ?? resetPayload?.error);
        }
      }

      return {
        userId: payload.userId,
        senhaEhTelefone: Boolean(telefone && telefone.length >= PASSWORD_MIN_LENGTH),
        unidoExistente: false,
      };
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['lead-detail', variables.leadId] }),
        queryClient.invalidateQueries({ queryKey: ['lead-single-enriched', variables.leadId] }),
        queryClient.invalidateQueries({ queryKey: pontuaGarboPartnerMapQueryKey(schemaEmpresa) }),
        queryClient.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] }),
        queryClient.invalidateQueries({ queryKey: ['minha-pontua-garbo'] }),
        queryClient.invalidateQueries({ queryKey: ['lead-origins'] }),
      ]);
      toast.success(
        _data.unidoExistente ? 'Card unido ao Pontua Garbo' : 'Lead cadastrado no Pontua Garbo',
        {
          description: _data.unidoExistente
            ? 'Este lead já era um arquiteto cadastrado. O card agora mostra os orçamentos abertos.'
            : _data.senhaEhTelefone
              ? 'Acesso criado. A senha inicial é o telefone (só números).'
              : 'Acesso criado. Defina a senha em Admin se ainda não houver telefone.',
        },
      );
    },
    onError: (error: Error) => {
      toast.error('Não foi possível cadastrar no Pontua Garbo', {
        description: error.message,
      });
    },
  });
}

/** Garante um card de lead quando o admin ativa Pontua Garbo em um usuário já existente. */
export function useEnsurePontuaGarboPartnerLead() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();

  return useMutation({
    mutationFn: async (input: {
      usuarioId: string;
      nome: string;
      email?: string | null;
      telefone?: string | null;
    }) => {
      const leadsTable = table('leads', PUBLIC_LEADS);
      const existingId = await resolveExistingPartnerLead(db, leadsTable, input);
      if (existingId) return existingId;

      const email = input.email?.trim().toLowerCase() || null;
      const { data: created, error } = await db
        .from(leadsTable)
        .insert({
          nome: input.nome.trim(),
          email,
          telefone: (input.telefone ?? '').replace(/\D/g, '') || null,
          origem: PONTUA_GARBO_LEAD_ORIGEM,
          status: PONTUA_GARBO_LEAD_STATUS_INICIAL,
          valor_negocio: 0,
          valor_orcamento: 0,
          data_chegada: new Date().toLocaleDateString('en-CA', {
            timeZone: 'America/Sao_Paulo',
          }),
          pontua_garbo_usuario_id: input.usuarioId,
          observacoes: 'Cadastro automático pelo programa Pontua Garbo.',
        })
        .select('id')
        .single();
      if (error) throw error;
      return created.id as number;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: pontuaGarboPartnerMapQueryKey(schemaEmpresa) });
    },
  });
}
