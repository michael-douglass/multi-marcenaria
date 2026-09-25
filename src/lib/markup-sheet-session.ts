import { useSyncExternalStore } from 'react';
import { setMarkupCalculatorOpenFlag } from '@/lib/markup-ui';

export interface MarkupSheetSession {
  leadId: number;
  leadNome?: string;
  orcamentoId: string | null;
  forceNovo: boolean;
}

type Listener = () => void;

let session: MarkupSheetSession | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeMarkupSheetSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMarkupSheetSession(): MarkupSheetSession | null {
  return session;
}

export function getMarkupSheetSessionServerSnapshot(): MarkupSheetSession | null {
  return null;
}

/** Abre a calculadora fora da árvore da aba Detalhes — sobrevive a re-renders do card. */
export function openMarkupSheetSession(next: MarkupSheetSession) {
  setMarkupCalculatorOpenFlag(true);
  session = next;
  emit();
}

export function patchMarkupSheetSession(patch: Partial<MarkupSheetSession>) {
  if (!session) return;
  session = { ...session, ...patch };
  emit();
}

export function closeMarkupSheetSession() {
  session = null;
  setMarkupCalculatorOpenFlag(false);
  emit();
}

export function useMarkupSheetSession(): MarkupSheetSession | null {
  return useSyncExternalStore(
    subscribeMarkupSheetSession,
    getMarkupSheetSession,
    getMarkupSheetSessionServerSnapshot,
  );
}
