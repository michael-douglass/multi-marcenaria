import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';

/** Nome exibido ao lado da logo e na aba do navegador */
export const APP_SYSTEM_NAME = 'GARBO Movelaria';

/** Logo padrão quando a empresa ainda não configurou uma imagem */
export const DEFAULT_BRAND_LOGO_URL = GARBO_LOGO_SRC;

export function resolveBrandLogo(logoUrl?: string | null): string {
  return logoUrl?.trim() || DEFAULT_BRAND_LOGO_URL;
}

export function resolveBrandName(nome?: string | null): string {
  return nome?.trim() || APP_SYSTEM_NAME;
}
