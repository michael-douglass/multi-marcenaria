export interface AgendaBannerConfig {
  banner_desktop_url?: string | null;
  banner_mobile_url?: string | null;
}

export function resolveAgendaBannerUrl(
  config: AgendaBannerConfig,
  viewport: 'desktop' | 'mobile',
): string | null {
  const desktop = config.banner_desktop_url?.trim() || null;
  const mobile = config.banner_mobile_url?.trim() || null;

  if (viewport === 'mobile') {
    return mobile || desktop;
  }

  return desktop || mobile;
}

export function hasAgendaCustomBanner(config: AgendaBannerConfig): boolean {
  return Boolean(config.banner_desktop_url?.trim() || config.banner_mobile_url?.trim());
}
