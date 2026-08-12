import { useEffect } from 'react'

/** Intervalo padrão: 60s (antes era 10s e deixava a Agenda “piscando”). */
const DEFAULT_POLL_MS = 60_000

/**
 * Recarrega dados automaticamente:
 * - A cada `intervalMs` em background (padrão 60s)
 * - Imediatamente ao retomar a aba (visibilitychange)
 *
 * Prefira realtime + este poll longo. Poll curto (10s) redesenhava
 * telas pesadas (Agenda) o tempo todo.
 */
export function useAutoRefresh(reload: () => void, intervalMs = DEFAULT_POLL_MS) {
  useEffect(() => {
    if (intervalMs <= 0) return

    const id = setInterval(reload, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload, intervalMs])
}
