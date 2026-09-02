import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useApp } from '@/context/AppContext'
import { useFinanceiroStats, useSaldoMesProximosMeses } from '@/hooks/useFinanceiroDashboard'
import { useMobileLayout } from '@/hooks/useMobileLayout'
import { isAdministrador } from '@/lib/role-access'
import {
  buildSaldoMesInsightMessage,
  loadSaldoMesInsightConfig,
  loadSaldoMesInsightLocked,
  saveSaldoMesInsightConfig,
  saveSaldoMesInsightLocked,
  type SaldoMesForecast,
  type SaldoMesInsightConfig,
  type SaldoMesInsightMessage,
} from '@/lib/saldo-mes-insight'

interface SaldoMesInsightContextValue {
  enabled: boolean
  locked: boolean
  visible: boolean
  exiting: boolean
  isMobile: boolean
  message: SaldoMesInsightMessage | null
  proximosMeses: SaldoMesForecast[]
  proximosLoading: boolean
  forecastOpen: boolean
  config: SaldoMesInsightConfig
  lock: () => void
  unlock: () => void
  dismiss: () => void
  setHolding: (holding: boolean) => void
  setForecastOpen: (open: boolean) => void
  saveConfig: (next: SaldoMesInsightConfig) => void
}

const SaldoMesInsightContext = createContext<SaldoMesInsightContextValue | null>(null)

export function useSaldoMesInsight() {
  const ctx = useContext(SaldoMesInsightContext)
  if (!ctx) throw new Error('useSaldoMesInsight fora do SaldoMesInsightProvider')
  return ctx
}

/** Versão segura para o cabeçalho (pode estar fora do provider em rotas sem insight). */
export function useSaldoMesInsightOptional() {
  return useContext(SaldoMesInsightContext)
}

/**
 * Estado do lembrete de saldo: tipografia flutuante + trava no cabeçalho.
 * Travado = fica no NavigationHeader até destravar; não “desce” sozinho.
 */
export function SaldoMesInsightProvider({ children }: { children: ReactNode }) {
  const { roles } = useApp()
  const isAdmin = isAdministrador(roles)
  const isMobile = useMobileLayout()
  const { data: stats, isSuccess } = useFinanceiroStats()
  const [config, setConfig] = useState<SaldoMesInsightConfig>(() => {
    const loaded = loadSaldoMesInsightConfig()
    if (loaded.durationMs < 5_000) {
      const next = { ...loaded, durationMs: 5_000 }
      saveSaldoMesInsightConfig(next)
      return next
    }
    return loaded
  })
  const [locked, setLocked] = useState(() => loadSaldoMesInsightLocked())
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [holding, setHolding] = useState(false)
  const [forecastOpen, setForecastOpen] = useState(false)
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  )
  const hideTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const visibleRef = useRef(false)
  const holdingRef = useRef(false)
  const lockedRef = useRef(locked)
  const configRef = useRef(config)
  configRef.current = config
  visibleRef.current = visible
  holdingRef.current = holding
  lockedRef.current = locked

  const shouldFetchForecast = visible && forecastOpen && !locked
  const { data: proximosMeses = [], isLoading: proximosLoading } = useSaldoMesProximosMeses(3, {
    enabled: shouldFetchForecast,
  })

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const clearTimers = useCallback(() => {
    clearHideTimer()
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [clearHideTimer])

  const armHideTimer = useCallback(() => {
    clearHideTimer()
    if (holdingRef.current || lockedRef.current) return
    hideTimerRef.current = window.setTimeout(() => {
      if (holdingRef.current || lockedRef.current) return
      setExiting(true)
      exitTimerRef.current = window.setTimeout(() => {
        setVisible(false)
        setExiting(false)
        setForecastOpen(false)
        exitTimerRef.current = null
      }, isMobile ? 180 : 280)
    }, configRef.current.durationMs)
  }, [clearHideTimer, isMobile])

  const dismiss = useCallback(() => {
    if (lockedRef.current) return
    clearTimers()
    setHolding(false)
    setForecastOpen(false)
    setExiting(true)
    exitTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      setExiting(false)
      exitTimerRef.current = null
    }, isMobile ? 180 : 280)
  }, [clearTimers, isMobile])

  const show = useCallback(() => {
    if (lockedRef.current) return
    if (!configRef.current.enabled || !pageVisible) return
    if (visibleRef.current) return
    clearTimers()
    setExiting(false)
    setVisible(true)
    armHideTimer()
  }, [armHideTimer, clearTimers, pageVisible])

  const lock = useCallback(() => {
    clearTimers()
    setLocked(true)
    saveSaldoMesInsightLocked(true)
    setHolding(false)
    setForecastOpen(false)
    setExiting(false)
    setVisible(false)
  }, [clearTimers])

  const unlock = useCallback(() => {
    setLocked(false)
    saveSaldoMesInsightLocked(false)
    clearTimers()
    setExiting(false)
    setVisible(true)
    setHolding(false)
    armHideTimer()
  }, [armHideTimer, clearTimers])

  const saveConfig = useCallback(
    (next: SaldoMesInsightConfig) => {
      saveSaldoMesInsightConfig(next)
      setConfig(next)
      if (!next.enabled) {
        if (lockedRef.current) {
          setLocked(false)
          saveSaldoMesInsightLocked(false)
        }
        dismiss()
      }
    },
    [dismiss],
  )

  useEffect(() => {
    if (!visible || locked) return
    if (holding) {
      clearHideTimer()
      return
    }
    armHideTimer()
  }, [armHideTimer, clearHideTimer, holding, locked, visible])

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!isAdmin || !config.enabled || !isSuccess || !pageVisible || locked) {
      clearTimers()
      if (locked) {
        setVisible(false)
        setExiting(false)
        setForecastOpen(false)
        return
      }
      if (!pageVisible || !config.enabled) {
        setVisible(false)
        setExiting(false)
        setForecastOpen(false)
      }
      return
    }

    const boot = window.setTimeout(() => show(), isMobile ? 1400 : 900)
    const tick = window.setInterval(() => show(), config.intervalMs)

    return () => {
      window.clearTimeout(boot)
      window.clearInterval(tick)
      clearTimers()
    }
  }, [
    clearTimers,
    config.enabled,
    config.intervalMs,
    isAdmin,
    isMobile,
    isSuccess,
    locked,
    pageVisible,
    show,
  ])

  useEffect(() => () => clearTimers(), [clearTimers])

  const message = useMemo(() => {
    if (!stats) return null
    return buildSaldoMesInsightMessage({
      totalAReceber: stats.totalAReceber,
      totalAPagarMes: stats.totalAPagarMes,
    })
  }, [stats])

  const value = useMemo<SaldoMesInsightContextValue>(
    () => ({
      enabled: isAdmin && config.enabled,
      locked: locked && isAdmin,
      visible: visible && !locked,
      exiting,
      isMobile,
      message: isAdmin ? message : null,
      proximosMeses,
      proximosLoading: proximosLoading && shouldFetchForecast,
      forecastOpen,
      config,
      lock,
      unlock,
      dismiss,
      setHolding,
      setForecastOpen,
      saveConfig,
    }),
    [
      config,
      dismiss,
      exiting,
      forecastOpen,
      isAdmin,
      isMobile,
      lock,
      locked,
      message,
      proximosLoading,
      proximosMeses,
      saveConfig,
      shouldFetchForecast,
      unlock,
      visible,
    ],
  )

  return (
    <SaldoMesInsightContext.Provider value={value}>{children}</SaldoMesInsightContext.Provider>
  )
}
