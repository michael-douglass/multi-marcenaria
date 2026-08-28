import { ReactNode, useEffect, useRef } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';

/**
 * Enquanto o cache local do React Query restaura, mantém a árvore montada
 * e só sobrepõe um overlay — evita desmontar Pipeline/LeadModal e fechar cards.
 *
 * Queries criadas durante o restore (ex.: lista de leads) podem ficar presas em
 * pending + idle sem nunca buscar. Ao terminar o restore, dispara essas buscas.
 */
export function QueryPersistBootGate({ children }: { children: ReactNode }) {
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();
  const wasRestoringRef = useRef(false);

  useEffect(() => {
    if (isRestoring) {
      wasRestoringRef.current = true;
      return;
    }
    if (!wasRestoringRef.current) return;
    wasRestoringRef.current = false;

    void queryClient.refetchQueries({
      type: 'active',
      predicate: (query) => query.state.dataUpdatedAt === 0 && query.state.status === 'pending',
    });
  }, [isRestoring, queryClient]);

  return (
    <>
      {children}
      {isRestoring ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <GarboBrandLoader variant="inline" size="md" message="Atualizando dados…" />
        </div>
      ) : null}
    </>
  );
}
