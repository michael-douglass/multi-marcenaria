import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { FileDown, Loader2 } from 'lucide-react'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import {
  formatMinutosComSinal,
  formatMinutosHoraExtra,
  formatMinutosSaldo,
} from '@/lib/funcionario-ponto'
import {
  imprimirResumoPontoPdf,
  montarDiasResumoPonto,
  calcularBalancoResumoPonto,
  resolverFaltasDetalhe,
} from '@/lib/resumo-ponto-pdf'
import type { PontoResumoFuncionarioPeriodo } from '@/types'

interface ResumoPontoFuncionarioCardProps {
  row: PontoResumoFuncionarioPeriodo
  index: number
  periodoLabel: string
  intervaloLabel: string
  repCnpj?: string | null
}

const CARD_CLASS =
  'resumo-ponto-card group relative block overflow-hidden rounded-2xl ' +
  'border border-[rgba(26,16,12,0.12)] bg-[#fffdf9] shadow-[0_12px_28px_rgba(42,24,18,0.06)] ' +
  'transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(107,63,18,0.28)] ' +
  'hover:shadow-[0_18px_36px_rgba(42,24,18,0.1)] focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[rgba(107,63,18,0.35)]'

const BADGE_HE =
  'rounded-full border border-[#92400e]/30 bg-[#fff7ed] px-2.5 py-0.5 ' +
  'text-[0.65rem] font-semibold uppercase tracking-wider text-[#92400e]'

const BADGE_ATRASO =
  'rounded-full border border-[#9f1239]/30 bg-[#fff1f2] px-2.5 py-0.5 ' +
  'text-[0.65rem] font-semibold uppercase tracking-wider text-[#9f1239]'

const BADGE_FALTA_ON =
  'rounded-full border border-[#9f1239]/35 bg-[#fde8ec] px-2.5 py-0.5 ' +
  'text-[0.65rem] font-semibold uppercase tracking-wider text-[#9f1239]'

const BADGE_FALTA_OFF =
  'rounded-full border border-[#146c38]/30 bg-[#edf8f1] px-2.5 py-0.5 ' +
  'text-[0.65rem] font-semibold uppercase tracking-wider text-[#146c38]'

const TH =
  'px-2 py-2 text-center font-semibold text-[0.6rem] uppercase tracking-wider text-[#6b5244]'

const TD_HORA = 'px-2 py-1.5 text-center tabular-nums text-[#1a100c]'

