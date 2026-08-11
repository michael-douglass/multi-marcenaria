import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarClock, Scale } from 'lucide-react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardCardShell, type DashboardAccent } from '@/components/dashboard/DashboardCardShell'
import { cn, fmtCur } from '@/lib/utils'

interface SaldoComparativoCardProps {
  title: string
  subtitle: string
  valorPrincipal: number
  labelEntrada: string
  valorEntrada: number
  labelSaida: string
  valorSaida: number
  saldo: number
  icon?: LucideIcon
  ariaSaldoLabel?: string
  accent?: DashboardAccent
  className?: string
  style?: CSSProperties
}

/** Card com valor principal + mini-balanço (entrada − saída) e selo positivo/negativo. */
export function SaldoComparativoCard({
  title,
  subtitle,
  valorPrincipal,
  labelEntrada,
  valorEntrada,
  labelSaida,
  valorSaida,
  saldo,
  icon: Icon = Scale,
  ariaSaldoLabel = 'Saldo: entrada menos saída',
  accent,
  className,
  style,
}: SaldoComparativoCardProps) {
  const isPositivo = saldo > 0
  const isNegativo = saldo < 0
  const sinal = isPositivo ? 'Positivo' : isNegativo ? 'Negativo' : 'Zerado'
  const SaldoIcon = isNegativo ? ArrowDownRight : ArrowUpRight
  const resolvedAccent: DashboardAccent = accent ?? (isNegativo ? 'rose' : 'emerald')

  return (
    <DashboardCardShell accent={resolvedAccent} className={className} style={style}>
      <CardHeader className="relative flex flex-row items-start justify-between space-y-0 px-5 pb-2 pt-5">
        <div className="min-w-0 space-y-1 pr-2">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#edd9c4]">
            {title}
          </CardTitle>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#edd9c4]/70">
            {subtitle}
          </p>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.18)] bg-[rgba(0,0,0,0.2)]"
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5 text-[#f2d892]" />
        </div>
      </CardHeader>

      <CardContent className="relative space-y-3 px-5 pb-5 pt-0">
        <div className="font-display text-[1.85rem] leading-none tracking-[0.04em] tabular-nums text-emerald-400">
          {fmtCur(valorPrincipal)}
        </div>

        <div
          className="rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.28)] px-3 py-2.5"
          role="group"
          aria-label={ariaSaldoLabel}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em]">
            <span className="text-[#edd9c4]/75">{labelEntrada}</span>
            <span className="font-semibold tabular-nums text-[#c8f0d8]">{fmtCur(valorEntrada)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em]">
            <span className="text-[#edd9c4]/75">{labelSaida}</span>
            <span className="font-semibold tabular-nums text-[#f0c4b0]">− {fmtCur(valorSaida)}</span>
          </div>

          <div
            className="my-2 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(240,210,140,0.35) 40%, rgba(240,210,140,0.35) 60%, transparent 100%)',
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                isNegativo
                  ? 'border-red-400/30 bg-red-500/10 text-red-300'
                  : isPositivo
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-[rgba(240,210,140,0.25)] bg-[rgba(240,210,140,0.06)] text-[#f2d892]',
              )}
            >
              <SaldoIcon className="h-3 w-3" aria-hidden />
              {sinal}
            </span>
            <span
              className={cn(
                'font-display text-lg leading-none tracking-[0.03em] tabular-nums',
                isNegativo ? 'text-red-400' : 'text-emerald-400',
              )}
            >
              {fmtCur(saldo)}
            </span>
          </div>
        </div>
      </CardContent>
    </DashboardCardShell>
  )
}

export function SaldoMesReceberCard({
  totalAReceber,
  totalAPagarMes,
  className,
  style,
}: {
  totalAReceber: number
  totalAPagarMes: number
  className?: string
  style?: CSSProperties
}) {
  const saldo = totalAReceber - totalAPagarMes
  return (
    <SaldoComparativoCard
      title="A Receber Este Mês"
      subtitle="Parcelas vencendo no mês"
      valorPrincipal={totalAReceber}
      labelEntrada="A receber"
      valorEntrada={totalAReceber}
      labelSaida="A pagar"
      valorSaida={totalAPagarMes}
      saldo={saldo}
      icon={Scale}
      ariaSaldoLabel="Saldo do mês: a receber menos a pagar"
      className={className}
      style={style}
    />
  )
}

export function PrevisaoProximoMesCard({
  previsaoRecebimento,
  previsaoDespesas,
  className,
  style,
}: {
  previsaoRecebimento: number
  previsaoDespesas: number
  className?: string
  style?: CSSProperties
}) {
  const saldo = previsaoRecebimento - previsaoDespesas
  return (
    <SaldoComparativoCard
      title="Previsão Próx. Mês"
      subtitle="Parcelas vencendo no próximo mês"
      valorPrincipal={previsaoRecebimento}
      labelEntrada="A receber"
      valorEntrada={previsaoRecebimento}
      labelSaida="A pagar"
      valorSaida={previsaoDespesas}
      saldo={saldo}
      icon={CalendarClock}
      ariaSaldoLabel="Saldo previsto: a receber menos a pagar"
      className={className}
      style={style}
    />
  )
}
