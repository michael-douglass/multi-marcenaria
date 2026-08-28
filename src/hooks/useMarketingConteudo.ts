import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface MarketingColumn {
  id: string;
  nome: string;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface MarketingTrafficSource {
  id: string;
  nome: string;
  criado_em: string;
}

export interface MarketingFunnelStage {
  id: string;
  nome: string;
  ordem: number;
  criado_em: string;
}

export interface MarketingProduct {
  id: string;
  nome: string;
  criado_em: string;
}

export interface MarketingContentCard {
  id: string;
  titulo: string;
  script_copy: string | null;
  column_id: string;
  traffic_sources: string[];
  funnel_stage_id: string | null;
  product_id: string | null;
  performando: boolean;
  urgente: boolean;
  ordem: number;
  planning_node_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface MarketingPlanningNode {
  id: string;
  titulo: string;
  conteudo: string | null;
  classificacao: 'planejamento_central' | 'plano_postagem' | 'plano_trafego' | null;
  position_x: number;
  position_y: number;
  enviado_producao: boolean;
  card_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface MarketingCentralPlanning {
  id: string;
  conteudo: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

// Hook para Colunas
export function useMarketingColumns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-columns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_columns')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data as MarketingColumn[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (nome: string) => {
      const maxOrdem = query.data?.reduce((max, col) => Math.max(max, col.ordem), -1) ?? -1;
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_columns')
        .insert({ nome, ordem: maxOrdem + 1 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-columns'] });
      toast({ title: 'Coluna criada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar coluna', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_columns')
        .update({ nome })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-columns'] });
      toast({ title: 'Coluna atualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar coluna', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_columns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-columns'] });
      toast({ title: 'Coluna removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover coluna', description: error.message, variant: 'destructive' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (columns: { id: string; ordem: number }[]) => {
      for (const col of columns) {
        const { error } = await supabase
          .from('crm_multiempresas_marketing_columns')
          .update({ ordem: col.ordem })
          .eq('id', col.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-columns'] });
    },
  });

  return {
    columns: query.data ?? [],
    isLoading: query.isLoading,
    createColumn: createMutation.mutate,
    updateColumn: updateMutation.mutate,
    deleteColumn: deleteMutation.mutate,
    reorderColumns: reorderMutation.mutate,
  };
}

// Hook para Origens de Tráfego
export function useMarketingTrafficSources() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-traffic-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_traffic_sources')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as MarketingTrafficSource[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_traffic_sources')
        .insert({ nome })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-traffic-sources'] });
      toast({ title: 'Origem de tráfego criada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar origem', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_traffic_sources')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-traffic-sources'] });
      toast({ title: 'Origem removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover origem', description: error.message, variant: 'destructive' });
    },
  });

  return {
    sources: query.data ?? [],
    isLoading: query.isLoading,
    createSource: createMutation.mutate,
    deleteSource: deleteMutation.mutate,
  };
}

// Hook para Etapas do Funil
export function useMarketingFunnelStages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-funnel-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_funnel_stages')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data as MarketingFunnelStage[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (nome: string) => {
      const maxOrdem = query.data?.reduce((max, s) => Math.max(max, s.ordem), -1) ?? -1;
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_funnel_stages')
        .insert({ nome, ordem: maxOrdem + 1 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-funnel-stages'] });
      toast({ title: 'Etapa do funil criada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar etapa', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_funnel_stages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-funnel-stages'] });
      toast({ title: 'Etapa removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover etapa', description: error.message, variant: 'destructive' });
    },
  });

  return {
    stages: query.data ?? [],
    isLoading: query.isLoading,
    createStage: createMutation.mutate,
    deleteStage: deleteMutation.mutate,
  };
}

// Hook para Produtos
export function useMarketingProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_products')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as MarketingProduct[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_products')
        .insert({ nome })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-products'] });
      toast({ title: 'Produto criado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar produto', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_products')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-products'] });
      toast({ title: 'Produto removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover produto', description: error.message, variant: 'destructive' });
    },
  });

  return {
    products: query.data ?? [],
    isLoading: query.isLoading,
    createProduct: createMutation.mutate,
    deleteProduct: deleteMutation.mutate,
  };
}

