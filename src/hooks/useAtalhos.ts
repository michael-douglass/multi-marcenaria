import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Atalho {
  id: number;
  created_at: string;
  titulo: string | null;
  mensagem: string | null;
  url_audio: string | null;
  url_pdf: string | null;
  url_img: string | null;
  user_auth: string | null;
  all_can_see: boolean | null;
}

export type AtalhoTipo = 'texto' | 'audio' | 'pdf' | 'imagem';

export interface CreateAtalhoData {
  titulo: string;
  tipo: AtalhoTipo;
  mensagem?: string;
  file?: File;
  all_can_see?: boolean;
}

export function useAtalhos() {
  return useQuery({
    queryKey: ['atalhos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_atalhos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar atalhos:', error);
        throw error;
      }

      return data as Atalho[];
    },
  });
}

export function useAtalhosPorTipo(tipo?: AtalhoTipo) {
  const { data: atalhos, ...rest } = useAtalhos();

  const filteredAtalhos = atalhos?.filter(atalho => {
    if (!tipo) return true;
    
    switch (tipo) {
      case 'texto':
        return atalho.mensagem && !atalho.url_audio && !atalho.url_pdf && !atalho.url_img;
      case 'audio':
        return !!atalho.url_audio;
      case 'pdf':
        return !!atalho.url_pdf;
      case 'imagem':
        return !!atalho.url_img;
      default:
        return true;
    }
  });

  return { data: filteredAtalhos, ...rest };
}

export function useAtalhosAgrupados() {
  const { data: atalhos, ...rest } = useAtalhos();

  const agrupados = {
    texto: atalhos?.filter(a => a.mensagem && !a.url_audio && !a.url_pdf && !a.url_img) || [],
    audio: atalhos?.filter(a => !!a.url_audio) || [],
    pdf: atalhos?.filter(a => !!a.url_pdf) || [],
    imagem: atalhos?.filter(a => !!a.url_img) || [],
  };

  return { data: agrupados, ...rest };
}

export function useCreateAtalho() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ titulo, tipo, mensagem, file, all_can_see }: CreateAtalhoData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let url_audio: string | null = null;
      let url_pdf: string | null = null;
      let url_img: string | null = null;

      // Upload do arquivo se existir
      if (file && (tipo === 'audio' || tipo === 'pdf' || tipo === 'imagem')) {
        const fileExt = file.name.split('.').pop() || tipo;
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('marketing-templates')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('marketing-templates')
          .getPublicUrl(fileName);

        if (tipo === 'audio') {
          url_audio = publicUrl;
        } else if (tipo === 'pdf') {
          url_pdf = publicUrl;
        } else if (tipo === 'imagem') {
          url_img = publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('crm_multiempresas_atalhos')
        .insert({
          titulo,
          mensagem: tipo === 'texto' ? mensagem : null,
          url_audio,
          url_pdf,
          url_img,
          user_auth: user.id,
          all_can_see: all_can_see ?? true,
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar atalho:', error);
        throw error;
      }

      return data as Atalho;
    },
    onSuccess: () => {
      toast.success('Template criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['atalhos'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar template');
    },
  });
}

export function useDeleteAtalho() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('crm_multiempresas_atalhos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar atalho:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Template excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['atalhos'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir template');
    },
  });
}
