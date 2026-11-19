export const PWA_CONFIG = {
  name: 'Gestão — Sistema da empresa',
  shortName: 'Gestão',
  description: 'Gestão financeira, comercial, obras e operação da empresa',
  themeColor: '#f5a623',
  backgroundColor: '#2a1812',
  lang: 'pt-BR',
} as const

export const PWA_STORAGE_KEYS = {
  installDismissed: 'app-pwa-install-dismissed',
  visitCount: 'app-pwa-visit-count',
} as const

export const PWA_INSTALL_MIN_VISITS = 2
