import {
  PRESTADOR_PORTAL_BANNER_DESKTOP,
  PRESTADOR_PORTAL_BANNER_MOBILE,
} from '@/lib/prestador-portal-media';

/** Garante array de URLs a partir do JSONB do Supabase ou cache local */
export function normalizeBannerSlides(raw: unknown): string[] {
  if (raw == null) return [];

  let list: unknown[] = [];

  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return normalizeBannerSlides(parsed);
    } catch {
      return trimmed.startsWith('http') ? [trimmed] : [];
    }
  } else {
    return [];
  }

  return list
    .filter((item): item is string => typeof item === 'string')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

export function resolvePrestadorBannerSlides(
  empresa: {
    banner_slides_desktop?: unknown;
    banner_slides_mobile?: unknown;
    banner_desktop_url?: string | null;
    banner_mobile_url?: string | null;
  } | null | undefined,
  isMobile: boolean,
): string[] {
  const fallback = isMobile
    ? PRESTADOR_PORTAL_BANNER_MOBILE
    : PRESTADOR_PORTAL_BANNER_DESKTOP;

  if (!empresa) return [...fallback];

  const desktop = normalizeBannerSlides(empresa.banner_slides_desktop);
  const mobile = normalizeBannerSlides(empresa.banner_slides_mobile);

  const fromArrays = isMobile
    ? mobile.length > 0
      ? mobile
      : desktop
    : desktop.length > 0
      ? desktop
      : mobile;

  if (fromArrays.length > 0) return fromArrays;

  const legacy = isMobile
    ? empresa.banner_mobile_url || empresa.banner_desktop_url
    : empresa.banner_desktop_url || empresa.banner_mobile_url;

  return legacy ? [legacy] : [...fallback];
}
