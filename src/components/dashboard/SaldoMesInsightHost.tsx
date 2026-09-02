import { useCallback, useEffect, useRef, useState } from 'react'
import { SaldoMesInsightCard } from '@/components/dashboard/SaldoMesInsightCard'
import { useApp } from '@/context/AppContext'
import { useFinanceiroStats } from '@/hooks/useFinanceiroDashboard'
import { isAdministrador } from '@/lib/role-access'
import {
  buildSaldoMesInsightMessage,
  loadSaldoMesInsightConfig,
  saveSaldoMesInsightConfig,
  type SaldoMesInsightConfig,
} from '@/lib/saldo-mes-insight'

/**
 * Lembrete flutuante do saldo do mês — só para Administrador.
 * Desce do canto superior direito, fica alguns segundos e some;
 * o intervalo e a duração vêm da config salva no próprio card.
 */
export function SaldoMesInsightHost() {
  const { roles } = useApp()
  const isAdmin = isAdministrador(roles)
  const { data: stats, isSuccess } = useFinanceiroStats()
  const [config, setConfig] = useState<SaldoMesInsightConfig>(() => {
    // Garante 5 segundos na primeira carga desta versão (evita config antiga curta demais).
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
  const hideTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const visibleRef = useRef(false)
  const holdingRef = useRef(false)
  const configRef = useRef(config)
  configRef.current = config
  visibleRef.current = visible
  holdingRef.current = holding

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
        exitTimerRef.current = null
      }, 280)
    }, configRef.current.durationMs)
  }, [clearHideTimer])

  const dismiss = useCallback(() => {
    clearTimers()
    setHolding(false)
    setExiting(true)
    exitTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      setExiting(false)
      exitTimerRef.current = null
    }, 280)
  }, [clearTimers])

  const show = useCallback(() => {
    if (!configRef.current.enabled) return
    if (visibleRef.current) return
    clearTimers()
    setExiting(false)
    setVisible(true)
    armHideTimer()
  }, [armHideTimer, clearTimers])

  useEffect(() => {
    if (!visible) return
    if (holding) {
      clearHideTimer()
      return
    }
    armHideTimer()
  }, [armHideTimer, clearHideTimer, holding, visible])

  useEffect(() => {
    if (!isAdmin || !config.enabled || !isSuccess) {
      clearTimers()
      setVisible(false)
      setExiting(false)
      return
    }

    // Primeira aparição logo após os números do mês estarem prontos.
    const boot = window.setTimeout(() => show(), 900)
    const tick = window.setInterval(() => show(), config.intervalMs)

    return () => {
      window.clearTimeout(boot)
      window.clearInterval(tick)
      clearTimers()
    }
  }, [clearTimers, config.enabled, config.intervalMs, isAdmin, isSuccess, show])

  useEffect(() => () => clearTimers(), [clearTimers])

  if (!isAdmin || !stats) return null

  const message = buildSaldoMesInsightMessage({
    totalAReceber: stats.totalAReceber,
    totalAPagarMes: stats.totalAPagarMes,
  })

  return (
    <SaldoMesInsightCard
      message={message}
      config={config}
      visible={visible}
      exiting={exiting}
      onDismiss={dismiss}
      onHoldChange={setHolding}
      onSaveConfig={next => {
        saveSaldoMesInsightConfig(next)
        setConfig(next)
        if (!next.enabled) dismiss()
      }}
    />
  )
}
