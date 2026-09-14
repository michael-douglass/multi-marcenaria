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

interface UseAgendaHeaderCollapseOptions {
  /**
   * Quando false, o modo "auto" não sobe/desce sozinho (ex.: Filas / Calendário).
   * Preferência do usuário continua salva; o ciclo só roda no Kanban.
   */
  autoCycleEnabled?: boolean
}

/**
 * Controla o cabeçalho da Agenda:
 * - auto: fica fechado e abre sozinho a cada 5s (depois fecha de novo) — só se autoCycleEnabled
 * - open / closed: travado aberto ou fechado (salvo por usuário)
 */
export function useAgendaHeaderCollapse(
  userId?: string | null,
  options?: UseAgendaHeaderCollapseOptions,
) {
  const autoCycleEnabled = options?.autoCycleEnabled !== false
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
  const autoCycleEnabledRef = useRef(autoCycleEnabled)
  autoCycleEnabledRef.current = autoCycleEnabled

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

    // Fora do Kanban: pausa o timer e deixa abrir/fechar só na mão.
    if (!autoCycleEnabled) {
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
      if (cancelled || lockModeRef.current !== 'auto' || !autoCycleEnabledRef.current) return
      cycleTimerRef.current = window.setTimeout(() => {
        if (cancelled || lockModeRef.current !== 'auto' || !autoCycleEnabledRef.current) return
        setAutoExpanded(true)
        scheduleClose()
      }, AGENDA_HEADER_AUTO_INTERVAL_MS)
    }

    const scheduleClose = () => {
      if (cancelled || lockModeRef.current !== 'auto' || !autoCycleEnabledRef.current) return
      cycleTimerRef.current = window.setTimeout(() => {
        if (cancelled || lockModeRef.current !== 'auto' || !autoCycleEnabledRef.current) return
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
  }, [autoCycleEnabled, clearCycleTimer, cycleNonce, lockMode, pageVisible])

  // Ao sair do Kanban, para o sobe/desce e fecha o painel uma vez.
  useEffect(() => {
    if (autoCycleEnabled) return
    clearCycleTimer()
    if (lockModeRef.current === 'auto') {
      resumeExpandedRef.current = false
      setAutoExpanded(false)
    }
  }, [autoCycleEnabled, clearCycleTimer])

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
    // Em Filas/Calendário o auto está pausado: só abre/fecha na mão.
    if (!autoCycleEnabledRef.current) {
      setAutoExpanded(prev => !prev)
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
    /** true só quando o ciclo de 5s está realmente ativo nesta tela */
    autoCycleActive: lockMode === 'auto' && autoCycleEnabled,
    setLockMode,
    toggleManual,
  }
}
