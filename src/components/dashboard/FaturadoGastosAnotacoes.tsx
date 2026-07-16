import { ArrowDownRight, ArrowUpRight, CalendarClock, Wallet } from 'lucide-react'
import { MONTHS_PT } from '@/lib/date-br'
import { cn, fmtCur } from '@/lib/utils'

export interface MesComparativo {
  mes: string
  receitas: number
  despesas: number
}

interface FaturadoGastosAnotacoesProps {
  ano: number
  data: MesComparativo[]
  /** Previsão do próximo mês (contas a receber pendentes). */
  previsaoRecebimento?: number
  /** Previsão de despesas do próximo mês (contas a pagar em aberto). */
  previsaoDespesas?: number
}

function nomeProximoMes(): { nome: string; ano: number } {
  const agora = new Date()
  const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)
  return {
    nome: MONTHS_PT[proximo.getMonth()],
    ano: proximo.getFullYear(),
  }
}

/** Anotações mês a mês + previsão do próximo mês + caixa acumulado. */
export function FaturadoGastosAnotacoes({
  ano,
  data,
  previsaoRecebimento = 0,
  previsaoDespesas = 0,
}: FaturadoGastosAnotacoesProps) {
  const mesesComMovimento = data.filter(m => m.receitas > 0 || m.despesas > 0)
  const proximo = nomeProximoMes()
  const saldoPrevisao = previsaoRecebimento - previsaoDespesas

  let caixaAcumulado = 0
  const linhas = data.map(m => {
    const saldo = m.receitas - m.despesas
    caixaAcumulado += saldo
    return {
      ...m,
      saldo,
      caixaAposMes: caixaAcumulado,
    }
  })

  // Previsão do próximo mês (ex.: Agosto) já entra no caixa final
  const caixaFinal = caixaAcumulado + saldoPrevisao
  const caixaPositivo = caixaFinal > 0
  const caixaNegativo = caixaFinal < 0

  return (
    <div className="mt-5 space-y-5">
      {/* Previsão do próximo mês */}
      <PrevisaoProximoMesBloco
        nomeMes={proximo.nome}
        anoMes={proximo.ano}
        recebimento={previsaoRecebimento}
        despesas={previsaoDespesas}
        saldo={saldoPrevisao}
      />

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-base tracking-[0.14em] text-[#f2d892]">
            ANOTAÇÕES {ano}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[#edd9c4]/60">
            Por mês · recebidos − gastos
          </p>
        </div>
      </div>

      {mesesComMovimento.length === 0 ? (
        <div className="rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.22)] px-4 py-5 text-center">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#edd9c4]/65">
            Sem movimentos registrados em {ano}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {linhas
            .filter(m => m.receitas > 0 || m.despesas > 0)
            .map((m, i) => {
              const isPos = m.saldo > 0
              const isNeg = m.saldo < 0
              const sinal = isPos ? 'Positivo' : isNeg ? 'Negativo' : 'Zerado'
              const SaldoIcon = isNeg ? ArrowDownRight : ArrowUpRight

              return (
                <article
                  key={m.mes}
                  className={cn(
                    'dash-card-enter relative overflow-hidden rounded-lg border px-3.5 py-3',
                    'border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.28)]',
                    'transition-[border-color,transform] duration-300 hover:border-[rgba(240,210,140,0.28)]',
                  )}
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[2px]"
                    style={{
                      background: isNeg
                        ? 'linear-gradient(180deg, #f87171, rgba(248,113,113,0.15))'
                        : 'linear-gradient(180deg, #34d399, rgba(52,211,153,0.15))',
                    }}
                  />

                  <header className="mb-2.5 flex items-center justify-between gap-2 pl-1">
                    <h4 className="font-display text-lg tracking-[0.08em] text-[#f2d892]">
                      {m.mes}
                    </h4>
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]',
                        isNeg
                          ? 'border-red-400/30 bg-red-500/10 text-red-300'
                          : isPos
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-[rgba(240,210,140,0.25)] bg-[rgba(240,210,140,0.06)] text-[#f2d892]',
                      )}
                    >
                      <SaldoIcon className="h-3 w-3" aria-hidden />
                      {sinal}
                    </span>
                  </header>

                  <dl className="space-y-1.5 pl-1 text-[10px] uppercase tracking-[0.12em]">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[#edd9c4]/70">Recebidos</dt>
                      <dd className="font-semibold tabular-nums text-[#c8f0d8]">{fmtCur(m.receitas)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[#edd9c4]/70">Gastos</dt>
                      <dd className="font-semibold tabular-nums text-[#f0c4b0]">− {fmtCur(m.despesas)}</dd>
                    </div>
                    <div
                      className="my-1.5 h-px"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent, rgba(240,210,140,0.3) 30%, rgba(240,210,140,0.3) 70%, transparent)',
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[#edd9c4]/80">Saldo final</dt>
                      <dd
                        className={cn(
                          'font-display text-base tracking-wide tabular-nums',
                          isNeg ? 'text-red-400' : 'text-emerald-400',
                        )}
                      >
                        {fmtCur(m.saldo)}
                      </dd>
                    </div>
                  </dl>
                </article>
              )
            })}
        </div>
      )}

      {/* Situação do caixa (acumulado do ano) */}
      {mesesComMovimento.length > 0 && (
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border px-4 py-4 sm:px-5',
            caixaNegativo
              ? 'border-red-400/25 bg-red-950/20'
              : caixaPositivo
                ? 'border-emerald-400/25 bg-emerald-950/15'
                : 'border-[rgba(240,210,140,0.2)] bg-[rgba(242,216,146,0.05)]',
          )}
          role="status"
          aria-label={`Situação do caixa em ${ano}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-40 blur-2xl"
            style={{
              background: caixaNegativo
                ? 'radial-gradient(circle, rgba(248,113,113,0.4), transparent 70%)'
                : 'radial-gradient(circle, rgba(52,211,153,0.35), transparent 70%)',
            }}
          />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(0,0,0,0.25)]">
                <Wallet className="h-4 w-4 text-[#f2d892]" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#edd9c4]/75">
                  Como está o caixa · {ano}
                </p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[#edd9c4]/80">
                  Meses + previsão de {proximo.nome}
                  {caixaPositivo && ' · caixa no azul.'}
                  {caixaNegativo && ' · caixa no vermelho.'}
                  {!caixaPositivo && !caixaNegativo && ' · caixa zerado.'}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                  caixaNegativo
                    ? 'border-red-400/30 bg-red-500/10 text-red-300'
                    : caixaPositivo
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-[rgba(240,210,140,0.25)] text-[#f2d892]',
                )}
              >
                {caixaNegativo ? (
                  <ArrowDownRight className="h-3 w-3" aria-hidden />
                ) : (
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                )}
                {caixaPositivo ? 'Positivo' : caixaNegativo ? 'Negativo' : 'Zerado'}
              </p>
              <p
                className={cn(
                  'mt-1.5 font-display text-2xl tracking-[0.04em] tabular-nums sm:text-3xl',
                  caixaNegativo ? 'text-red-400' : 'text-emerald-400',
                )}
              >
                {fmtCur(caixaFinal)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PrevisaoProximoMesBloco({
  nomeMes,
  anoMes,
  recebimento,
  despesas,
  saldo,
}: {
  nomeMes: string
  anoMes: number
  recebimento: number
  despesas: number
  saldo: number
}) {
  const isPos = saldo > 0
  const isNeg = saldo < 0
  const sinal = isPos ? 'Positivo' : isNeg ? 'Negativo' : 'Zerado'
  const SaldoIcon = isNeg ? ArrowDownRight : ArrowUpRight

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border px-4 py-4 sm:px-5',
        'border-[rgba(240,210,140,0.22)] bg-[rgba(242,216,146,0.06)]',
      )}
      role="region"
      aria-label={`Previsão de ${nomeMes} ${anoMes}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-50 blur-2xl"
        style={{
          background: isNeg
            ? 'radial-gradient(circle, rgba(248,113,113,0.35), transparent 70%)'
            : 'radial-gradient(circle, rgba(242,216,146,0.35), transparent 70%)',
        }}
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.25)] bg-[rgba(0,0,0,0.28)]">
            <CalendarClock className="h-4 w-4 text-[#f2d892]" aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#edd9c4]/70">
              Previsão do próximo mês
            </p>
            <p className="font-display text-2xl tracking-[0.08em] text-[#f2d892]">
              {nomeMes.toUpperCase()} {anoMes}
            </p>
            <p className="mt-1 text-xs text-[#edd9c4]/70">
              Contas a receber e a pagar com vencimento em {nomeMes}.
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-xl">
          <div className="rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#edd9c4]/65">Recebimento</p>
            <p className="mt-1 font-display text-lg tabular-nums tracking-wide text-[#c8f0d8]">
              {fmtCur(recebimento)}
            </p>
          </div>
          <div className="rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#edd9c4]/65">Despesas</p>
            <p className="mt-1 font-display text-lg tabular-nums tracking-wide text-[#f0c4b0]">
              − {fmtCur(despesas)}
            </p>
          </div>
          <div
            className={cn(
              'rounded-lg border px-3 py-2.5',
              isNeg
                ? 'border-red-400/25 bg-red-950/25'
                : 'border-emerald-400/25 bg-emerald-950/20',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] uppercase tracking-[0.14em] text-[#edd9c4]/65">Saldo previsto</p>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]',
                  isNeg
                    ? 'border-red-400/30 bg-red-500/10 text-red-300'
                    : isPos
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-[rgba(240,210,140,0.25)] text-[#f2d892]',
                )}
              >
                <SaldoIcon className="h-2.5 w-2.5" aria-hidden />
                {sinal}
              </span>
            </div>
            <p
              className={cn(
                'mt-1 font-display text-lg tabular-nums tracking-wide',
                isNeg ? 'text-red-400' : 'text-emerald-400',
              )}
            >
              {fmtCur(saldo)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
