import { createContext, useContext } from 'react';

export interface SlideLayoutContextValue {
  previewMode: boolean;
  mobile: boolean;
  embeddedInLayout: boolean;
  /** Prévia nas configurações com dimensões reais (1920×1080 / 1080×1920). */
  faithfulPreview?: boolean;
  /**
   * PDF/imagens: não monta players de vídeo (evita download/cache e falhas de rede
   * que travam a exportação no celular).
   */
  omitVideos?: boolean;
}

export const SlideLayoutContext = createContext<SlideLayoutContextValue>({
  previewMode: false,
  mobile: false,
  embeddedInLayout: false,
  faithfulPreview: false,
  omitVideos: false,
});

export function useSlideLayoutContext() {
  return useContext(SlideLayoutContext);
}

const SlideShellContext = createContext(false);

export function SlideShellProvider({ children }: { children: React.ReactNode }) {
  return <SlideShellContext.Provider value={true}>{children}</SlideShellContext.Provider>;
}

export function useIsInSlideShell() {
  return useContext(SlideShellContext);
}
