import { useEffect, useRef } from 'react'
import {
  VISIBILITY_DEBOUNCE_MS,
  VISIBILITY_RELOAD_MIN_MS,
  shouldReloadOnVisible,
} from '../lib/refresh-policy'

/** Intervalo padrão: 60s (antes era 10s e deixava a Agenda “piscando”). */
const DEFAULT_POLL_MS = 60_000

/**
 * Recarrega dados automaticamente, sem tempestade no iPhone:
 * - A cada `intervalMs` só com a aba visível (padrão 60s)
 * - Ao voltar para a aba, só se os dados já estão velhos (~45s)
 *
 * Mudanças ao vivo continuam no realtime (não passam por aqui).
 */
export function useAutoRefresh(reload: () => void, intervalMs = DEFAULT_POLL_MS) {
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const lastReloadAtRef = useRef(Date.now())

  useEffect(() => {
    if (intervalMs <= 0) return

    let visibilityTimer: number | null = null

    const runReload = () => {
      lastReloadAtRef.current = Date.now()
      reloadRef.current()
    }

    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (
        !shouldReloadOnVisible({
          now: Date.now(),
          lastReloadAt: lastReloadAtRef.current,
          visibilityState: 'visible',
          minIntervalMs: intervalMs,
        })
      ) {
        return
      }
      runReload()
    }, intervalMs)

    const scheduleIfStale = () => {
      if (
        !shouldReloadOnVisible({
          now: Date.now(),
          lastReloadAt: lastReloadAtRef.current,
          visibilityState: document.visibilityState,
          minIntervalMs: VISIBILITY_RELOAD_MIN_MS,
        })
      ) {
        return
      }
      runReload()
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (visibilityTimer) window.clearTimeout(visibilityTimer)
      visibilityTimer = window.setTimeout(scheduleIfStale, VISIBILITY_DEBOUNCE_MS)
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      onVisible()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      window.clearInterval(id)
      if (visibilityTimer) window.clearTimeout(visibilityTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [intervalMs])
}
