import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  mapBannerUploadError,
  prepareBannerFileForUpload,
  validateEmpresaBannerFile,
} from '@/lib/empresa-branding-upload';
import { toast } from 'sonner';

const BUCKET = 'empresa-branding';

async function uploadAgendaBanner(
  configId: string,
  slot: 'desktop' | 'mobile',
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const ts = Date.now();
  const path = `agenda/${configId}/banner-${slot}-${ts}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${ts}`;
}

export function useAgendaBannerUpload(configId?: string) {
  const uploadBanner = useMutation({
    mutationFn: async ({
      slot,
      file,
    }: {
      slot: 'desktop' | 'mobile';
      file: File;
    }) => {
      if (!configId) throw new Error('Configuração da agenda não encontrada');

      const validationError = validateEmpresaBannerFile(file);
      if (validationError) throw new Error(validationError);

      const prepared = await prepareBannerFileForUpload(file, slot);
      return uploadAgendaBanner(configId, slot, prepared);
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar banner', {
        description: mapBannerUploadError(error.message),
      });
    },
  });

  return { uploadBanner };
}
