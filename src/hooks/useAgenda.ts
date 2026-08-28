import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { resolveAgendaPublicScope, fetchPublicAgendaConfig, getAgendaPublicClient } from '@/lib/agenda-public-scope';
import { createAgendaPublicBooking } from '@/lib/agenda-public-api';
import { invokeOptionalEdgeFunction } from '@/lib/invoke-optional-edge-function';
import { toast } from 'sonner';

// ============================================
// TIPOS DO SISTEMA DE AGENDA
// ============================================

export interface BloqueioRecorrente {
  dia_semana: number; // 0 = domingo, 1 = segunda, etc
  hora_inicio: string; // "15:00"
  hora_fim: string; // "15:30"
}

export interface AgendaConfig {
  id: string;
  nome_agenda: string;
  slug: string;
  duracao_minutos: number;
  intervalo_minutos: number;
  antecedencia_minima_horas: number;
  antecedencia_maxima_dias: number;
  horario_inicio: string;
  horario_fim: string;
  dias_disponiveis: number[];
  pergunta_personalizada: string | null;
  link_video_conferencia: string | null;
  ativo: boolean;
  formulario_ativo?: boolean;
  texto_pagina_agendamento?: string | null;
  banner_desktop_url?: string | null;
  banner_mobile_url?: string | null;
  criado_em: string;
  atualizado_em: string;
  // Campos de captura de metadados
  capturar_dispositivo?: boolean;
  capturar_hora_marcacao?: boolean;
  capturar_localizacao?: boolean;
  // Bloqueios recorrentes
  bloqueios_recorrentes?: BloqueioRecorrente[];
  // Webhook de lembrete
  webhook_lembrete_id?: string | null;
  minutos_antecedencia_lembrete?: number;
  // Webhook de conclusão
  webhook_concluido_id?: string | null;
  // Webhook: Relatório de reuniões (aula experimental)
  webhook_relatorio_reunioes_id?: string | null;
  // Templates de disparo
  template_lembrete_id?: number | null;
  template_confirmacao_id?: number | null;
  // Integração com pipeline de leads
  criar_lead_automatico?: boolean;
  lead_status_destino?: string | null;
  lead_origem?: string | null;
}

export interface AgendaBloqueio {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  recorrente: boolean;
  tipo_recorrencia: string | null;
  criado_em: string;
  criado_por: string | null;
}

export interface MetadataCapturada {
  dispositivo?: {
    userAgent: string;
    plataforma: string;
    idioma: string;
    tela?: string;
  };
  hora_marcacao?: string;
  localizacao?: {
    latitude?: number;
    longitude?: number;
    erro?: string;
  };
}

export interface AgendaReuniao {
  id: string;
  titulo: string;
  descricao: string | null;
  data_hora_inicio: string;
  data_hora_fim: string;
  duracao_minutos: number;
  convidado_nome: string | null;
  convidado_whatsapp: string | null;
  convidado_email: string | null;
  resposta_formulario: string | null;
  status: 'pendente' | 'confirmado' | 'concluido' | 'cancelado';
  tipo: 'interno' | 'publico';
  link_video_conferencia: string | null;
  observacoes: string | null;
  responsavel_id: string | null;
  /** NULL/[] = todos os titulares; caso contrário, IDs designados. */
  titular_ids?: string[] | null;
  lead_id: number | null;
  criado_em: string;
  atualizado_em: string;
  confirmado_em: string | null;
  concluido_em: string | null;
  cancelado_em: string | null;
  metadata_capturada?: MetadataCapturada | null;
  lembrete_enviado_em?: string | null;
  confirmacao_enviada_em?: string | null;
}

/** Colunas persistidas em agenda_config (evita enviar campos só da UI). */
const AGENDA_CONFIG_DB_FIELDS = new Set<string>([
  'nome_agenda',
  'slug',
  'duracao_minutos',
  'intervalo_minutos',
  'antecedencia_minima_horas',
  'antecedencia_maxima_dias',
  'horario_inicio',
  'horario_fim',
  'dias_disponiveis',
  'pergunta_personalizada',
  'link_video_conferencia',
  'ativo',
  'bloqueios_recorrentes',
  'webhook_lembrete_id',
  'minutos_antecedencia_lembrete',
  'webhook_concluido_id',
  'webhook_relatorio_reunioes_id',
  'webhook_cancelamento_id',
  'template_lembrete_id',
  'template_confirmacao_id',
  'formulario_ativo',
  'texto_pagina_agendamento',
  'banner_desktop_url',
  'banner_mobile_url',
  'criar_lead_automatico',
  'lead_status_destino',
  'lead_origem',
  'capturar_dispositivo',
  'capturar_hora_marcacao',
  'capturar_localizacao',
]);

