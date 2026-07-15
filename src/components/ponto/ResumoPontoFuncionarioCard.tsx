import { Link } from 'react-router-dom'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import { formatMinutosHoraExtra } from '@/lib/funcionario-ponto'
import type { PontoResumoFuncionarioPeriodo } from '@/types'

interface ResumoPontoFuncionarioCardProps {
  row: PontoResumoFuncionarioPeriodo
  index: number
}

function formatDataCurta(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const CARD_CLASS =
  'resumo-ponto-card group relative block overflow-hidden rounded-2xl ' +
  'border border-[rgba(212,168,83,0.22)] bg-[rgba(36,16,8,0.72)] shadow-mogno ' +
  'transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(212,168,83,0.45)] ' +
  'hover:shadow-mogno-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(242,216,146,0.4)]'

const BADGE_HE =
  'rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 ' +
  'text-[0.65rem] uppercase tracking-wider text-amber-300'

const BADGE_FALTA_ON =
  'rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-0.5 ' +
  'text-[0.65rem] uppercase tracking-wider text-red-300'

const BADGE_FALTA_OFF =
  'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 ' +
  'text-[0.65rem] uppercase tracking-wider text-emerald-300'

const CHIP_CHEGADA =
  'rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(20,10,4,0.45)] ' +
  'px-2.5 py-1.5 text-sm tabular-nums text-[#edd9c4]'

export function ResumoPontoFuncionarioCard({ row, index }: ResumoPontoFuncionarioCardProps) {
  const temChegadas = row.chegadas.length > 0
  const temFaltas = row.faltas_datas.length > 0
  const pastaUrl = '/funcionarios/' + row.funcionario_id + '?tab=ponto'

  return (
    <Link
      to={pastaUrl}
      aria-label={'Abrir pasta de ' + row.nome}
      className={CARD_CLASS}
      style={{ animationDelay: index * 70 + 'ms' }}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#f2d892] to-transparent opacity-60" />

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
            Chegadas no periodo
          </h4>
          {!temChegadas && (
            <p className="mt-2 text-sm text-[#b8957f]">Nenhuma entrada registrada.</p>
          )}
          {temChegadas && (
            <ul className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {row.chegadas.map((c) => {
                const atrasado = c.atraso_minutos > 0
                return (
                  <li
                    key={c.data + '-' + c.hora}
                    className={CHIP_CHEGADA}
                    title={atrasado ? 'Atraso: ' + c.atraso_minutos + ' min' : 'No horario'}
                  >
                    <span className="text-[#b8957f]">{formatDataCurta(c.data)}</span>
                    <span className="mx-1.5 text-[rgba(212,168,83,0.4)]">|</span>
                    <span className={atrasado ? 'text-amber-300' : 'text-[#f2d892]'}>
                      {c.hora}
                    </span>
                  </li>
                )
              })}
            </ul>
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
                >
                  {formatDataCurta(data)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Link>
  )
}
