/**
 * Dados do portal do parceiro da empresa ativa: se ela é empresa-modelo e os banners do portal
 * (RPC `app_empresa_portal`). Os banners são definidos só nas empresas-modelo e chegam às empresas
 * pelo pacote Pontua (docs/marca-neutra).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppOptional } from '@/context/AppContext';
import { normalizeBannerSlides } from '@/lib/empresa-banner-slides';

export interface EmpresaPortal {
  e_modelo: boolean;
  banner_slides_desktop: string[];
  banner_slides_mobile: string[];
}

export const empresaPortalQueryKey = (empresaId: string | undefined) => ['empresa-portal', empresaId ?? 'sem-empresa'] as const;

export function useEmpresaPortal() {
  const empresaId = useAppOptional()?.empresa?.id;
  return useQuery({
    queryKey: empresaPortalQueryKey(empresaId),
    enabled: !!empresaId,
    queryFn: async (): Promise<EmpresaPortal> => {
      // RPC nova, fora dos tipos gerados: o cast fica restrito a este ponto.
      const call = supabase.rpc as unknown as (f: string) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await call.call(supabase, 'app_empresa_portal');
      if (error) throw new Error(error.message);
      const d = (data ?? {}) as Record<string, unknown>;
      return {
        e_modelo: d.e_modelo === true,
        banner_slides_desktop: normalizeBannerSlides(d.banner_slides_desktop),
        banner_slides_mobile: normalizeBannerSlides(d.banner_slides_mobile),
      };
    },
    staleTime: 60_000,
  });
}