function pickAgendaConfigDbUpdates(updates: Partial<AgendaConfig>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(updates).filter(([key]) => AGENDA_CONFIG_DB_FIELDS.has(key)),
  );
}

// ============================================
// HOOK PRINCIPAL - useAgenda
// ============================================

export function useAgenda() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { schemaEmpresa } = useEmpresa();
  const agendaConfigTable = table('agenda_config', 'CRM-multi-empresas>agenda_config<');
  const agendaReunioesTable = table('agenda_reunioes', 'CRM-multi-empresas>agenda_reunioes<');
  const agendaBloqueiosTable = table('agenda_bloqueios', 'CRM-multi-empresas>agenda_bloqueios<');

  // Buscar configuração da agenda
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['agenda-config', schemaEmpresa],
    queryFn: async () => {
      const { data, error } = await db
        .from(agendaConfigTable)
        .select('*')
        .eq('ativo', true)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error('Erro ao buscar config da agenda:', error);
        return null;
      }
      // Parse bloqueios_recorrentes from JSON
      return {
        ...data,
        bloqueios_recorrentes: Array.isArray(data.bloqueios_recorrentes) 
          ? (data.bloqueios_recorrentes as unknown as BloqueioRecorrente[]) 
          : [],
      } as AgendaConfig;
    },
  });

  // Buscar todas as reuniões
  const { data: reunioes = [], isLoading: loadingReunioes } = useQuery({
    queryKey: ['agenda-reunioes', schemaEmpresa],
    queryFn: async () => {
      const { data, error } = await db
        .from(agendaReunioesTable)
        .select('*')
        .order('data_hora_inicio', { ascending: true });

      if (error) {
        console.error('Erro ao buscar reuniões:', error);
        return [];
      }
      return data as AgendaReuniao[];
    },
  });

  // Buscar bloqueios
  const { data: bloqueios = [], isLoading: loadingBloqueios } = useQuery({
    queryKey: ['agenda-bloqueios', schemaEmpresa],
    queryFn: async () => {
      const { data, error } = await db
        .from(agendaBloqueiosTable)
        .select('*')
        .order('data_inicio', { ascending: true });

      if (error) {
        console.error('Erro ao buscar bloqueios:', error);
        return [];
      }
      return data as AgendaBloqueio[];
    },
  });

  // Criar reunião
  const createReuniao = useMutation({
    mutationFn: async (reuniao: {
      titulo: string;
      data_hora_inicio: string;
      data_hora_fim: string;
      duracao_minutos: number;
      convidado_nome?: string;
      convidado_whatsapp?: string;
      convidado_email?: string;
      resposta_formulario?: string;
      status?: string;
      tipo?: string;
      link_video_conferencia?: string;
      observacoes?: string;
      responsavel_id?: string;
      titular_ids?: string[] | null;
      lead_id?: number;
    }) => {
      const { data, error } = await db
        .from(agendaReunioesTable)
        .insert([reuniao])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-reunioes'] });
      toast.success('Reunião agendada com sucesso!');
      
      // Disparar confirmação automática se tiver telefone
      if (data?.id && data?.convidado_whatsapp) {
        void invokeOptionalEdgeFunction('agenda-disparar-confirmacao', {
          reuniao_id: data.id,
        });
      }
    },
    onError: (error) => {
      console.error('Erro ao criar reunião:', error);
      toast.error('Erro ao agendar reunião');
    },
  });

  // Atualizar reunião
  const updateReuniao = useMutation({
    mutationFn: async ({ id, metadata_capturada, ...updates }: Partial<AgendaReuniao> & { id: string }) => {
      // Prepare update object with proper Json casting
      const updatePayload: Record<string, unknown> = { 
        ...updates, 
        atualizado_em: new Date().toISOString(),
      };
      
      // Add metadata_capturada if provided, cast to Json
      if (metadata_capturada !== undefined) {
        updatePayload.metadata_capturada = metadata_capturada as Json;
      }

      const { data, error } = await db
        .from(agendaReunioesTable)
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-reunioes'] });
      toast.success('Reunião atualizada!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar reunião:', error);
      toast.error('Erro ao atualizar reunião');
    },
  });

  // Deletar reunião
  const deleteReuniao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(agendaReunioesTable)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-reunioes'] });
      toast.success('Reunião removida!');
    },
    onError: (error) => {
      console.error('Erro ao deletar reunião:', error);
      toast.error('Erro ao remover reunião');
    },
  });

  // Criar bloqueio
  const createBloqueio = useMutation({
    mutationFn: async (bloqueio: {
      titulo: string;
      data_inicio: string;
      data_fim: string;
      recorrente?: boolean;
      tipo_recorrencia?: string;
    }) => {
      const { data, error } = await db
        .from(agendaBloqueiosTable)
        .insert([{ ...bloqueio, criado_por: user?.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-bloqueios'] });
      toast.success('Bloqueio criado!');
    },
    onError: (error) => {
      console.error('Erro ao criar bloqueio:', error);
      toast.error('Erro ao criar bloqueio');
    },
  });

  // Deletar bloqueio
  const deleteBloqueio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(agendaBloqueiosTable)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-bloqueios'] });
      toast.success('Bloqueio removido!');
    },
    onError: (error) => {
      console.error('Erro ao deletar bloqueio:', error);
      toast.error('Erro ao remover bloqueio');
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<AgendaConfig>) => {
      if (!config?.id) throw new Error('Config não encontrada');

      const supabaseUpdates = {
        ...pickAgendaConfigDbUpdates(updates),
        atualizado_em: new Date().toISOString(),
      };

      const { data, error } = await db
        .from(agendaConfigTable)
        .update(supabaseUpdates)
        .eq('id', config.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error(
          'Não foi possível salvar: verifique suas permissões ou se a configuração da agenda ainda existe.',
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-config'] });
      toast.success('Configurações atualizadas!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar config:', error);
      const message =
        error instanceof Error ? error.message : 'Erro ao atualizar configurações';
      toast.error(message.includes('permiss') ? message : 'Erro ao atualizar configurações');
    },
  });

  // Utilitários
  const getReunioesDoDia = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return reunioes.filter((r) => {
      const reuniaoDate = new Date(r.data_hora_inicio);
      return reuniaoDate >= startOfDay && reuniaoDate <= endOfDay;
    });
  };

  const getReunioesPendentes = () => {
    const now = new Date();
    return reunioes.filter(
      (r) => r.status === 'pendente' && new Date(r.data_hora_inicio) > now
    );
  };

  const getReunioesHoje = () => {
    return getReunioesDoDia(new Date());
  };

  return {
    // Dados
    config,
    reunioes,
    bloqueios,
    
    // Estados de loading
    loading: loadingConfig || loadingReunioes || loadingBloqueios,
    loadingConfig,
    loadingReunioes,
    loadingBloqueios,

    // Mutações
    createReuniao,
    updateReuniao,
    deleteReuniao,
    createBloqueio,
    deleteBloqueio,
    updateConfig,

    // Utilitários
    getReunioesDoDia,
    getReunioesPendentes,
    getReunioesHoje,
  };
}

