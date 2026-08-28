import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  mapBannerUploadError,
  prepareBannerFileForUpload,
  validateEmpresaBannerFile,
} from '@/lib/empresa-branding-upload';
import { toast } from 'sonner';

async function uploadBanner(empresaId: string, slot: 'desktop' | 'mobile', file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${empresaId}/banner-${slot}.${ext}`;

  const { error } = await supabase.storage
    .from('empresa-branding')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from('empresa-branding').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export function usePrestadorBanner() {
  const { empresa, trocarEmpresa } = useEmpresa();
  const queryClient = useQueryClient();

  const salvarBanner = useMutation({
    mutationFn: async ({ slot, file }: { slot: 'desktop' | 'mobile'; file: File }) => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');
      const fileError = validateEmpresaBannerFile(file);
      if (fileError) throw new Error(fileError);

      const url = await uploadBanner(empresa.id, slot, file);
      const col = slot === 'desktop' ? 'banner_desktop_url' : 'banner_mobile_url';

      const { data, error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .update({ [col]: url, atualizado_em: new Date().toISOString() })
        .eq('id', empresa.id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (updated) => {
      await trocarEmpresa(updated as Parameters<typeof trocarEmpresa>[0]);
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      toast.success('Banner salvo!');
    },
    onError: (e: Error) =>
      toast.error('Erro ao salvar banner', { description: mapBannerUploadError(e.message) }),
  });

  const removerBanner = useMutation({
    mutationFn: async (slot: 'desktop' | 'mobile') => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');
      const col = slot === 'desktop' ? 'banner_desktop_url' : 'banner_mobile_url';

      const { data, error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .update({ [col]: null, atualizado_em: new Date().toISOString() })
        .eq('id', empresa.id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (updated) => {
      await trocarEmpresa(updated as Parameters<typeof trocarEmpresa>[0]);
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      toast.success('Banner removido');
    },
    onError: (e: Error) => toast.error('Erro ao remover banner', { description: e.message }),
  });

  return { empresa, salvarBanner, removerBanner };
}