function formatDataCurta(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function CellHora({ valor }: { valor: string | null }) {
  return (
    <td className={TD_HORA}>
      {valor ?? <span className="text-[#9a8170]">-</span>}
    </td>
  )
}

function saldoTone(status: 'positivo' | 'negativo' | 'zerado'): string {
  if (status === 'positivo') {
    return 'border-[#146c38]/30 bg-[#edf8f1] text-[#146c38]'
  }
  if (status === 'negativo') {
    return 'border-[#9f1239]/30 bg-[#fff1f2] text-[#9f1239]'
  }
  return 'border-[rgba(26,16,12,0.14)] bg-[#f7efe4] text-[#6b3f12]'
}

function saldoTitulo(status: 'positivo' | 'negativo' | 'zerado'): string {
  if (status === 'positivo') return 'Saldo positivo'
  if (status === 'negativo') return 'Saldo negativo'
  return 'Saldo zerado'
}

export function ResumoPontoFuncionarioCard({
  row,
  index,
  periodoLabel,
  intervaloLabel,
  repCnpj,
}: ResumoPontoFuncionarioCardProps) {
  const [exportando, setExportando] = useState(false)
  const temFaltas = row.faltas_datas.length > 0
  const dias = montarDiasResumoPonto(row)
  const balanco = calcularBalancoResumoPonto(row)
  const faltasDetalhe = resolverFaltasDetalhe(row)
  const pastaUrl = '/funcionarios/' + row.funcionario_id + '?tab=ponto'

  async function exportarPdf(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (exportando) return
    setExportando(true)
    try {
      imprimirResumoPontoPdf({
        row,
        periodoLabel,
        intervaloLabel,
        repCnpj,
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Não foi possível exportar o PDF.')
    } finally {
      window.setTimeout(() => setExportando(false), 800)
    }
  }

  return (
    <article
      className="resumo-ponto-card-wrap flex flex-col gap-2"
      style={{ animationDelay: index * 70 + 'ms' }}
    >
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={(e) => void exportarPdf(e)}
          disabled={exportando}
          title="Exportar resumo de ponto em PDF timbrado com a logo da empresa"
          aria-label={`Exportar resumo de ponto de ${row.nome} em PDF`}
          className={
            'resumo-ponto-export-btn inline-flex items-center gap-1.5 rounded-lg border ' +
            'border-[rgba(107,63,18,0.35)] bg-white px-3 py-1.5 ' +
            'text-[0.7rem] font-semibold uppercase tracking-wider text-[#6b3f12] ' +
            'shadow-sm transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ' +
            'hover:border-[rgba(107,63,18,0.55)] hover:bg-[#f4e4c4] ' +
            'active:scale-x-[0.97] active:scale-y-[1.04] ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(107,63,18,0.35)] ' +
            'disabled:cursor-wait disabled:opacity-70'
          }
        >
          {exportando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <FileDown className="h-3.5 w-3.5" aria-hidden />
          )}
          {exportando ? 'Gerando…' : 'Exportar PDF'}
        </button>
      </div>

      <Link
        to={pastaUrl}
        aria-label={'Abrir pasta de ' + row.nome}
        className={CARD_CLASS}
      >
        <div
          className="absolute inset-x-0 top-0 h-1 opacity-80"
          style={{
            background: 'linear-gradient(to right, transparent, #c4963a, transparent)',
          }}
        />

        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(26,16,12,0.1)] px-5 py-4">
          <div>
            <h3 className="font-display text-xl tracking-wide text-[#1a100c] group-hover:underline group-hover:underline-offset-4">
              {row.nome}
            </h3>
            <p className="section-label mt-0.5 text-[#6b5244]">
              {FUNCIONARIO_TIPO_LABEL[row.tipo] ?? row.tipo}
              <span className="ml-2 text-[0.6rem] tracking-wider text-[#6b3f12]">Abrir pasta</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={BADGE_HE}>
              HE {formatMinutosHoraExtra(row.hora_extra_minutos)}
            </span>
            {balanco.horas_negativas_minutos > 0 && (
              <span className={BADGE_ATRASO}>
                Atrasos −{formatMinutosSaldo(balanco.horas_negativas_minutos)}
              </span>
            )}
            <span className={row.faltas > 0 ? BADGE_FALTA_ON : BADGE_FALTA_OFF}>
              {row.faltas} falta{row.faltas === 1 ? '' : 's'}
            </span>
          </div>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <h4 className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]">
              Batidas e faltas no período
            </h4>
            {dias.length === 0 && (
              <p className="mt-2 text-sm text-[#6b5244]">Nenhuma batida registrada.</p>
            )}
            {dias.length > 0 && (
              <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-[rgba(26,16,12,0.12)] bg-white">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-[#f7efe4]">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-[0.6rem] uppercase tracking-wider text-[#6b5244]">
                        Data
                      </th>
                      <th className={TH}>Início</th>
                      <th className={TH}>Início almoço</th>
                      <th className={TH}>Saída almoço</th>
                      <th className={TH}>Saída</th>
                      <th className={TH}>Saldo do dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map((dia) => (
                      <tr
                        key={dia.data}
                        className={
                          'border-t border-[rgba(26,16,12,0.08)] ' +
                          (dia.ehFalta
                            ? 'bg-[#fff1f2]'
                            : dia.atraso_minutos > 0 && dia.excedente_minutos === 0
                              ? 'bg-[#fff7f8]'
                              : dia.excedente_minutos > 0
                                ? 'bg-[#f3fbf6]'
                                : 'bg-white')
                        }
                      >
                        <td className="px-2 py-1.5 text-left tabular-nums font-medium text-[#1a100c]">
                          {formatDataCurta(dia.data)}
                          {dia.ehFalta && (
                            <span className="ml-1 text-[0.6rem] font-semibold uppercase tracking-wider text-[#9f1239]">
                              falta
                            </span>
                          )}
                        </td>
                        <CellHora valor={dia.inicio} />
                        <CellHora valor={dia.inicioAlmoco} />
                        <CellHora valor={dia.saidaAlmoco} />
                        <CellHora valor={dia.saida} />
                        <td className="px-2 py-1.5 text-center tabular-nums">
                          {dia.ehFalta ? (
                            <span className="font-semibold text-[#9f1239]">Falta</span>
                          ) : dia.excedente_minutos === 0 && dia.atraso_minutos === 0 ? (
                            <span className="text-[#9a8170]">—</span>
                          ) : (
                            <span className="inline-flex flex-col items-center gap-0.5 leading-tight">
                              {dia.excedente_minutos > 0 && (
                                <span className="font-semibold text-[#146c38]">
                                  +{formatMinutosSaldo(dia.excedente_minutos)}
                                </span>
                              )}
                              {dia.atraso_minutos > 0 && (
                                <span className="font-semibold text-[#9f1239]">
                                  −{formatMinutosSaldo(dia.atraso_minutos)}
                                </span>
                              )}
                              {dia.excedente_minutos > 0 && dia.atraso_minutos > 0 && (
                                <span
                                  className={
                                    'text-[0.65rem] ' +
                                    (dia.saldo_minutos >= 0 ? 'text-[#146c38]' : 'text-[#9f1239]')
                                  }
                                >
                                  (= {formatMinutosComSinal(dia.saldo_minutos)})
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            className="rounded-xl border border-[rgba(26,16,12,0.12)] bg-[#faf6f0] p-3.5"
            aria-label="Balanço de horas do período"
          >
            <h4 className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]">
              Balanço do período
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-[#146c38]/25 bg-[#edf8f1] px-2 py-2 text-center">
                <p className="text-[0.55rem] font-semibold uppercase tracking-wider text-[#146c38]/80">
                  Excedentes
                </p>
                <p className="mt-1 font-display text-sm tabular-nums text-[#146c38]">
                  {formatMinutosHoraExtra(balanco.horas_positivas_minutos)}
                </p>
              </div>
              <div className="rounded-lg border border-[#9f1239]/25 bg-[#fff1f2] px-2 py-2 text-center">
                <p className="text-[0.55rem] font-semibold uppercase tracking-wider text-[#9f1239]/80">
                  Atrasos
                </p>
                <p className="mt-1 font-display text-sm tabular-nums text-[#9f1239]">
                  {balanco.horas_negativas_minutos > 0
                    ? `−${formatMinutosSaldo(balanco.horas_negativas_minutos)}`
                    : '0min'}
                </p>
              </div>
              <div className="rounded-lg border border-[#9f1239]/25 bg-[#fff1f2] px-2 py-2 text-center">
                <p className="text-[0.55rem] font-semibold uppercase tracking-wider text-[#9f1239]/80">
                  Faltas abatidas
                </p>
                <p className="mt-1 font-display text-sm tabular-nums text-[#9f1239]">
                  {balanco.faltas_banco_minutos > 0
                    ? `−${formatMinutosSaldo(balanco.faltas_banco_minutos)}`
                    : '0min'}
                </p>
              </div>
              <div
                className={`rounded-lg border px-2 py-2 text-center ${saldoTone(balanco.status)}`}
              >
                <p className="text-[0.55rem] font-semibold uppercase tracking-wider opacity-80">
                  {saldoTitulo(balanco.status)}
                </p>
                <p className="mt-1 font-display text-sm tabular-nums">
                  {formatMinutosComSinal(balanco.saldo_minutos)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[0.65rem] leading-relaxed text-[#6b5244]">
              No dia: verde = excedente · vermelho = atraso. No período: Saldo = HE − atrasos −
              faltas abatidas no banco. Para justificar uma falta, abra a pasta do funcionário.
            </p>
          </section>

          <section>
            <h4 className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]">
              Faltas (dias sem ponto)
            </h4>
            {!temFaltas && (
              <p className="mt-2 text-sm font-medium text-[#146c38]">Nenhuma falta no período.</p>
            )}
            {temFaltas && (
              <ul className="mt-2 space-y-2">
                {faltasDetalhe.map((f) => (
                  <li
                    key={f.data}
                    className="rounded-lg border border-[#9f1239]/30 bg-[#fff1f2] px-3 py-2 text-sm text-[#9f1239]"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold tabular-nums">{formatDataCurta(f.data)}</span>
                      {f.abater_banco_horas && (
                        <span className="rounded border border-[#9f1239]/25 bg-white/70 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider">
                          Abatida no banco
                          {f.minutos_abatidos != null && f.minutos_abatidos > 0
                            ? ` (−${formatMinutosSaldo(f.minutos_abatidos)})`
                            : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[0.8rem] leading-snug text-[#7f1d1d]/90">
                      {f.observacao?.trim() || 'Sem justificativa'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Link>
    </article>
  )
}
