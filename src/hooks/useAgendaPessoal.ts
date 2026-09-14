import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { canAssignTitularToOthers, canViewAllTitularRecords } from '@/lib/titular-access';
import { getEventosDb, resolveEventosTables } from '@/lib/evento-db';
import { toast } from 'sonner';
import {
  deleteAgendaItemAnexosFromStorage,
  parseAgendaItemAnexos,
  type AgendaItemAnexo,
} from '@/lib/agenda-item-anexos';

export interface TarefaPessoal {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora: string | null;
  concluida: boolean;
  tipo_agendamento: string; // 'unica' | 'recorrente'
  titular_id: string;
  titular_nome: string | null;
  /** Quem criou a tarefa (admin ou vendedor pode atribuir a outro titular). */
  criado_por: string | null;
  recorrencia_tipo: string | null; // 'todo_dia' | 'dias_semana' | 'mensal'
  recorrencia_dias_semana: number[] | null;
  data_fim_recorrencia: string | null;
  exclusoes_ocorrencias: string[] | null;
  conclusoes_ocorrencias: string[] | null;
  /** Quando true, só o titular/criador vê; outros admins não veem na agenda pessoal nem na agenda geral. */
  ocultar_de_outros_admins: boolean;
  /** Cor hex (#rrggbb) no calendário; null = cor padrão do tipo pessoal. */
  cor: string | null;
  /** Pasta de Controle de Eventos (se a tarefa veio de lá). */
  evento_id: string | null;
  /** Checklist do evento espelhado nesta tarefa. */
  evento_tarefa_id: string | null;
  criado_em: string;
  atualizado_em: string;
  anexos: AgendaItemAnexo[];
}

/** Preferência persistida no banco para administradores verem tarefas por titularidade. */
export type AgendaPessoalAdminTitularFilterMode = 'all' | 'self' | 'provider';

export interface AgendaPessoalAdminTitularFilter {
  filter_mode: AgendaPessoalAdminTitularFilterMode;
  /** Obrigatório quando filter_mode === 'provider' */
  filter_titular_id: string | null;
}

