import { MARCA_PADRAO_LOGO } from '@/lib/marca-padrao';

/** Nome exibido ao lado da logo e na aba do navegador */
export const APP_SYSTEM_NAME = 'Gestão';

/** Logo padrão quando a empresa ainda não configurou uma imagem */
export const DEFAULT_BRAND_LOGO_URL = MARCA_PADRAO_LOGO;

export function resolveBrandLogo(logoUrl?: string | null): string {
  return logoUrl?.trim() || DEFAULT_BRAND_LOGO_URL;
}

export function resolveBrandName(nome?: string | null): string {
  return nome?.trim() || APP_SYSTEM_NAME;
}
