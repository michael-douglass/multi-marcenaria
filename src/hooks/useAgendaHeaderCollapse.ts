import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AGENDA_HEADER_AUTO_INTERVAL_MS,
  AGENDA_HEADER_AUTO_VISIBLE_MS,
  readAgendaHeaderPrefs,
  writeAgendaHeaderLockMode,
  type AgendaHeaderLockMode,
} from '@/lib/agenda-header-prefs-storage'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Controla o cabeçalho da Agenda:
 * - auto: fica fechado e abre sozinho a cada 5s (depois fecha de novo)
 * - open / closed: travado aberto ou fechado (salvo por usuário)
 */
export function useAgendaHeaderCollapse(userId?: string | null) {
  const [lockMode, setLockModeState] = useState<AgendaHeaderLockMode>(
    () => readAgendaHeaderPrefs().lockMode,
  )
  const [autoExpanded, setAutoExpanded] = useState(false)
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  )
  /** Reinicia o ciclo automático após interação manual. */
  const [cycleNonce, setCycleNonce] = useState(0)
  /** Se o próximo ciclo auto deve começar aberto (após clique). */
  const resumeExpandedRef = useRef(false)
  const cycleTimerRef = useRef<number | null>(null)
  const lockModeRef = useRef(lockMode)
  lockModeRef.current = lockMode

  const clearCycleTimer = useCallback(() => {
    if (cycleTimerRef.current != null) {
      window.clearTimeout(cycleTimerRef.current)
      cycleTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    setLockModeState(readAgendaHeaderPrefs(userId).lockMode)
  }, [userId])

  useEffect(() => {
    writeAgendaHeaderLockMode(userId, lockMode)
  }, [userId, lockMode])

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    clearCycleTimer()

    if (lockMode === 'open') {
      setAutoExpanded(true)
      return
    }

    if (lockMode === 'closed') {
      setAutoExpanded(false)
      return
    }

    if (!pageVisible || prefersReducedMotion()) {
      setAutoExpanded(false)
      return
    }

    let cancelled = false
    const startExpanded = resumeExpandedRef.current
    resumeExpandedRef.current = false
    setAutoExpanded(startExpanded)

    const scheduleOpen = () => {
      if (cancelled || lockModeRef.current !== 'auto') return
      cycleTimerRef.current = window.setTimeout(() => {
        if (cancelled || lockModeRef.current !== 'auto') return
        setAutoExpanded(true)
        scheduleClose()
      }, AGENDA_HEADER_AUTO_INTERVAL_MS)
    }

    const scheduleClose = () => {
      if (cancelled || lockModeRef.current !== 'auto') return
      cycleTimerRef.current = window.setTimeout(() => {
        if (cancelled || lockModeRef.current !== 'auto') return
        setAutoExpanded(false)
        scheduleOpen()
      }, AGENDA_HEADER_AUTO_VISIBLE_MS)
    }

    if (startExpanded) scheduleClose()
    else scheduleOpen()

    return () => {
      cancelled = true
      clearCycleTimer()
    }
  }, [clearCycleTimer, cycleNonce, lockMode, pageVisible])

  const setLockMode = useCallback((mode: AgendaHeaderLockMode) => {
    resumeExpandedRef.current = false
    setLockModeState(mode)
    if (mode === 'open') setAutoExpanded(true)
    if (mode === 'closed' || mode === 'auto') setAutoExpanded(false)
    setCycleNonce(n => n + 1)
  }, [])

  /** Clique manual: abre/fecha. Se estiver travado, troca a trava. */
  const toggleManual = useCallback(() => {
    if (lockMode === 'open' || lockMode === 'closed') {
      setLockMode(lockMode === 'open' ? 'closed' : 'open')
      return
    }
    clearCycleTimer()
    setAutoExpanded(prev => {
      const next = !prev
      resumeExpandedRef.current = next
      return next
    })
    setCycleNonce(n => n + 1)
  }, [clearCycleTimer, lockMode, setLockMode])

  const expanded =
    lockMode === 'open' ? true : lockMode === 'closed' ? false : autoExpanded

  return {
    lockMode,
    expanded,
    setLockMode,
    toggleManual,
  }
}
