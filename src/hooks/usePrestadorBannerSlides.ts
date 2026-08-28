import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa, type Empresa } from '@/contexts/EmpresaContext';
import {
  mapBannerUploadError,
  prepareBannerFileForUpload,
  validateEmpresaBannerFile,
} from '@/lib/empresa-branding-upload';
import { normalizeBannerSlides } from '@/lib/empresa-banner-slides';
import { toast } from 'sonner';

export const MAX_SLIDES = 8;

async function uploadSlide(
  empresaId: string,
  slot: 'desktop' | 'mobile',
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const ts = Date.now();
  const path = `${empresaId}/slide-${slot}-${ts}.${ext}`;

  const { error } = await supabase.storage
    .from('empresa-branding')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from('empresa-branding').getPublicUrl(path);
  return `${data.publicUrl}?t=${ts}`;
}

export function usePrestadorBannerSlides() {
  const { empresa, trocarEmpresa } = useEmpresa();
  const queryClient = useQueryClient();

  const colFor = (slot: 'desktop' | 'mobile') =>
    slot === 'desktop' ? 'banner_slides_desktop' : 'banner_slides_mobile';

  const slidesFor = (slot: 'desktop' | 'mobile'): string[] =>
    normalizeBannerSlides(
      slot === 'desktop' ? empresa?.banner_slides_desktop : empresa?.banner_slides_mobile,
    );

  const adicionarSlide = useMutation({
    mutationFn: async ({ slot, file }: { slot: 'desktop' | 'mobile'; file: File }) => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');
      const fileError = validateEmpresaBannerFile(file);
      if (fileError) throw new Error(fileError);
      const current = slidesFor(slot);
      if (current.length >= MAX_SLIDES)
        throw new Error(`Máximo de ${MAX_SLIDES} imagens por dispositivo`);

      const prepared = await prepareBannerFileForUpload(file, slot);
      const url = await uploadSlide(empresa.id, slot, prepared);
      const updated = [...current, url];

      const { data, error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .update({ [colFor(slot)]: updated, atualizado_em: new Date().toISOString() })
        .eq('id', empresa.id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (updated) => {
      await trocarEmpresa(updated as Empresa);
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      toast.success('Slide adicionado!');
    },
    onError: (e: Error) =>
      toast.error('Erro ao adicionar slide', { description: mapBannerUploadError(e.message) }),
  });

  const removerSlide = useMutation({
    mutationFn: async ({ slot, index }: { slot: 'desktop' | 'mobile'; index: number }) => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');
      const current = [...slidesFor(slot)];
      current.splice(index, 1);

      const { data, error } = await supabase
        .from('CRM-multi-empresas>empresas<')
        .update({ [colFor(slot)]: current, atualizado_em: new Date().toISOString() })
        .eq('id', empresa.id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (updated) => {
      await trocarEmpresa(updated as Empresa);
      queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
      toast.success('Slide removido');
    },
    onError: (e: Error) => toast.error('Erro ao remover slide', { description: e.message }),
  });

  return { empresa, adicionarSlide, removerSlide, slidesFor, MAX_SLIDES };
}