// Hook para Cards de Conteúdo
export function useMarketingContentCards() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-content-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_content_cards')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data as MarketingContentCard[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (card: {
      titulo: string;
      script_copy?: string | null;
      column_id: string;
      traffic_sources?: string[];
      funnel_stage_id?: string | null;
      product_id?: string | null;
      performando?: boolean;
      urgente?: boolean;
      ordem?: number;
      planning_node_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_content_cards')
        .insert({
          titulo: card.titulo,
          script_copy: card.script_copy ?? null,
          column_id: card.column_id,
          traffic_sources: card.traffic_sources ?? [],
          funnel_stage_id: card.funnel_stage_id ?? null,
          product_id: card.product_id ?? null,
          performando: card.performando ?? false,
          urgente: card.urgente ?? false,
          ordem: card.ordem ?? 0,
          planning_node_id: card.planning_node_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingContentCard;
      if (error) throw error;
      return data as MarketingContentCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-content-cards'] });
      toast({ title: 'Card criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar card', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingContentCard> & { id: string }) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_content_cards')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-content-cards'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar card', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_content_cards')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-content-cards'] });
      toast({ title: 'Card removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover card', description: error.message, variant: 'destructive' });
    },
  });

  return {
    cards: query.data ?? [],
    isLoading: query.isLoading,
    createCard: createMutation.mutateAsync,
    updateCard: updateMutation.mutate,
    deleteCard: deleteMutation.mutate,
  };
}

// Hook para Nós de Planejamento
export function useMarketingPlanningNodes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-planning-nodes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_nodes')
        .select('*')
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return data as MarketingPlanningNode[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (node: {
      titulo: string;
      conteudo?: string | null;
      classificacao?: 'planejamento_central' | 'plano_postagem' | 'plano_trafego' | null;
      position_x?: number;
      position_y?: number;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_nodes')
        .insert({
          titulo: node.titulo,
          conteudo: node.conteudo ?? null,
          classificacao: node.classificacao ?? null,
          position_x: node.position_x ?? 0,
          position_y: node.position_y ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingPlanningNode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-nodes'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar nó', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingPlanningNode> & { id: string }) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_nodes')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-nodes'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar nó', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_nodes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-nodes'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover nó', description: error.message, variant: 'destructive' });
    },
  });

  return {
    nodes: query.data ?? [],
    isLoading: query.isLoading,
    createNode: createMutation.mutateAsync,
    updateNode: updateMutation.mutate,
    deleteNode: deleteMutation.mutate,
  };
}

// Hook para Planejamento Central
export function useMarketingCentralPlanning() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-central-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_central_planning')
        .select('*')
        .eq('ativo', true)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MarketingCentralPlanning | null;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (conteudo: string) => {
      // Desativar anteriores
      await supabase
        .from('crm_multiempresas_marketing_central_planning')
        .update({ ativo: false })
        .eq('ativo', true);
      
      // Criar novo
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_central_planning')
        .insert({ 
          conteudo,
          ativo: true 
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-central-planning'] });
      toast({ title: 'Planejamento central salvo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar planejamento', description: error.message, variant: 'destructive' });
    },
  });

  return {
    centralPlanning: query.data,
    isLoading: query.isLoading,
    saveCentralPlanning: upsertMutation.mutateAsync,
  };
}

// Hook para Nós marcados como Planejamento Central
export function useMarketingCentralPlanningNodes() {
  const query = useQuery({
    queryKey: ['marketing-planning-nodes-central'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_nodes')
        .select('*')
        .eq('classificacao', 'planejamento_central')
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return data as MarketingPlanningNode[];
    },
  });

  return {
    centralNodes: query.data ?? [],
    isLoading: query.isLoading,
  };
}
