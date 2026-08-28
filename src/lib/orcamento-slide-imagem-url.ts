/** Perfis de entrega — celular recebe versões menores via Supabase Image Transformations. */
export type SlideImagemTamanho = 'hero' | 'large' | 'medium' | 'small' | 'fundo';

/** cover = preenche e recorta; contain = mostra a imagem inteira dentro da caixa. */
export type SlideImagemRedimensionar = 'cover' | 'contain';

const CONTAIN_PAISAGEM_DESKTOP = { width: 1920, height: 1080, quality: 82 } as const;
const CONTAIN_PAISAGEM_MOBILE = { width: 960, height: 540, quality: 78 } as const;

const MOBILE_PROFILES: Record<SlideImagemTamanho, { width: number; quality: number }> = {
  hero: { width: 1080, quality: 80 },
  large: { width: 960, quality: 78 },
  medium: { width: 720, quality: 75 },
  small: { width: 400, quality: 72 },
  fundo: { width: 1080, quality: 70 },
};

const DESKTOP_PROFILES: Record<SlideImagemTamanho, { width: number; quality: number }> = {
  hero: { width: 1920, quality: 85 },
  large: { width: 1600, quality: 82 },
  medium: { width: 1280, quality: 80 },
  small: { width: 640, quality: 78 },
  fundo: { width: 1920, quality: 78 },
};

const SUPABASE_OBJECT_PUBLIC = '/storage/v1/object/public/';
const SUPABASE_RENDER_PUBLIC = '/storage/v1/render/image/public/';

function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co') && url.includes(SUPABASE_OBJECT_PUBLIC);
}

/**
 * Gera URL otimizada para apresentação (principalmente celular).
 * Imagens já hospedadas no Supabase passam pelo endpoint de transformação.
 */
export function urlImagemApresentacao(
  src: string | null | undefined,
  mobile: boolean,
  tamanho: SlideImagemTamanho = 'medium',
  redimensionar: SlideImagemRedimensionar = 'cover',
): string {
  if (!src?.trim()) return '';

  const perfil = mobile ? MOBILE_PROFILES[tamanho] : DESKTOP_PROFILES[tamanho];
  const containPerfil = mobile ? CONTAIN_PAISAGEM_MOBILE : CONTAIN_PAISAGEM_DESKTOP;

  if (!isSupabaseStorageUrl(src)) return src;

  const base = src.split('?')[0].replace(SUPABASE_OBJECT_PUBLIC, SUPABASE_RENDER_PUBLIC);
  const params = new URLSearchParams();

  if (redimensionar === 'contain') {
    params.set('width', String(containPerfil.width));
    params.set('height', String(containPerfil.height));
    params.set('quality', String(containPerfil.quality));
    params.set('resize', 'contain');
  } else {
    params.set('width', String(perfil.width));
    params.set('quality', String(perfil.quality));
    params.set('resize', 'cover');
  }

  return `${base}?${params.toString()}`;
}
