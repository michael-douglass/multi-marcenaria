import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CadastroAluno, CadastroConfig, PlanoFin } from '@/types/cadastro';

const CADASTRO_ALUNOS_TABLE = 'CRM-multi-empresas>cadastro_alunos<';
const CADASTRO_CONFIG_TABLE = 'CRM-multi-empresas>cadastro_config<';
const PLANOS_TABLE = 'plataforma-pro-forco-fin_planos';

export function useCadastroAlunos() {
  return useQuery({
    queryKey: ['cadastro-alunos'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(CADASTRO_ALUNOS_TABLE)
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CadastroAluno[];
    },
  });
}

/** Payload editável do cadastro (sem user_id) */
export interface UpdateCadastroAlunoPayload {
  nome: string;
  email: string;
  telefone: string | null;
  nome_aluno: string | null;
  ano_escolar: string | null;
  idade: number | null;
  cpf_responsavel: string | null;
  melhores_dias: string[];
  melhor_horario: string[];
  plano_id: string | null;
  dia_pagamento: number | null;
  data_inicio_prevista: string | null;
  disciplinas: string[];
}

export function useUpdateCadastroAluno() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateCadastroAlunoPayload }) => {
      const { error } = await (supabase as any)
        .from(CADASTRO_ALUNOS_TABLE)
        .update({
          ...payload,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastro-alunos'] });
      toast.success('Lead atualizado');
    },
    onError: (err: Error) => toast.error('Erro ao atualizar', { description: err.message }),
  });
}

export function useDeleteCadastroAluno() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from(CADASTRO_ALUNOS_TABLE)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastro-alunos'] });
      toast.success('Lead excluído');
    },
    onError: (err: Error) => toast.error('Erro ao excluir', { description: err.message }),
  });
}

export function useCadastroConfig() {
  return useQuery({
    queryKey: ['cadastro-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(CADASTRO_CONFIG_TABLE)
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return { ...data, disciplinas: Array.isArray(data?.disciplinas) ? data.disciplinas : [] } as CadastroConfig;
    },
  });
}

export interface UpdateCadastroConfigPayload {
  planos_visiveis: string[];
  disciplinas: string[];
}

export function useUpdateCadastroConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateCadastroConfigPayload) => {
      const { data: existing, error: fetchError } = await (supabase as any)
        .from(CADASTRO_CONFIG_TABLE)
        .select('id')
        .limit(1)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const updatePayload = {
        planos_visiveis: payload.planos_visiveis,
        disciplinas: payload.disciplinas ?? [],
        atualizado_em: new Date().toISOString(),
      };
      if (existing?.id) {
        const { error } = await (supabase as any)
          .from(CADASTRO_CONFIG_TABLE)
          .update(updatePayload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from(CADASTRO_CONFIG_TABLE)
          .insert(updatePayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastro-config'] });
      toast.success('Configuração salva');
    },
    onError: (err: Error) => toast.error('Erro ao salvar', { description: err.message }),
  });
}

/** Planos disponíveis (todos, para listar na config) */
export function usePlanosFin() {
  return useQuery({
    queryKey: ['fin-planos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PLANOS_TABLE)
        .select('id, nome, valor, categoria, aulas_por_semana, aulas_por_mes, duracao_minutos, ativo')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as PlanoFin[];
    },
  });
}

/** Planos visíveis no formulário público (filtrados pela config) */
export function usePlanosVisiveisCadastro() {
  const { data: config } = useCadastroConfig();
  return useQuery({
    queryKey: ['fin-planos-visiveis', config?.planos_visiveis],
    queryFn: async () => {
      const ids = config?.planos_visiveis ?? [];
      if (ids.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from(PLANOS_TABLE)
        .select('id, nome, valor, categoria, aulas_por_semana, aulas_por_mes, duracao_minutos')
        .in('id', ids)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as PlanoFin[];
    },
    enabled: Array.isArray(config?.planos_visiveis),
  });
}
