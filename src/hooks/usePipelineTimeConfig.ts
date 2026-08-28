import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PipelineTimeConfig {
  id: string;
  tempoMinutos: number;
  cor: string;
  nomeLegenda: string;
  ordem: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

interface DBTimeConfig {
  id: string;
  tempo_minutos: number;
  cor: string;
  nome_legenda: string;
  ordem: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

function adaptTimeConfig(db: DBTimeConfig): PipelineTimeConfig {
  return {
    id: db.id,
    tempoMinutos: db.tempo_minutos,
    cor: db.cor,
    nomeLegenda: db.nome_legenda,
    ordem: db.ordem,
    ativo: db.ativo,
    criadoEm: db.criado_em,
    atualizadoEm: db.atualizado_em,
  };
}

export function usePipelineTimeConfig() {
  const queryClient = useQueryClient();

  const { data: configs, isLoading, error, refetch } = useQuery({
    queryKey: ['pipeline-time-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>pipeline_time_config<')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return (data as DBTimeConfig[]).map(adaptTimeConfig);
    },
  });

  const addConfig = useMutation({
    mutationFn: async (config: { tempoMinutos: number; cor: string; nomeLegenda: string }) => {
      // Pegar a maior ordem atual
      const maxOrdem = configs?.reduce((max, c) => Math.max(max, c.ordem), 0) || 0;
      
      const { data, error } = await supabase
        .from('CRM-multi-empresas>pipeline_time_config<')
        .insert({
          tempo_minutos: config.tempoMinutos,
          cor: config.cor,
          nome_legenda: config.nomeLegenda,
          ordem: maxOrdem + 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return adaptTimeConfig(data as DBTimeConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-time-config'] });
    },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{ tempoMinutos: number; cor: string; nomeLegenda: string; ordem: number; ativo: boolean }> }) => {
      const dbUpdates: Partial<DBTimeConfig> = {};
      if (updates.tempoMinutos !== undefined) dbUpdates.tempo_minutos = updates.tempoMinutos;
      if (updates.cor !== undefined) dbUpdates.cor = updates.cor;
      if (updates.nomeLegenda !== undefined) dbUpdates.nome_legenda = updates.nomeLegenda;
      if (updates.ordem !== undefined) dbUpdates.ordem = updates.ordem;
      if (updates.ativo !== undefined) dbUpdates.ativo = updates.ativo;

      const { data, error } = await supabase
        .from('CRM-multi-empresas>pipeline_time_config<')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return adaptTimeConfig(data as DBTimeConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-time-config'] });
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('CRM-multi-empresas>pipeline_time_config<')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-time-config'] });
    },
  });

  // Função para obter a cor baseada no tempo decorrido
  const getColorForElapsedTime = (elapsedMinutes: number): { cor: string; legenda: string } | null => {
    if (!configs || configs.length === 0) return null;

    // Encontrar a configuração cujo tempo é maior ou igual ao tempo decorrido
    // Ordenar por tempo crescente e pegar o primeiro que é >= elapsedMinutes
    const sortedConfigs = [...configs].sort((a, b) => a.tempoMinutos - b.tempoMinutos);
    
    for (const config of sortedConfigs) {
      if (elapsedMinutes <= config.tempoMinutos) {
        return { cor: config.cor, legenda: config.nomeLegenda };
      }
    }
    
    // Se passou de todos os tempos, usar a última configuração
    const lastConfig = sortedConfigs[sortedConfigs.length - 1];
    return { cor: lastConfig.cor, legenda: lastConfig.nomeLegenda };
  };

  // Formatar tempo para exibição
  const formatElapsedTime = (minutes: number): string => {
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${Math.floor(minutes)} min`;
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours}h`;
    }
    const days = Math.floor(minutes / 1440);
    return `${days}d`;
  };

  return {
    configs,
    isLoading,
    error,
    refetch,
    addConfig,
    updateConfig,
    deleteConfig,
    getColorForElapsedTime,
    formatElapsedTime,
  };
}
