import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { empresaPortalQueryKey, useEmpresaPortal } from '@/hooks/useEmpresaPortal';
import {
  mapBannerUploadError,
  prepareBannerFileForUpload,
  validateEmpresaBannerFile,
} from '@/lib/empresa-branding-upload';
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

/** Banners do portal do parceiro (só empresa-modelo; grava pela RPC `empresa_atualizar_banners`). */
export function usePrestadorBannerSlides() {
  const { empresa } = useEmpresa();
  const portal = useEmpresaPortal();
  const queryClient = useQueryClient();

  const slidesFor = (slot: 'desktop' | 'mobile'): string[] =>
    (slot === 'desktop' ? portal.data?.banner_slides_desktop : portal.data?.banner_slides_mobile) ?? [];

  const gravar = async (slot: 'desktop' | 'mobile', lista: string[]) => {
    const desktop = slot === 'desktop' ? lista : slidesFor('desktop');
    const mobile = slot === 'mobile' ? lista : slidesFor('mobile');
    const call = supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    const { error } = await call.call(supabase, 'empresa_atualizar_banners', { p_desktop: desktop, p_mobile: mobile });
    if (error) throw new Error(error.message);
  };

  const atualizar = () => queryClient.invalidateQueries({ queryKey: empresaPortalQueryKey(empresa?.id) });

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
      await gravar(slot, [...current, url]);
    },
    onSuccess: async () => {
      await atualizar();
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
      await gravar(slot, current);
    },
    onSuccess: async () => {
      await atualizar();
      toast.success('Slide removido');
    },
    onError: (e: Error) => toast.error('Erro ao remover slide', { description: e.message }),
  });

  return { empresa, adicionarSlide, removerSlide, slidesFor, MAX_SLIDES };
}
