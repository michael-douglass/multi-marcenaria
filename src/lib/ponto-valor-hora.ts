/**
 * Sugestão de valor/hora a partir do fixo mensal e da jornada.
 * fórmula: fixo ÷ (dias úteis do mês × horas da jornada no dia)
 */

/** Conta quantos dias do mês (YYYY-MM) caem nos ISODOW informados (1=seg … 7=dom). */
export function contarDiasUteisNoMes(
  yyyyMm: string,
  diasUteisIso: number[] | null | undefined,
): number {
  const dias =
    diasUteisIso && diasUteisIso.length > 0 ? diasUteisIso : [1, 2, 3, 4, 5]
  const set = new Set(dias)
  const [y, m] = yyyyMm.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return 0
  const ultimo = new Date(y, m, 0).getDate()
  let count = 0
  for (let d = 1; d <= ultimo; d++) {
    // getDay: 0=dom … 6=sáb → ISODOW: 1=seg … 7=dom
    const js = new Date(y, m - 1, d).getDay()
    const iso = js === 0 ? 7 : js
    if (set.has(iso)) count += 1
  }
  return count
}

export interface SugerirValorHoraInput {
  valorFixoMensal: number
  /** Minutos líquidos de um dia típico de jornada. */
  minutosJornadaDia: number
  /** Mês de referência YYYY-MM (padrão: mês atual local). */
  mesRef?: string
  diasUteisIso?: number[] | null
}

/**
 * Retorna R$/hora sugerido (arredondado a 2 casas) ou 0 se não houver base.
 */
export function sugerirValorHora(input: SugerirValorHoraInput): number {
  const fixo = Math.max(0, Number(input.valorFixoMensal) || 0)
  const minDia = Math.max(0, Math.floor(Number(input.minutosJornadaDia) || 0))
  if (fixo <= 0 || minDia <= 0) return 0

  const mes =
    input.mesRef && /^\d{4}-\d{2}$/.test(input.mesRef)
      ? input.mesRef
      : (() => {
          const n = new Date()
          return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
        })()

  const diasMes = contarDiasUteisNoMes(mes, input.diasUteisIso)
  if (diasMes <= 0) return 0

  const horasMes = diasMes * (minDia / 60)
  if (horasMes <= 0) return 0

  return Math.round((fixo / horasMes) * 100) / 100
}

/** Minutos → fração de dias de jornada (ex.: 480 min / 480 = 1 dia). */
export function minutosParaDiasEquivalentes(
  minutos: number,
  minutosJornadaDia: number,
): number {
  const min = Number(minutos) || 0
  const dia = Math.max(0, Math.floor(Number(minutosJornadaDia) || 0))
  if (dia <= 0) return 0
  return Math.round((min / dia) * 100) / 100
}

export function formatDiasEquivalentes(dias: number): string {
  if (!Number.isFinite(dias) || dias === 0) return '0 dias'
  const abs = Math.abs(dias)
  const texto = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  const label = abs === 1 ? 'dia' : 'dias'
  return dias < 0 ? `≈ −${texto} ${label}` : `≈ ${texto} ${label}`
}

/** Valor em R$ para N minutos × valor/hora. */
export function valorPagamentoHoras(minutos: number, valorHora: number): number {
  const min = Math.max(0, Math.floor(Number(minutos) || 0))
  const vh = Math.max(0, Number(valorHora) || 0)
  return Math.round((min / 60) * vh * 100) / 100
}
