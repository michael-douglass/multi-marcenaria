import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { FileDown, Loader2 } from 'lucide-react'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import { formatMinutosHoraExtra } from '@/lib/funcionario-ponto'
import {
  agruparBatidasPorDia,
  formatDataCurtaPonto,
  imprimirResumoPontoPdf,
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
  'border border-[rgba(212,168,83,0.22)] bg-[rgba(36,16,8,0.72)] shadow-mogno ' +
  'transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(212,168,83,0.45)] ' +
  'hover:shadow-mogno-lg focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[rgba(242,216,146,0.4)]'

const BADGE_HE =
  'rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 ' +
  'text-[0.65rem] uppercase tracking-wider text-amber-300'

const BADGE_FALTA_ON =
  'rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-0.5 ' +
  'text-[0.65rem] uppercase tracking-wider text-red-300'

const BADGE_FALTA_OFF =
  'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 ' +
  'text-[0.65rem] uppercase tracking-wider text-emerald-300'

const TH =
  'px-2 py-2 text-center font-medium text-[0.6rem] uppercase tracking-wider text-[#b8957f]'

const TD_HORA = 'px-2 py-1.5 text-center tabular-nums text-[#f2d892]'

function formatDataCurta(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function CellHora({ valor }: { valor: string | null }) {
  return (
    <td className={TD_HORA}>
      {valor ?? <span className="text-[#b8957f]">-</span>}
    </td>
  )
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
  const dias = agruparBatidasPorDia(row.chegadas, row.saidas ?? [])
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
      // A janela de impressão abre de forma assíncrona; liberamos o botão em seguida.
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
            'border-[rgba(212,168,83,0.35)] bg-[rgba(36,16,8,0.85)] px-3 py-1.5 ' +
            'text-[0.7rem] font-medium uppercase tracking-wider text-[#f2d892] ' +
            'shadow-sm transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ' +
            'hover:border-[rgba(212,168,83,0.55)] hover:bg-[rgba(56,28,12,0.95)] ' +
            'hover:text-[#f7e7be] active:scale-x-[0.97] active:scale-y-[1.04] ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(242,216,146,0.4)] ' +
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
          className="absolute inset-x-0 top-0 h-1 opacity-60"
          style={{
            background: 'linear-gradient(to right, transparent, #f2d892, transparent)',
          }}
        />

        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(212,168,83,0.12)] px-5 py-4">
          <div>
            <h3 className="font-display text-xl tracking-wide text-[#f2d892] group-hover:underline group-hover:underline-offset-4">
              {row.nome}
            </h3>
            <p className="section-label mt-0.5">
              {FUNCIONARIO_TIPO_LABEL[row.tipo] ?? row.tipo}
              <span className="ml-2 text-[0.6rem] tracking-wider text-[#c9a045]">Abrir pasta</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={BADGE_HE}>
              HE {formatMinutosHoraExtra(row.hora_extra_minutos)}
            </span>
            <span className={row.faltas > 0 ? BADGE_FALTA_ON : BADGE_FALTA_OFF}>
              {row.faltas} falta{row.faltas === 1 ? '' : 's'}
            </span>
          </div>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <h4 className="text-[0.65rem] font-medium uppercase tracking-widest text-[#b8957f]">
              Batidas no periodo
            </h4>
            {dias.length === 0 && (
              <p className="mt-2 text-sm text-[#b8957f]">Nenhuma batida registrada.</p>
            )}
            {dias.length > 0 && (
              <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-[rgba(212,168,83,0.18)]">
                <table className="w-full min-w-[320px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-[rgba(20,10,4,0.95)]">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-[0.6rem] uppercase tracking-wider text-[#b8957f]">
                        Data
                      </th>
                      <th className={TH}>Início</th>
                      <th className={TH}>Início almoço</th>
                      <th className={TH}>Saída almoço</th>
                      <th className={TH}>Saída</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map((dia) => (
                      <tr
                        key={dia.data}
                        className="border-t border-[rgba(212,168,83,0.12)] bg-[rgba(20,10,4,0.35)]"
                      >
                        <td className="px-2 py-1.5 text-left tabular-nums text-[#edd9c4]">
                          {formatDataCurta(dia.data)}
                        </td>
                        <CellHora valor={dia.inicio} />
                        <CellHora valor={dia.inicioAlmoco} />
                        <CellHora valor={dia.saidaAlmoco} />
                        <CellHora valor={dia.saida} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h4 className="text-[0.65rem] font-medium uppercase tracking-widest text-[#b8957f]">
              Faltas (dias sem ponto)
            </h4>
            {!temFaltas && (
              <p className="mt-2 text-sm text-emerald-300/90">Nenhuma falta no periodo.</p>
            )}
            {temFaltas && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {row.faltas_datas.map((data) => (
                  <li
                    key={data}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-sm tabular-nums text-red-200"
                    title={formatDataCurtaPonto(data)}
                  >
                    {formatDataCurta(data)}
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
