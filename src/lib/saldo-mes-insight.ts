import { fmtCur } from '@/lib/utils'

/** Limiares em reais: “menos de 40 mil” / “mais de 60 mil”. */
export const SALDO_MES_LIMITE_QUASE = 40_000
export const SALDO_MES_LIMITE_ALERTA = 60_000

export const SALDO_MES_INSIGHT_DEFAULTS = {
  /** A cada quanto o card desce (ms). Padrão: 5 minutos. */
  intervalMs: 5 * 60 * 1000,
  /** Quanto tempo fica visível (ms). Padrão: 5 segundos. */
  durationMs: 5 * 1000,
  enabled: true,
} as const

export type SaldoMesInsightTone = 'quase' | 'falta' | 'alerta' | 'sucesso'

export interface SaldoMesInsightMessage {
  tone: SaldoMesInsightTone
  /** Linha principal curta (ex.: “Faltam”, “Você está um sucesso!”). */
  headline: string
  /** Texto de apoio; pode incluir o valor formatado. */
  detail: string
  /** Valor em destaque no card (quando aplicável). Null = só palavras. */
  valorDestaque: number | null
  /** A receber − a pagar do mês. */
  saldo: number
  totalAReceber: number
  totalAPagarMes: number
}

export interface SaldoMesInsightConfig {
  intervalMs: number
  durationMs: number
  enabled: boolean
}

/** Previsão mensal: a receber − a pagar (mesma regra do dashboard). */
export interface SaldoMesForecast {
  /** Ex.: Out/2026 */
  label: string
  mesCurto: string
  ano: number
  totalAReceber: number
  totalAPagarMes: number
  saldo: number
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

export function buildSaldoMesForecast(input: {
  mesIndex: number
  ano: number
  totalAReceber: number
  totalAPagarMes: number
}): SaldoMesForecast {
  const totalAReceber = roundMoney(Number(input.totalAReceber) || 0)
  const totalAPagarMes = roundMoney(Number(input.totalAPagarMes) || 0)
  const mesCurto = MESES_CURTOS[input.mesIndex] ?? '—'
  return {
    label: `${mesCurto}/${input.ano}`,
    mesCurto,
    ano: input.ano,
    totalAReceber,
    totalAPagarMes,
    saldo: roundMoney(totalAReceber - totalAPagarMes),
  }
}

export function resolveSaldoMesForecastTone(saldo: number): SaldoMesInsightTone {
  return resolveSaldoMesInsightTone(saldo)
}

const STORAGE_KEY = 'garbo.saldo-mes-insight.config'

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * Decide o tom do card só pelo saldo (a receber − a pagar).
 * Exportada pura para facilitar testes sem React.
 */
export function resolveSaldoMesInsightTone(saldo: number): SaldoMesInsightTone {
  if (saldo >= 0) return 'sucesso'
  const falta = Math.abs(saldo)
  if (falta < SALDO_MES_LIMITE_QUASE) return 'quase'
  if (falta > SALDO_MES_LIMITE_ALERTA) return 'alerta'
  return 'falta'
}

/**
 * Monta o texto do card a partir do saldo do mês (a receber − a pagar).
 *
 * - saldo ≥ 0 → sucesso + previsão de faturamento (a receber)
 * - falta &lt; 40 mil → “Falta pouco” + valor em destaque
 * - falta entre 40 e 60 mil → “Faltam …” + valor
 * - falta &gt; 60 mil → “Ainda falta …” + valor
 *
 * Sempre que faltar dinheiro, o valor absoluto aparece no card.
 */
export function buildSaldoMesInsightMessage(input: {
  totalAReceber: number
  totalAPagarMes: number
}): SaldoMesInsightMessage {
  const totalAReceber = roundMoney(Number(input.totalAReceber) || 0)
  const totalAPagarMes = roundMoney(Number(input.totalAPagarMes) || 0)
  const saldo = roundMoney(totalAReceber - totalAPagarMes)
  const tone = resolveSaldoMesInsightTone(saldo)

  if (tone === 'sucesso') {
    return {
      tone,
      headline: 'Você está um sucesso!',
      detail: `A previsão é para o caixa passar ${fmtCur(totalAReceber)} em faturamento.`,
      valorDestaque: totalAReceber,
      saldo,
      totalAReceber,
      totalAPagarMes,
    }
  }

  const falta = Math.abs(saldo)

  if (tone === 'quase') {
    return {
      tone,
      headline: 'Falta pouco',
      detail: `${fmtCur(falta)} para fechar o mês.`,
      valorDestaque: falta,
      saldo,
      totalAReceber,
      totalAPagarMes,
    }
  }

  if (tone === 'alerta') {
    return {
      tone,
      headline: 'Ainda falta',
      detail: `${fmtCur(falta)} para fechar o mês.`,
      valorDestaque: falta,
      saldo,
      totalAReceber,
      totalAPagarMes,
    }
  }

  return {
    tone,
    headline: 'Faltam',
    detail: `${fmtCur(falta)} para fechar o mês.`,
    valorDestaque: falta,
    saldo,
    totalAReceber,
    totalAPagarMes,
  }
}

export function clampSaldoMesInsightConfig(
  partial: Partial<SaldoMesInsightConfig>,
): SaldoMesInsightConfig {
  const intervalMs = Math.min(
    60 * 60 * 1000,
    Math.max(30_000, Number(partial.intervalMs) || SALDO_MES_INSIGHT_DEFAULTS.intervalMs),
  )
  const durationMs = Math.min(
    60_000,
    Math.max(2_000, Number(partial.durationMs) || SALDO_MES_INSIGHT_DEFAULTS.durationMs),
  )
  return {
    intervalMs,
    durationMs,
    enabled: partial.enabled ?? SALDO_MES_INSIGHT_DEFAULTS.enabled,
  }
}

export function loadSaldoMesInsightConfig(): SaldoMesInsightConfig {
  if (typeof window === 'undefined') {
    return { ...SALDO_MES_INSIGHT_DEFAULTS }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...SALDO_MES_INSIGHT_DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<SaldoMesInsightConfig>
    return clampSaldoMesInsightConfig(parsed)
  } catch {
    return { ...SALDO_MES_INSIGHT_DEFAULTS }
  }
}

export function saveSaldoMesInsightConfig(config: SaldoMesInsightConfig): void {
  if (typeof window === 'undefined') return
  const next = clampSaldoMesInsightConfig(config)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000)
}

export function msToSeconds(ms: number): number {
  return Math.round(ms / 1000)
}

export function minutesToMs(min: number): number {
  return Math.round(min * 60_000)
}

export function secondsToMs(sec: number): number {
  return Math.round(sec * 1000)
}
