import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa, type Empresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EmpresaBrandingInput {
  nome: string;
  cor_primaria: string;
  logo_url?: string | null;
}

async function uploadLogo(empresaId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `${empresaId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('empresa-branding')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('empresa-branding').getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export function useEmpresaBranding(empresaAlvo?: Empresa | null) {
  const { user } = useAuth();
  const { empresa: empresaAtiva, trocarEmpresa, recarregarEmpresa } = useEmpresa();
  const queryClient = useQueryClient();
  const empresa = empresaAlvo ?? empresaAtiva;

  const salvarBranding = useMutation({
    mutationFn: async ({
      dados,
      logoFile,
    }: {
      dados: EmpresaBrandingInput;
      logoFile?: File | null;
    }) => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');

      let logo_url = dados.logo_url ?? empresa.logo_url;

      if (logoFile) {
        logo_url = await uploadLogo(empresa.id, logoFile);
      }

      const { data, error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .update({
          nome: dados.nome.trim(),
          cor_primaria: dados.cor_primaria,
          logo_url,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', empresa.id)
        .select('*')
        .single();

      if (error) throw error;
      return data as Empresa;
    },
    onSuccess: async (empresaAtualizada) => {
      if (empresaAtiva?.id === empresaAtualizada.id) {
        trocarEmpresa(empresaAtualizada);
      }
      if (user?.id) await recarregarEmpresa(user.id);
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      toast.success('Identidade visual atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar identidade visual', { description: error.message });
    },
  });

  const removerLogo = useMutation({
    mutationFn: async () => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');

      const { data, error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .update({ logo_url: null, atualizado_em: new Date().toISOString() })
        .eq('id', empresa.id)
        .select('*')
        .single();

      if (error) throw error;
      return data as Empresa;
    },
    onSuccess: (empresaAtualizada) => {
      if (empresaAtiva?.id === empresaAtualizada.id) {
        trocarEmpresa(empresaAtualizada);
      }
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      toast.success('Logo removida');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover logo', { description: error.message });
    },
  });

  return {
    empresa,
    salvarBranding,
    removerLogo,
  };
}
