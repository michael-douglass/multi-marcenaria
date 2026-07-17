import { Field } from '@/components/ui/Field'
import { TimeInput } from '@/components/ui/TimeInput'
import {
  DIAS_SEMANA_ADMISSAO,
  resolveDiasAtivos,
} from '@/lib/funcionario-horarios'
import type {
  DiaSemanaAdmissao,
  HorarioDiaAdmissao,
  HorariosSemanaAdmissao,
} from '@/types'

const MARCAS: { key: keyof HorarioDiaAdmissao; label: string }[] = [
  { key: 'chegada', label: 'Chegada' },
  { key: 'saida_almoco', label: 'Saída para almoço' },
  { key: 'retorno_almoco', label: 'Retorno do almoço' },
  { key: 'saida_servico', label: 'Saída do serviço' },
]

export interface HorariosSemanaChange {
  horarios_semana: HorariosSemanaAdmissao
  horarios_dias_ativos: DiaSemanaAdmissao[]
}

interface Props {
  value?: HorariosSemanaAdmissao | null
  diasAtivos?: DiaSemanaAdmissao[] | null
  disabled?: boolean
  onChange: (next: HorariosSemanaChange) => void
}

export function HorariosSemanaFields({ value, diasAtivos, disabled, onChange }: Props) {
  const semana = value ?? {}
  const ativos = resolveDiasAtivos(diasAtivos, semana)

  const emit = (
    nextSemana: HorariosSemanaAdmissao,
    nextAtivos: DiaSemanaAdmissao[],
  ) => {
    onChange({
      horarios_semana: nextSemana,
      horarios_dias_ativos: nextAtivos,
    })
  }

  const toggleDia = (id: DiaSemanaAdmissao, checked: boolean) => {
    const nextAtivos = checked
      ? DIAS_SEMANA_ADMISSAO.map(d => d.id).filter(
          d => ativos.includes(d) || d === id,
        )
      : ativos.filter(d => d !== id)

    const nextSemana = { ...semana }
    if (!checked) {
      delete nextSemana[id]
    }

    emit(nextSemana, nextAtivos)
  }

  const setMarca = (
    dia: DiaSemanaAdmissao,
    key: keyof HorarioDiaAdmissao,
    hora: string,
  ) => {
    emit(
      {
        ...semana,
        [dia]: {
          ...(semana[dia] ?? {}),
          [key]: hora,
        },
      },
      ativos,
    )
  }

  const copiarPrimeiroParaOutros = () => {
    const baseId = ativos.find(id => {
      const d = semana[id]
      return !!(d?.chegada || d?.saida_almoco || d?.retorno_almoco || d?.saida_servico)
    })
    if (!baseId) return
    const base = semana[baseId]
    if (!base) return

    const next: HorariosSemanaAdmissao = { ...semana }
    for (const id of ativos) {
      if (id === baseId) continue
      next[id] = { ...base }
    }
    emit(next, ativos)
  }

  const diasComHorario = ativos.filter(id => {
    const d = semana[id]
    return !!(d?.chegada || d?.saida_almoco || d?.retorno_almoco || d?.saida_servico)
  })

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-[#f2d892]">Horários da semana</h4>
        <p className="text-xs text-[#b8957f]">
          Selecione os dias e preencha no formato 24h (ex.: 08:00, 12:00, 13:00, 17:00).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DIAS_SEMANA_ADMISSAO.map(({ id, label }) => {
          const checked = ativos.includes(id)
          return (
            <label
              key={id}
              className={[
                'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                checked
                  ? 'border-[rgba(212,168,83,0.45)] bg-[rgba(212,168,83,0.12)] text-[#f2d892]'
                  : 'border-[rgba(212,168,83,0.15)] text-[#b8957f] hover:border-[rgba(212,168,83,0.3)]',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="accent-[#d4a853]"
                disabled={disabled}
                checked={checked}
                onChange={e => toggleDia(id, e.target.checked)}
              />
              {label}
            </label>
          )
        })}
      </div>

      {ativos.length === 0 ? (
        <p className="rounded-lg border border-[rgba(212,168,83,0.15)] bg-[rgba(0,0,0,0.15)] p-3 text-sm text-[#b8957f]">
          Marque pelo menos um dia da semana para preencher os horários.
        </p>
      ) : (
        <>
          {!disabled && diasComHorario.length > 0 && ativos.length > 1 && (
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={copiarPrimeiroParaOutros}
              >
                Copiar horário para os outros dias marcados
              </button>
            </div>
          )}

          <div className="space-y-4">
            {DIAS_SEMANA_ADMISSAO.filter(({ id }) => ativos.includes(id)).map(
              ({ id, label }) => {
                const dia = semana[id] ?? {}
                return (
                  <div
                    key={id}
                    className="rounded-lg border border-[rgba(212,168,83,0.18)] bg-[rgba(0,0,0,0.15)] p-3"
                  >
                    <p className="mb-3 text-sm font-medium text-[#edd9c4]">{label}</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {MARCAS.map(({ key, label: marcaLabel }) => (
                        <Field key={key} label={marcaLabel}>
                          <TimeInput
                            className="glass-input"
                            disabled={disabled}
                            value={dia[key] ?? ''}
                            onChange={v => setMarca(id, key, v ?? '')}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                )
              },
            )}
          </div>
        </>
      )}
    </div>
  )
}
