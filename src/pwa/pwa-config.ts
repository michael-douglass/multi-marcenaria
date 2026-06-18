export const PWA_CONFIG = {
  name: 'GARBO Movelaria — Sistema Financeiro',
  shortName: 'GARBO',
  description: 'Gestão financeira, obras e operação — GARBO Movelaria',
  themeColor: '#f5a623',
  backgroundColor: '#2a1812',
  lang: 'pt-BR',
} as const

export const PWA_STORAGE_KEYS = {
  installDismissed: 'garbo-pwa-install-dismissed',
  visitCount: 'garbo-pwa-visit-count',
} as const

export const PWA_INSTALL_MIN_VISITS = 2
