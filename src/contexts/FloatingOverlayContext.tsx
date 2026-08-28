import { createContext, useContext } from 'react';

const FloatingOverlayContext = createContext(false);

export const FloatingOverlayProvider = FloatingOverlayContext.Provider;

export function useFloatingOverlayLayer() {
  return useContext(FloatingOverlayContext);
}
