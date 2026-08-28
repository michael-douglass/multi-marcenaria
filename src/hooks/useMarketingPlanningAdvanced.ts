import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface MarketingPlanningShape {
  id: string;
  tipo: 'rectangle' | 'circle' | 'diamond' | 'text';
  texto: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  cor: string;
  enviado_producao: boolean;
  card_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface MarketingPlanningEdge {
  id: string;
  source_id: string;
  source_type: string;
  target_id: string;
  target_type: string;
  label: string | null;
  estilo: string;
  criado_em: string;
}

export interface MarketingPlanningDrawing {
  id: string;
  path_data: string;
  cor: string;
  stroke_width: number;
  criado_em: string;
}

export interface MarketingPlanningFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'image' | 'pdf';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  criado_em: string;
  atualizado_em: string;
}

// Hook para Formas Geométricas
export function useMarketingPlanningShapes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-planning-shapes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_shapes')
        .select('*')
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return data as MarketingPlanningShape[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (shape: {
      tipo: 'rectangle' | 'circle' | 'diamond' | 'text';
      texto?: string;
      position_x?: number;
      position_y?: number;
      width?: number;
      height?: number;
      cor?: string;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_shapes')
        .insert({
          tipo: shape.tipo,
          texto: shape.texto ?? null,
          position_x: shape.position_x ?? 100,
          position_y: shape.position_y ?? 100,
          width: shape.width ?? 150,
          height: shape.height ?? 80,
          cor: shape.cor ?? '#3b82f6',
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingPlanningShape;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-shapes'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar forma', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingPlanningShape> & { id: string }) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_shapes')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-shapes'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar forma', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_shapes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-shapes'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover forma', description: error.message, variant: 'destructive' });
    },
  });

  return {
    shapes: query.data ?? [],
    isLoading: query.isLoading,
    createShape: createMutation.mutateAsync,
    updateShape: updateMutation.mutate,
    deleteShape: deleteMutation.mutate,
  };
}

// Hook para Conexões/Edges
export function useMarketingPlanningEdges() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-planning-edges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_edges')
        .select('*')
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return data as MarketingPlanningEdge[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (edge: {
      source_id: string;
      source_type: string;
      target_id: string;
      target_type: string;
      label?: string;
      estilo?: string;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_edges')
        .insert({
          source_id: edge.source_id,
          source_type: edge.source_type,
          target_id: edge.target_id,
          target_type: edge.target_type,
          label: edge.label ?? null,
          estilo: edge.estilo ?? 'default',
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingPlanningEdge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-edges'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar conexão', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_edges')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-edges'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover conexão', description: error.message, variant: 'destructive' });
    },
  });

  return {
    edges: query.data ?? [],
    isLoading: query.isLoading,
    createEdge: createMutation.mutateAsync,
    deleteEdge: deleteMutation.mutate,
  };
}

// Hook para Desenhos
export function useMarketingPlanningDrawings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-planning-drawings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_drawings')
        .select('*')
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return data as MarketingPlanningDrawing[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (drawing: {
      path_data: string;
      cor?: string;
      stroke_width?: number;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_drawings')
        .insert({
          path_data: drawing.path_data,
          cor: drawing.cor ?? '#000000',
          stroke_width: drawing.stroke_width ?? 2,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingPlanningDrawing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-drawings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar desenho', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_drawings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-drawings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover desenho', description: error.message, variant: 'destructive' });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_drawings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-drawings'] });
    },
  });

  return {
    drawings: query.data ?? [],
    isLoading: query.isLoading,
    createDrawing: createMutation.mutateAsync,
    deleteDrawing: deleteMutation.mutate,
    clearAllDrawings: clearAllMutation.mutate,
  };
}

// Hook para Arquivos (Imagens e PDFs)
export function useMarketingPlanningFiles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-planning-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_files')
        .select('*')
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return data as MarketingPlanningFile[];
    },
  });

  const uploadAndCreateMutation = useMutation({
    mutationFn: async ({
      file,
      position_x,
      position_y,
    }: {
      file: File;
      position_x?: number;
      position_y?: number;
    }) => {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `planning/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('marketing-planning-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('marketing-planning-files')
        .getPublicUrl(filePath);

      // Determine file type
      const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';

      // Create database record
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_files')
        .insert({
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: fileType,
          position_x: position_x ?? 100,
          position_y: position_y ?? 100,
          width: fileType === 'image' ? 300 : 200,
          height: fileType === 'image' ? 200 : 250,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MarketingPlanningFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-files'] });
      toast({ title: 'Arquivo adicionado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar arquivo', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingPlanningFile> & { id: string }) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_files')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-files'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar arquivo', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_planning_files')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-files'] });
      toast({ title: 'Arquivo removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover arquivo', description: error.message, variant: 'destructive' });
    },
  });

  // Create file from template data (no upload needed - file already exists in storage)
  const createFromTemplateMutation = useMutation({
    mutationFn: async (fileData: {
      file_url: string;
      file_name: string;
      file_type: string;
      position_x: number;
      position_y: number;
      width: number;
      height: number;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_planning_files')
        .insert({
          file_url: fileData.file_url,
          file_name: fileData.file_name,
          file_type: fileData.file_type,
          position_x: fileData.position_x,
          position_y: fileData.position_y,
          width: fileData.width,
          height: fileData.height,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingPlanningFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-planning-files'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao restaurar arquivo', description: error.message, variant: 'destructive' });
    },
  });

  return {
    files: query.data ?? [],
    isLoading: query.isLoading,
    uploadFile: uploadAndCreateMutation.mutateAsync,
    createFileFromTemplate: createFromTemplateMutation.mutateAsync,
    updateFile: updateMutation.mutate,
    deleteFile: deleteMutation.mutate,
  };
}
