import { createContext, useContext, type ReactNode } from 'react';
import { usePageZoom } from '@/hooks/usePageZoom';

type PageZoomContextValue = ReturnType<typeof usePageZoom>;

const PageZoomContext = createContext<PageZoomContextValue | null>(null);

export function PageZoomProvider({ children }: { children: ReactNode }) {
  const value = usePageZoom();
  return <PageZoomContext.Provider value={value}>{children}</PageZoomContext.Provider>;
}

export function usePageZoomContext(): PageZoomContextValue {
  const ctx = useContext(PageZoomContext);
  if (!ctx) {
    throw new Error('usePageZoomContext deve ser usado dentro de PageZoomProvider');
  }
  return ctx;
}