export function useAgendaPessoal() {
  const { user, userRole, userRoles, isSuperAdmin } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const isAdmin = canViewAllTitularRecords(userRole, isSuperAdmin);
  const canAssignToOthers = canAssignTitularToOthers(userRole, isSuperAdmin, userRoles);
  const eventoSchema = empresa?.schema_nome ?? null;
  const eventoTables = resolveEventosTables(eventoSchema);
  const eventoDb = getEventosDb(eventoSchema);

  const syncEventoTarefaConcluida = async (eventoTarefaId: string | null | undefined, concluida: boolean) => {
    if (!eventoTarefaId) return;
    const { error } = await eventoDb
      .from(eventoTables.tarefas)
      .update({ concluida, atualizado_em: new Date().toISOString() })
      .eq('id', eventoTarefaId);
    if (error) {
      console.warn('Não deu para espelhar conclusão no Controle de Eventos:', error.message);
    }
  };

  const syncEventoTarefaExcluir = async (eventoTarefaId: string | null | undefined) => {
    if (!eventoTarefaId) return;
    const { error } = await eventoDb.from(eventoTables.tarefas).delete().eq('id', eventoTarefaId);
    if (error) {
      console.warn('Não deu para remover a tarefa no Controle de Eventos:', error.message);
    }
  };

  const {
    data: adminTitularPref,
    isFetched: adminTitularPrefFetched,
    isLoading: isLoadingAdminTitularPref,
  } = useQuery({
    queryKey: ['agenda-pessoal-admin-titular-filter', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('crm_multiempresas_agenda_pessoal_admin_titular_filter')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar filtro de titularidade (agenda pessoal):', error);
        throw error;
      }
      return data as {
        user_id: string;
        filter_mode: AgendaPessoalAdminTitularFilterMode;
        filter_titular_id: string | null;
        updated_at: string;
      } | null;
    },
    enabled: !!user?.id && isAdmin,
  });

  const titularQueryKey = useMemo(() => {
    if (!user?.id) return 'no-user';
    if (!isAdmin) return 'non-admin';
    if (!adminTitularPrefFetched) return 'pending';
    if (!adminTitularPref) return 'all';
    if (adminTitularPref.filter_mode === 'provider' && adminTitularPref.filter_titular_id) {
      return `provider:${adminTitularPref.filter_titular_id}`;
    }
    if (adminTitularPref.filter_mode === 'self') return `self:${user.id}`;
    return 'all';
  }, [user?.id, isAdmin, adminTitularPrefFetched, adminTitularPref]);

  const tasksQueryEnabled = !!user?.id && titularQueryKey !== 'pending';

  const { data: tarefas = [], isLoading: isLoadingTarefas } = useQuery({
    queryKey: ['agenda-pessoal', user?.id, titularQueryKey],
    queryFn: async () => {
      if (!user?.id) return [];

      let q = supabase.from('crm_multiempresas_agenda_pessoal_tarefas').select('*').order('data', { ascending: true });

      if (!isAdmin) {
        // Próprias + as que o vendedor criou para outra pessoa.
        q = q.or(`titular_id.eq.${user.id},criado_por.eq.${user.id}`);
      } else if (adminTitularPrefFetched) {
        if (adminTitularPref?.filter_mode === 'self') {
          q = q.eq('titular_id', user.id);
        } else if (
          adminTitularPref?.filter_mode === 'provider' &&
          adminTitularPref.filter_titular_id
        ) {
          q = q.eq('titular_id', adminTitularPref.filter_titular_id);
        }
      }

      const { data, error } = await q;

      if (error) {
        console.error('Erro ao buscar tarefas pessoais:', error);
        return [];
      }
      return ((data || []) as unknown as TarefaPessoal[]).map((tarefa) => ({
        ...tarefa,
        cor: tarefa.cor ?? null,
        evento_id: tarefa.evento_id ?? null,
        evento_tarefa_id: tarefa.evento_tarefa_id ?? null,
        anexos: parseAgendaItemAnexos((tarefa as { anexos?: unknown }).anexos),
      }));
    },
    enabled: tasksQueryEnabled,
  });

  const saveAdminTitularFilter = useMutation({
    mutationFn: async (next: AgendaPessoalAdminTitularFilter) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (!isAdmin) throw new Error('Apenas administradores podem salvar este filtro');

      const filter_titular_id = next.filter_mode === 'provider' ? next.filter_titular_id : null;
      if (next.filter_mode === 'provider' && !filter_titular_id) {
        throw new Error('Selecione o prestador titular');
      }

      const { error } = await supabase.from('crm_multiempresas_agenda_pessoal_admin_titular_filter').upsert(
        {
          user_id: user.id,
          filter_mode: next.filter_mode,
          filter_titular_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal-admin-titular-filter', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal'] });
    },
    onError: (error) => {
      console.error('Erro ao salvar filtro de titularidade:', error);
      toast.error('Erro ao salvar preferência do filtro');
    },
  });

  const createTarefa = useMutation({
    mutationFn: async (tarefa: {
      id?: string;
      titulo: string;
      descricao?: string;
      data: string;
      hora?: string;
      tipo_agendamento: string;
      titular_id: string;
      titular_nome?: string;
      recorrencia_tipo?: string;
      recorrencia_dias_semana?: number[];
      data_fim_recorrencia?: string;
      ocultar_de_outros_admins?: boolean;
      cor?: string | null;
      anexos?: AgendaItemAnexo[];
      evento_id?: string | null;
      evento_tarefa_id?: string | null;
      concluida?: boolean;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      // Admin e vendedor podem atribuir a outro titular (espelha a política RLS).
      if (!canAssignToOthers && tarefa.titular_id !== user.id) {
        throw new Error('Você só pode criar tarefas para si mesmo');
      }
      const { data, error } = await supabase
        .from('crm_multiempresas_agenda_pessoal_tarefas')
        .insert([
          {
            ...(tarefa.id ? { id: tarefa.id } : {}),
            titulo: tarefa.titulo,
            descricao: tarefa.descricao || null,
            data: tarefa.data,
            hora: tarefa.hora || null,
            tipo_agendamento: tarefa.tipo_agendamento,
            titular_id: tarefa.titular_id,
            titular_nome: tarefa.titular_nome || null,
            criado_por: user.id,
            recorrencia_tipo: tarefa.recorrencia_tipo || null,
            recorrencia_dias_semana: tarefa.recorrencia_dias_semana || [],
            data_fim_recorrencia: tarefa.data_fim_recorrencia || null,
            ocultar_de_outros_admins: tarefa.ocultar_de_outros_admins ?? false,
            cor: tarefa.cor ?? null,
            anexos: tarefa.anexos ?? [],
            evento_id: tarefa.evento_id ?? null,
            evento_tarefa_id: tarefa.evento_tarefa_id ?? null,
            concluida: tarefa.concluida ?? false,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, tarefa) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal'] });
      toast.success(
        tarefa.titular_id === user?.id || !tarefa.titular_nome
          ? 'Tarefa criada!'
          : `Tarefa criada para ${tarefa.titular_nome}!`,
      );
    },
    onError: (error) => {
      console.error('Erro ao criar tarefa:', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar tarefa';
      toast.error('Erro ao criar tarefa', { description: message });
    },
  });

  const updateTarefa = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TarefaPessoal> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_agenda_pessoal_tarefas')
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const row = data as TarefaPessoal;
      if (typeof updates.concluida === 'boolean') {
        await syncEventoTarefaConcluida(row.evento_tarefa_id, updates.concluida);
      }
      if (typeof updates.titulo === 'string' && row.evento_tarefa_id) {
        const { error: eventoTituloError } = await eventoDb
          .from(eventoTables.tarefas)
          .update({ titulo: updates.titulo, atualizado_em: new Date().toISOString() })
          .eq('id', row.evento_tarefa_id);
        if (eventoTituloError) {
          console.warn('Não deu para espelhar o título no Controle de Eventos:', eventoTituloError.message);
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal'] });
      queryClient.invalidateQueries({ queryKey: ['evento-tarefas'] });
      queryClient.invalidateQueries({ queryKey: ['controle-eventos'] });
      queryClient.invalidateQueries({ queryKey: ['evento-board'] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar tarefa:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });

  const deleteTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { data: row } = await supabase
        .from('crm_multiempresas_agenda_pessoal_tarefas')
        .select('anexos, evento_tarefa_id')
        .eq('id', id)
        .maybeSingle();
      await deleteAgendaItemAnexosFromStorage(parseAgendaItemAnexos(row?.anexos));
      const { error } = await supabase.from('crm_multiempresas_agenda_pessoal_tarefas').delete().eq('id', id);

      if (error) throw error;
      await syncEventoTarefaExcluir(
        typeof row?.evento_tarefa_id === 'string' ? row.evento_tarefa_id : null,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal'] });
      queryClient.invalidateQueries({ queryKey: ['evento-tarefas'] });
      queryClient.invalidateQueries({ queryKey: ['controle-eventos'] });
      queryClient.invalidateQueries({ queryKey: ['evento-board'] });
      toast.success('Tarefa removida!');
    },
    onError: (error) => {
      console.error('Erro ao remover tarefa:', error);
      toast.error('Erro ao remover tarefa');
    },
  });

  /** Conclude a single occurrence (recurrent) or the whole task (unique) */
  const concluirOcorrencia = useMutation({
    mutationFn: async ({
      tarefa,
      dataOcorrencia,
      concluida,
    }: {
      tarefa: TarefaPessoal;
      dataOcorrencia: string; // 'yyyy-MM-dd'
      concluida: boolean;
    }) => {
      if (tarefa.tipo_agendamento === 'unica') {
        const { error } = await supabase
          .from('crm_multiempresas_agenda_pessoal_tarefas')
          .update({ concluida, atualizado_em: new Date().toISOString() })
          .eq('id', tarefa.id);
        if (error) throw error;
        await syncEventoTarefaConcluida(tarefa.evento_tarefa_id, concluida);
      } else {
        const conclusoes = [...((tarefa.conclusoes_ocorrencias as string[]) || [])];
        if (concluida && !conclusoes.includes(dataOcorrencia)) {
          conclusoes.push(dataOcorrencia);
        } else if (!concluida) {
          const idx = conclusoes.indexOf(dataOcorrencia);
          if (idx >= 0) conclusoes.splice(idx, 1);
        }
        const { error } = await supabase
          .from('crm_multiempresas_agenda_pessoal_tarefas')
          .update({
            conclusoes_ocorrencias: conclusoes,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', tarefa.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal'] });
      queryClient.invalidateQueries({ queryKey: ['evento-tarefas'] });
      queryClient.invalidateQueries({ queryKey: ['controle-eventos'] });
      queryClient.invalidateQueries({ queryKey: ['evento-board'] });
    },
    onError: (error) => {
      console.error('Erro ao concluir ocorrência:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });

  /** Move uma ocorrência para outra data (única: atualiza data; recorrente: exclui ocorrência e cria tarefa avulsa) */
  const reagendarOcorrencia = useMutation({
    mutationFn: async ({
      tarefa,
      dataOcorrenciaAntiga,
      novaData,
      updates,
    }: {
      tarefa: TarefaPessoal;
      dataOcorrenciaAntiga: string;
      novaData: string;
      updates?: Partial<Pick<TarefaPessoal, 'titulo' | 'descricao' | 'hora' | 'cor'>>;
    }) => {
      const wasConcluida =
        tarefa.tipo_agendamento === 'unica'
          ? tarefa.concluida
          : ((tarefa.conclusoes_ocorrencias as string[]) || []).includes(dataOcorrenciaAntiga);

      if (tarefa.tipo_agendamento === 'unica') {
        const { error } = await supabase
          .from('crm_multiempresas_agenda_pessoal_tarefas')
          .update({
            data: novaData,
            titulo: updates?.titulo ?? tarefa.titulo,
            descricao: updates?.descricao !== undefined ? updates.descricao : tarefa.descricao,
            hora: updates?.hora !== undefined ? updates.hora : tarefa.hora,
            cor: updates?.cor !== undefined ? updates.cor : tarefa.cor,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', tarefa.id);
        if (error) throw error;
        return;
      }

      const exclusoes = [...((tarefa.exclusoes_ocorrencias as string[]) || [])];
      if (!exclusoes.includes(dataOcorrenciaAntiga)) {
        exclusoes.push(dataOcorrenciaAntiga);
      }
      const { error: exclError } = await supabase
        .from('crm_multiempresas_agenda_pessoal_tarefas')
        .update({
          exclusoes_ocorrencias: exclusoes,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', tarefa.id);
      if (exclError) throw exclError;

      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error: createError } = await supabase
        .from('crm_multiempresas_agenda_pessoal_tarefas')
        .insert([
          {
            titulo: updates?.titulo ?? tarefa.titulo,
            descricao: updates?.descricao !== undefined ? updates.descricao : tarefa.descricao,
            data: novaData,
            hora: updates?.hora !== undefined ? updates.hora : tarefa.hora,
            cor: updates?.cor !== undefined ? updates.cor : tarefa.cor,
            tipo_agendamento: 'unica',
            titular_id: tarefa.titular_id,
            titular_nome: tarefa.titular_nome,
            criado_por: user.id,
            concluida: wasConcluida,
            ocultar_de_outros_admins: tarefa.ocultar_de_outros_admins,
          },
        ]);
      if (createError) throw createError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal'] });
      toast.success('Data da tarefa atualizada!');
    },
    onError: (error) => {
      console.error('Erro ao reagendar ocorrência:', error);
      toast.error('Erro ao atualizar data da tarefa');
    },
  });

  /** Exclude a single occurrence from a recurring task */
  const excluirOcorrencia = useMutation({
    mutationFn: async ({
      tarefa,
      dataOcorrencia,
    }: {
      tarefa: TarefaPessoal;
      dataOcorrencia: string; // 'yyyy-MM-dd'
    }) => {
      const exclusoes = [...((tarefa.exclusoes_ocorrencias as string[]) || [])];
      if (!exclusoes.includes(dataOcorrencia)) {
        exclusoes.push(dataOcorrencia);
      }
      const { error } = await supabase
        .from('crm_multiempresas_agenda_pessoal_tarefas')
        .update({
          exclusoes_ocorrencias: exclusoes,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-pessoal'] });
      toast.success('Ocorrência removida!');
    },
    onError: (error) => {
      console.error('Erro ao excluir ocorrência:', error);
      toast.error('Erro ao excluir ocorrência');
    },
  });

  const adminTitularFilterResolved: AgendaPessoalAdminTitularFilter | null = useMemo(() => {
    if (!isAdmin || !adminTitularPrefFetched) return null;
    if (!adminTitularPref) return { filter_mode: 'all', filter_titular_id: null };
    return {
      filter_mode: adminTitularPref.filter_mode,
      filter_titular_id: adminTitularPref.filter_titular_id,
    };
  }, [isAdmin, adminTitularPrefFetched, adminTitularPref]);

  const loading =
    isLoadingTarefas ||
    (isAdmin && (!adminTitularPrefFetched || isLoadingAdminTitularPref));

  return {
    tarefas,
    loading,
    isAdminAgendaPessoal: isAdmin,
    canAssignTarefaToOthers: canAssignToOthers,
    adminTitularFilter: adminTitularFilterResolved,
    isAdminTitularFilterReady: !isAdmin || adminTitularPrefFetched,
    saveAdminTitularFilter,
    createTarefa,
    updateTarefa,
    deleteTarefa,
    concluirOcorrencia,
    reagendarOcorrencia,
    excluirOcorrencia,
  };
}
