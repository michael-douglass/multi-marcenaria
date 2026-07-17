import type {
  DiaSemanaAdmissao,
  HorarioDiaAdmissao,
  HorariosSemanaAdmissao,
} from '@/types'

export const DIAS_SEMANA_ADMISSAO: { id: DiaSemanaAdmissao; label: string }[] = [
  { id: 'segunda', label: 'Segunda' },
  { id: 'terca', label: 'Terça' },
  { id: 'quarta', label: 'Quarta' },
  { id: 'quinta', label: 'Quinta' },
  { id: 'sexta', label: 'Sexta' },
  { id: 'sabado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' },
]

/** Padrão: segunda a sexta. */
export const DIAS_UTEIS_ADMISSAO: DiaSemanaAdmissao[] = [
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
]

export function resolveDiasAtivos(
  salvos: DiaSemanaAdmissao[] | null | undefined,
  horarios?: HorariosSemanaAdmissao | null,
): DiaSemanaAdmissao[] {
  if (Array.isArray(salvos) && salvos.length > 0) {
    return DIAS_SEMANA_ADMISSAO.map(d => d.id).filter(id => salvos.includes(id))
  }
  // Compatibilidade: se já existem horários preenchidos, marca esses dias.
  if (horarios) {
    const comDados = DIAS_SEMANA_ADMISSAO.map(d => d.id).filter(id => {
      const dia = horarios[id]
      return !!(
        dia?.chegada
        || dia?.saida_almoco
        || dia?.retorno_almoco
        || dia?.saida_servico
      )
    })
    if (comDados.length > 0) return comDados
  }
  return [...DIAS_UTEIS_ADMISSAO]
}

export function formatHorarioDiaResumo(dia: HorarioDiaAdmissao | undefined): string {
  if (!dia) return ''
  const parts = [
    dia.chegada && `Chegada ${dia.chegada}`,
    dia.saida_almoco && `Almoço ${dia.saida_almoco}`,
    dia.retorno_almoco && `Retorno ${dia.retorno_almoco}`,
    dia.saida_servico && `Saída ${dia.saida_servico}`,
  ].filter(Boolean)
  return parts.join(' · ')
}

export function formatHorariosSemanaResumo(
  horarios: HorariosSemanaAdmissao | null | undefined,
  diasAtivos?: DiaSemanaAdmissao[] | null,
): string[] {
  if (!horarios) return []
  const ativos = resolveDiasAtivos(diasAtivos, horarios)
  return DIAS_SEMANA_ADMISSAO.filter(({ id }) => ativos.includes(id))
    .map(({ id, label }) => {
      const resumo = formatHorarioDiaResumo(horarios[id])
      return resumo ? `${label}: ${resumo}` : ''
    })
    .filter(Boolean)
}
