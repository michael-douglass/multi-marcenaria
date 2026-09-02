import { SaldoMesInsightCard } from '@/components/dashboard/SaldoMesInsightCard'
import { useSaldoMesInsight } from '@/context/SaldoMesInsightContext'

/**
 * Lembrete flutuante do saldo do mês — só aparece quando não está travado no cabeçalho.
 */
export function SaldoMesInsightHost() {
  const {
    enabled,
    message,
    proximosMeses,
    proximosLoading,
    config,
    visible,
    exiting,
    isMobile,
    locked,
    dismiss,
    lock,
    setHolding,
    setForecastOpen,
    saveConfig,
  } = useSaldoMesInsight()

  if (!enabled || locked || !message) return null

  return (
    <SaldoMesInsightCard
      message={message}
      proximosMeses={proximosMeses}
      proximosLoading={proximosLoading}
      config={config}
      visible={visible}
      exiting={exiting}
      isMobile={isMobile}
      onDismiss={dismiss}
      onLock={lock}
      onHoldChange={setHolding}
      onForecastOpenChange={setForecastOpen}
      onSaveConfig={saveConfig}
    />
  )
}