// ============================================
// HOOK PARA AGENDAMENTO PÚBLICO
// ============================================

export function useAgendaPublic(agendaSlug: string, empresaSlug?: string) {
  const queryClient = useQueryClient();

  const { data: scope, isLoading: loadingScope } = useQuery({
    queryKey: ['agenda-public-scope', empresaSlug ?? null, agendaSlug],
    queryFn: async () => resolveAgendaPublicScope(agendaSlug, empresaSlug),
    enabled: !!agendaSlug,
  });

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['agenda-config-public', scope?.schema ?? null, scope?.agendaSlug ?? agendaSlug],
    queryFn: async () => {
      if (!scope) return null;
      return fetchPublicAgendaConfig(scope);
    },
    enabled: !!scope,
  });

  const { data: reunioes = [], isLoading: loadingReunioes } = useQuery({
    queryKey: ['agenda-reunioes-public', scope?.schema ?? null],
    queryFn: async () => {
      if (!scope) return [];
      const client = getAgendaPublicClient(scope);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from(scope.reunioesTable)
        .select('data_hora_inicio, data_hora_fim, status')
        .gte('data_hora_inicio', now)
        .in('status', ['pendente', 'confirmado']);

      if (error) {
        console.error('Erro ao buscar reuniões públicas:', error);
        return [];
      }
      return data;
    },
    enabled: !!scope,
  });

  const { data: bloqueios = [], isLoading: loadingBloqueios } = useQuery({
    queryKey: ['agenda-bloqueios-public', scope?.schema ?? null],
    queryFn: async () => {
      if (!scope) return [];
      const client = getAgendaPublicClient(scope);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from(scope.bloqueiosTable)
        .select('data_inicio, data_fim, recorrente, tipo_recorrencia')
        .gte('data_fim', now);

      if (error) {
        console.error('Erro ao buscar bloqueios públicos:', error);
        return [];
      }
      return data;
    },
    enabled: !!scope,
  });

  const createAgendamento = useMutation({
    mutationFn: async (dados: {
      data_hora_inicio: string;
      convidado_nome: string;
      convidado_whatsapp: string;
      convidado_email?: string | null;
      resposta_formulario?: string;
      metadata_capturada?: MetadataCapturada;
    }) => {
      if (!config || !scope) throw new Error('Configuração não encontrada');

      const result = await createAgendaPublicBooking({
        scope: {
          schema: scope.schema,
          configId: config.id,
          agendaSlug: scope.agendaSlug,
        },
        dados: {
          data_hora_inicio: dados.data_hora_inicio,
          convidado_nome: dados.convidado_nome,
          convidado_whatsapp: dados.convidado_whatsapp,
          convidado_email: dados.convidado_email,
          resposta_formulario: dados.resposta_formulario,
          metadata_capturada: dados.metadata_capturada,
        },
      });

      return { id: result.reuniao_id, lead_id: result.lead_id };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-reunioes-public'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-reunioes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('🎉 Ebaaaa, uma reunião foi marcada!', {
        description: data.lead_id
          ? 'Lead criado no pipeline e agendamento confirmado.'
          : 'Você receberá uma confirmação em breve.',
        duration: 5000,
      });
    },
  });

  // Verificar se um horário está disponível
  const isHorarioDisponivel = (dataHora: Date): boolean => {
    if (!config) return false;

    // Verificar se está dentro do horário de funcionamento
    const hora = dataHora.getHours();
    const minutos = dataHora.getMinutes();
    const horaDecimal = hora + minutos / 60;
    
    const [inicioH, inicioM] = config.horario_inicio.split(':').map(Number);
    const [fimH, fimM] = config.horario_fim.split(':').map(Number);
    const inicioDecimal = inicioH + inicioM / 60;
    const fimDecimal = fimH + fimM / 60;

    if (horaDecimal < inicioDecimal || horaDecimal >= fimDecimal) return false;

    // Verificar dia da semana
    const diaSemana = dataHora.getDay();
    if (!config.dias_disponiveis.includes(diaSemana)) return false;

    // Verificar conflitos com reuniões existentes
    const fimReuniao = new Date(dataHora.getTime() + config.duracao_minutos * 60000);
    const hasConflito = reunioes.some((r) => {
      const rInicio = new Date(r.data_hora_inicio);
      const rFim = new Date(r.data_hora_fim);
      return dataHora < rFim && fimReuniao > rInicio;
    });

    if (hasConflito) return false;

    // Verificar bloqueios
    const hasBloqueio = bloqueios.some((b) => {
      const bInicio = new Date(b.data_inicio);
      const bFim = new Date(b.data_fim);
      return dataHora < bFim && fimReuniao > bInicio;
    });

    if (hasBloqueio) return false;

    // Verificar bloqueios recorrentes
    if (config.bloqueios_recorrentes && config.bloqueios_recorrentes.length > 0) {
      const hasBloqueioRecorrente = config.bloqueios_recorrentes.some((bloqueio) => {
        if (bloqueio.dia_semana !== diaSemana) return false;
        
        const [bloqueioInicioH, bloqueioInicioM] = bloqueio.hora_inicio.split(':').map(Number);
        const [bloqueioFimH, bloqueioFimM] = bloqueio.hora_fim.split(':').map(Number);
        
        const bloqueioInicio = new Date(dataHora);
        bloqueioInicio.setHours(bloqueioInicioH, bloqueioInicioM, 0, 0);
        const bloqueioFim = new Date(dataHora);
        bloqueioFim.setHours(bloqueioFimH, bloqueioFimM, 0, 0);
        
        return dataHora < bloqueioFim && fimReuniao > bloqueioInicio;
      });

      if (hasBloqueioRecorrente) return false;
    }

    return true;
  };

  // Gerar slots disponíveis para um dia
  const getSlotsDisponiveis = (date: Date): Date[] => {
    if (!config) return [];

    const slots: Date[] = [];
    const [inicioH, inicioM] = config.horario_inicio.split(':').map(Number);
    const [fimH, fimM] = config.horario_fim.split(':').map(Number);

    const current = new Date(date);
    current.setHours(inicioH, inicioM, 0, 0);

    const fim = new Date(date);
    fim.setHours(fimH, fimM, 0, 0);

    const now = new Date();
    const minAntecedencia = new Date(now.getTime() + config.antecedencia_minima_horas * 3600000);

    while (current < fim) {
      if (current > minAntecedencia && isHorarioDisponivel(current)) {
        slots.push(new Date(current));
      }
      current.setMinutes(current.getMinutes() + config.intervalo_minutos);
    }

    return slots;
  };

  return {
    config,
    scope,
    loading: loadingScope || loadingConfig || loadingReunioes || loadingBloqueios,
    createAgendamento,
    isHorarioDisponivel,
    getSlotsDisponiveis,
  };
}
