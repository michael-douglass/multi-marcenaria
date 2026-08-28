import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

// Types
export interface BoardData {
  nodes: Array<{
    id: string;
    titulo: string;
    conteudo: string | null;
    classificacao: string | null;
    position_x: number;
    position_y: number;
    enviado_producao: boolean;
  }>;
  shapes: Array<{
    id: string;
    tipo: string;
    texto: string | null;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    cor: string;
    enviado_producao: boolean;
  }>;
  edges: Array<{
    id: string;
    source_id: string;
    source_type: string;
    target_id: string;
    target_type: string;
    label: string | null;
    estilo: string;
  }>;
  drawings: Array<{
    id: string;
    path_data: string;
    cor: string;
    stroke_width: number;
  }>;
  files: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
  }>;
}

export interface MarketingBoardTemplate {
  id: string;
  nome: string;
  tipo: 'comum' | 'central';
  board_data: BoardData;
  criado_em: string;
  atualizado_em: string;
}

// Helper to cast DB response to our type
function parseTemplate(data: {
  id: string;
  nome: string;
  tipo: string;
  board_data: Json;
  criado_em: string;
  atualizado_em: string;
}): MarketingBoardTemplate {
  return {
    id: data.id,
    nome: data.nome,
    tipo: data.tipo as 'comum' | 'central',
    board_data: data.board_data as unknown as BoardData,
    criado_em: data.criado_em,
    atualizado_em: data.atualizado_em,
  };
}

export function useMarketingBoardTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-board-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_board_templates')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(parseTemplate);
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ nome, tipo, board_data }: { nome: string; tipo: 'comum' | 'central'; board_data: BoardData }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_board_templates')
        .insert({ nome, tipo, board_data: board_data as unknown as Json })
        .select()
        .single();
      if (error) throw error;
      return parseTemplate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-board-templates'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-board-templates-central'] });
      toast({ title: 'Template salvo com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar template', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, board_data, ...rest }: Partial<MarketingBoardTemplate> & { id: string }) => {
      const updates: Record<string, unknown> = { ...rest, atualizado_em: new Date().toISOString() };
      if (board_data) {
        updates.board_data = board_data as unknown as Json;
      }
      const { error } = await supabase
        .from('crm_multiempresas_marketing_board_templates')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-board-templates'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-board-templates-central'] });
      toast({ title: 'Template atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar template', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_board_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-board-templates'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-board-templates-central'] });
      toast({ title: 'Template removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover template', description: error.message, variant: 'destructive' });
    },
  });

  // Query para buscar apenas templates centrais (para uso nos cards)
  const centralTemplatesQuery = useQuery({
    queryKey: ['marketing-board-templates-central'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_board_templates')
        .select('*')
        .eq('tipo', 'central')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(parseTemplate);
    },
  });

  return {
    templates: query.data ?? [],
    centralTemplates: centralTemplatesQuery.data ?? [],
    isLoading: query.isLoading,
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutate,
    deleteTemplate: deleteMutation.mutate,
  };
}
