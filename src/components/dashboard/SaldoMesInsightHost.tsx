import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SaldoMesInsightCard } from '@/components/dashboard/SaldoMesInsightCard'
import { useApp } from '@/context/AppContext'
import { useFinanceiroStats, useSaldoMesProximosMeses } from '@/hooks/useFinanceiroDashboard'
import { useMobileLayout } from '@/hooks/useMobileLayout'
import { isAdministrador } from '@/lib/role-access'
import {
  buildSaldoMesInsightMessage,
  loadSaldoMesInsightConfig,
  saveSaldoMesInsightConfig,
  type SaldoMesInsightConfig,
} from '@/lib/saldo-mes-insight'

/**
 * Lembrete flutuante do saldo do mês — só para Administrador.
 * Otimizado para celular: menos refetch, shader leve, toque estável.
 */
export function SaldoMesInsightHost() {
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
  const configRef = useRef(config)
  configRef.current = config
  visibleRef.current = visible
  holdingRef.current = holding

  const shouldFetchForecast = visible && forecastOpen
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
    if (holdingRef.current) return
    hideTimerRef.current = window.setTimeout(() => {
      if (holdingRef.current) return
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
    if (!configRef.current.enabled || !pageVisible) return
    if (visibleRef.current) return
    clearTimers()
    setExiting(false)
    setVisible(true)
    armHideTimer()
  }, [armHideTimer, clearTimers, pageVisible])

  useEffect(() => {
    if (!visible) return
    if (holding) {
      clearHideTimer()
      return
    }
    armHideTimer()
  }, [armHideTimer, clearHideTimer, holding, visible])

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!isAdmin || !config.enabled || !isSuccess || !pageVisible) {
      clearTimers()
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

  if (!isAdmin || !stats || !message) return null

  return (
    <SaldoMesInsightCard
      message={message}
      proximosMeses={proximosMeses}
      proximosLoading={proximosLoading && shouldFetchForecast}
      config={config}
      visible={visible}
      exiting={exiting}
      isMobile={isMobile}
      onDismiss={dismiss}
      onHoldChange={setHolding}
      onForecastOpenChange={setForecastOpen}
      onSaveConfig={next => {
        saveSaldoMesInsightConfig(next)
        setConfig(next)
        if (!next.enabled) dismiss()
      }}
    />
  )
}
