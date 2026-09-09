import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { supabase } from '@/integrations/supabase/client';
import { resolveLeadLembretesQueryConfig } from '@/lib/empresa-tables';
import { normalizeLembreteTitularIds, userIsTitularDoLembrete } from '@/lib/lead-lembrete-titulares';
import { canViewAllTitularRecords } from '@/lib/titular-access';
import { countPendentesPorLead } from '@/lib/lead-lembretes-group';
import { toast } from 'sonner';
import {
  deleteAgendaItemAnexosFromStorage,
  parseAgendaItemAnexos,
  type AgendaItemAnexo,
} from '@/lib/agenda-item-anexos';

export interface LeadLembreteTitular {
  id: string;
  nome: string;
  avatar_url: string | null;
}

export interface LeadLembrete {
  id: string;
  lead_id: number;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  status: 'pendente' | 'concluido' | 'cancelado';
  /** Titular principal (primeiro de titular_ids) — mantido para compatibilidade. */
  titular_id: string;
  /** Titulares do lembrete. Titulares veem; admin/super admin veem todos. */
  titular_ids: string[];
  criado_por: string;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
  /** Cor hex (#rrggbb) no calendário; null = cor padrão de lead. */
  cor: string | null;
  anexos: AgendaItemAnexo[];
  lead?: {
    id: number;
    nome: string;
    telefone: string | null;
  } | null;
  /** Primeiro titular (compatibilidade de UI). */
  titular?: LeadLembreteTitular | null;
  titulares?: LeadLembreteTitular[];
}

function resolveTitularIds(row: {
  titular_ids?: string[] | null;
  titular_id?: string | null;
}): string[] {
  if (row.titular_ids && row.titular_ids.length > 0) return row.titular_ids;
  if (row.titular_id) return [row.titular_id];
  return [];
}

/** Um canal Realtime por schema — vários hooks compartilham a mesma inscrição. */
const lembretesRealtimeBySchema = new Map<
  string,
  { count: number; channel: RealtimeChannel }
>();

function useLeadLembretesRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { schemaEmpresa } = useEmpresa();
  const lembretesConfig = resolveLeadLembretesQueryConfig(schemaEmpresa);

  useEffect(() => {
    if (!user) return;
    const realtimeSchema = lembretesConfig.schema ?? 'public';
    let entry = lembretesRealtimeBySchema.get(realtimeSchema);
    if (!entry) {
      const channel = supabase
        .channel(`lead-lembretes-${realtimeSchema}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: realtimeSchema,
            table: lembretesConfig.lembretesTable,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['lead-lembretes'] });
          },
        )
        .subscribe();
      entry = { count: 0, channel };
      lembretesRealtimeBySchema.set(realtimeSchema, entry);
    }
    entry.count += 1;
    return () => {
      const current = lembretesRealtimeBySchema.get(realtimeSchema);
      if (!current) return;
      current.count -= 1;
      if (current.count <= 0) {
        supabase.removeChannel(current.channel);
        lembretesRealtimeBySchema.delete(realtimeSchema);
      }
    };
  }, [user, queryClient, lembretesConfig.schema, lembretesConfig.lembretesTable]);
}

export function useLeadLembretes(
  leadId?: number,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const { user, userRole, isSuperAdmin } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const lembretesConfig = resolveLeadLembretesQueryConfig(schemaEmpresa);
  const canViewAll = canViewAllTitularRecords(userRole, isSuperAdmin);
  const fetchEnabled = options?.enabled !== false;

  const lembretesQueryKey = [
    'lead-lembretes',
    schemaEmpresa ?? 'master',
    leadId ?? 'all',
    canViewAll ? 'admin-all' : user?.id ?? 'anon',
  ] as const;

  const { data: lembretes = [], isLoading } = useQuery({
    queryKey: lembretesQueryKey,
    queryFn: async () => {
      let query = db
        .from(lembretesConfig.lembretesTable)
        .select('*')
        .order('data_hora', { ascending: true });

      if (leadId) query = query.eq('lead_id', leadId);
      // Titulares: só os próprios. Admin/super admin: todos (RLS + sem filtro de titular).
      if (user?.id && !canViewAll) {
        query = query.contains('titular_ids', [user.id]);
      }

      const { data: lembretesBase, error } = await query;
      if (error) throw error;

      const lembretes = (lembretesBase || []) as unknown as LeadLembrete[];
      if (lembretes.length === 0) return [];

      const leadIds = [...new Set(lembretes.map((l) => l.lead_id).filter(Boolean))];
      const titularIds = [
        ...new Set(
          lembretes.flatMap((l) => resolveTitularIds(l)).filter(Boolean),
        ),
      ];

      const [leadsResult, titularesResult, agendaTitularesResult] = await Promise.all([
        leadIds.length > 0
          ? db
              .from(lembretesConfig.leadsTable)
              .select('id, nome, telefone')
              .in('id', leadIds as number[])
          : Promise.resolve({ data: [], error: null } as const),
        titularIds.length > 0
          ? db
              .from(lembretesConfig.usuariosTable)
              .select('id, nome, avatar_url')
              .in('id', titularIds as string[])
          : Promise.resolve({ data: [], error: null } as const),
        titularIds.length > 0
          ? supabase.rpc('movelaria_listar_titulares_agenda')
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (leadsResult.error) {
        console.warn('Leads dos lembretes:', leadsResult.error.message);
      }
      if (titularesResult.error) {
        console.warn('Titulares CRM dos lembretes:', titularesResult.error.message);
      }
      if (agendaTitularesResult.error) {
        console.warn('Titulares da agenda (Casa):', agendaTitularesResult.error.message);
      }

      const leadsById = new Map<number, { id: number; nome: string; telefone: string | null }>();
      for (const lead of (leadsResult.data || []) as {
        id: number;
        nome: string;
        telefone: string | null;
      }[]) {
        leadsById.set(lead.id, lead);
      }

      const titularesById = new Map<string, LeadLembreteTitular>();
      for (const titular of (titularesResult.data || []) as LeadLembreteTitular[]) {
        titularesById.set(titular.id, titular);
      }
      for (const row of (agendaTitularesResult.data || []) as {
        id: string;
        nome: string | null;
        avatar_url?: string | null;
      }[]) {
        if (!row?.id || titularesById.has(row.id)) continue;
        titularesById.set(row.id, {
          id: row.id,
          nome: row.nome?.trim() || 'Usuário',
          avatar_url: row.avatar_url ?? null,
        });
      }

      return lembretes
        .map((lembrete) => {
          const ids = resolveTitularIds(lembrete);
          const titulares = ids.map(
            (id) =>
              titularesById.get(id) ?? {
                id,
                nome: 'Usuário',
                avatar_url: null,
              },
          );
          return {
            ...lembrete,
            titular_ids: ids,
            titular_id: lembrete.titular_id || ids[0] || '',
            cor: lembrete.cor ?? null,
            anexos: parseAgendaItemAnexos((lembrete as { anexos?: unknown }).anexos),
            lead: leadsById.get(lembrete.lead_id) ?? null,
            titular: titulares[0] ?? titularesById.get(lembrete.titular_id) ?? null,
            titulares,
          };
        })
        .filter(
          (l) =>
            canViewAll || userIsTitularDoLembrete(l.titular_ids, l.titular_id, user?.id),
        );
    },
    enabled: fetchEnabled && !!user && queriesReady,
  });

  // Só a busca "todos" assina Realtime — popover por lead não abre canal extra.
  useEffect(() => {
    if (!user || leadId != null) return;
    const realtimeSchema = lembretesConfig.schema ?? 'public';
    let entry = lembretesRealtimeBySchema.get(realtimeSchema);
    if (!entry) {
      const channel = supabase
        .channel(`lead-lembretes-${realtimeSchema}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: realtimeSchema,
            table: lembretesConfig.lembretesTable,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['lead-lembretes'] });
          },
        )
        .subscribe();
      entry = { count: 0, channel };
      lembretesRealtimeBySchema.set(realtimeSchema, entry);
    }
    entry.count += 1;
    return () => {
      const current = lembretesRealtimeBySchema.get(realtimeSchema);
      if (!current) return;
      current.count -= 1;
      if (current.count <= 0) {
        supabase.removeChannel(current.channel);
        lembretesRealtimeBySchema.delete(realtimeSchema);
      }
    };
  }, [
    user,
    leadId,
    queryClient,
    lembretesConfig.schema,
    lembretesConfig.lembretesTable,
  ]);

  const createLembrete = useMutation({
    mutationFn: async (input: {
      id?: string;
      lead_id: number;
      titulo: string;
      descricao?: string;
      data_hora: string;
      titular_ids?: string[];
      anexos?: AgendaItemAnexo[];
      cor?: string | null;
      /** @deprecated use titular_ids */
      titular_id?: string;
    }) => {
      if (!user) throw new Error('Não autenticado');
      const titular_ids = normalizeLembreteTitularIds(
        input.titular_ids?.length
          ? input.titular_ids
          : input.titular_id
            ? [input.titular_id]
            : [user.id],
        user.id,
      );
      const payload: Record<string, unknown> = {
        lead_id: input.lead_id,
        titulo: input.titulo,
        descricao: input.descricao || null,
        data_hora: input.data_hora,
        titular_id: titular_ids[0],
        titular_ids,
        criado_por: user.id,
        status: 'pendente',
        cor: input.cor ?? null,
        anexos: input.anexos ?? [],
      };
      if (input.id) payload.id = input.id;
      const { data, error } = await db
        .from(lembretesConfig.lembretesTable)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lembretes'] });
      toast.success('Lembrete criado');
    },
    onError: (e: Error) => toast.error('Erro ao criar lembrete', { description: e.message }),
  });

  const updateLembrete = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<
        Pick<
          LeadLembrete,
          | 'titulo'
          | 'descricao'
          | 'data_hora'
          | 'status'
          | 'titular_id'
          | 'titular_ids'
          | 'concluido_em'
          | 'anexos'
          | 'cor'
        >
      >;
    }) => {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.titular_ids) {
        const ids = [...new Set(updates.titular_ids.filter(Boolean))];
        if (ids.length === 0) throw new Error('Informe ao menos um titular');
        payload.titular_ids = ids;
        payload.titular_id = ids[0];
      } else if (updates.titular_id) {
        payload.titular_ids = [updates.titular_id];
      }
      const { error } = await db.from(lembretesConfig.lembretesTable).update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lembretes'] });
      toast.success('Lembrete atualizado');
    },
    onError: (e: Error) => toast.error('Erro ao atualizar', { description: e.message }),
  });

  const completeLembrete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(lembretesConfig.lembretesTable)
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lembretes'] });
      toast.success('Lembrete concluído');
    },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const deleteLembrete = useMutation({
    mutationFn: async (id: string) => {
      const { data: row } = await db
        .from(lembretesConfig.lembretesTable)
        .select('anexos')
        .eq('id', id)
        .maybeSingle();
      await deleteAgendaItemAnexosFromStorage(parseAgendaItemAnexos(row?.anexos));
      const { error } = await db.from(lembretesConfig.lembretesTable).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-lembretes'] });
      toast.success('Lembrete excluído');
    },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  return {
    lembretes,
    isLoading,
    createLembrete,
    updateLembrete,
    completeLembrete,
    deleteLembrete,
  };
}

/** Indica se um lembrete está atrasado (passou do horário e ainda pendente) */
export function isLembreteAtrasado(l: LeadLembrete): boolean {
  return l.status === 'pendente' && new Date(l.data_hora).getTime() < Date.now();
}

/**
 * Hook leve para mapear quantos lembretes ATIVOS (pendentes) cada lead tem.
 * Titular: só os próprios. Admin/super admin: todos.
 */
export function useLeadLembretesCountMap(): Map<number, number> {
  const { user, userRole, isSuperAdmin } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const lembretesConfig = resolveLeadLembretesQueryConfig(schemaEmpresa);
  const canViewAll = canViewAllTitularRecords(userRole, isSuperAdmin);
  useLeadLembretesRealtime();

  const { data: lembretes = [] } = useQuery({
    queryKey: [
      'lead-lembretes',
      schemaEmpresa ?? 'master',
      'all',
      'count',
      canViewAll ? 'admin-all' : user?.id,
    ],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = db
        .from(lembretesConfig.lembretesTable)
        .select('id, lead_id, status, data_hora, titular_ids, titular_id')
        .eq('status', 'pendente');

      if (!canViewAll) {
        query = query.contains('titular_ids', [user.id]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as Pick<
        LeadLembrete,
        'id' | 'lead_id' | 'status' | 'data_hora' | 'titular_ids' | 'titular_id'
      >[];
    },
    enabled: !!user && queriesReady,
    staleTime: 30_000,
  });

  return countPendentesPorLead(lembretes, {
    canViewAll,
    userId: user?.id,
  });
}
