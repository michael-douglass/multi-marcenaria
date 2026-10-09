import { useEffect } from 'react'
import { FLOATING_TOP_OFFSET_VAR } from '@/lib/floating-ui-layout'

/**
 * Empurra a faixa de ícones flutuantes (Agenda, Chat, Saldo) para baixo enquanto
 * a página estiver montada — para páginas com botão fixo próprio no canto superior direito.
 */
export function useFloatingTopOffset(offset: string) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty(FLOATING_TOP_OFFSET_VAR, offset)
    return () => {
      root.style.removeProperty(FLOATING_TOP_OFFSET_VAR)
    }
  }, [offset])
}
