import { useEffect } from 'react'

const POLL_MS = 10_000

/**
 * Recarrega dados automaticamente:
 * - A cada POLL_MS milissegundos em background
 * - Imediatamente ao retomar a aba (visibilitychange)
 */
export function useAutoRefresh(reload: () => void) {
  useEffect(() => {
    const id = setInterval(reload, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])
}
