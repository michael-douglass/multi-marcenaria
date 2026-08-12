import type {
  DiaSemanaAdmissao,
  FuncionarioJornada,
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

/** ISODOW (1=seg … 7=dom) — mesmo padrão de `dias_uteis` no ponto. */
export const DIA_ADMISSAO_TO_ISODOW: Record<DiaSemanaAdmissao, number> = {
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  domingo: 7,
}

export const ISODOW_TO_DIA_ADMISSAO: Record<number, DiaSemanaAdmissao> = {
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado',
  7: 'domingo',
}

export type JornadaHorariosInput = Omit<
  FuncionarioJornada,
  'id' | 'funcionario_id' | 'criado_em' | 'atualizado_em'
>

function sliceHora(value?: string | null, fallback = ''): string {
  if (!value) return fallback
  return value.slice(0, 5)
}

function diaTemHorario(dia: HorarioDiaAdmissao | undefined): boolean {
  return !!(
    dia?.chegada
    || dia?.saida_almoco
    || dia?.retorno_almoco
    || dia?.saida_servico
  )
}

/** Extrai a jornada única do ponto a partir da grade da admissão. */
export function jornadaFromHorariosAdmissao(
  horarios?: HorariosSemanaAdmissao | null,
  diasAtivos?: DiaSemanaAdmissao[] | null,
  opts?: { toleranciaMinutos?: number; ativo?: boolean },
): JornadaHorariosInput | null {
  if (!horarios) return null
  const ativos = resolveDiasAtivos(diasAtivos, horarios)
  if (ativos.length === 0) return null

  const baseId = ativos.find(id => diaTemHorario(horarios[id]))
  if (!baseId) return null
  const base = horarios[baseId]
  if (!base) return null

  const entrada = sliceHora(base.chegada)
  const saida = sliceHora(base.saida_servico)
  if (!entrada || !saida) return null

  return {
    hora_entrada: entrada,
    hora_saida_intervalo: sliceHora(base.saida_almoco, '12:00'),
    hora_retorno_intervalo: sliceHora(base.retorno_almoco, '13:00'),
    hora_saida: saida,
    tolerancia_minutos: opts?.toleranciaMinutos ?? 5,
    dias_uteis: ativos.map(id => DIA_ADMISSAO_TO_ISODOW[id]).sort((a, b) => a - b),
    ativo: opts?.ativo ?? true,
  }
}

/** Espelha a jornada do ponto na grade por dia da admissão. */
export function horariosAdmissaoFromJornada(
  jornada: Pick<
    FuncionarioJornada,
    | 'hora_entrada'
    | 'hora_saida_intervalo'
    | 'hora_retorno_intervalo'
    | 'hora_saida'
    | 'dias_uteis'
  >,
): {
  horarios_semana: HorariosSemanaAdmissao
  horarios_dias_ativos: DiaSemanaAdmissao[]
} {
  const dias = (jornada.dias_uteis?.length
    ? jornada.dias_uteis
    : [1, 2, 3, 4, 5]
  )
    .map(n => ISODOW_TO_DIA_ADMISSAO[n])
    .filter((d): d is DiaSemanaAdmissao => !!d)

  const diaPadrao: HorarioDiaAdmissao = {
    chegada: sliceHora(jornada.hora_entrada, '08:00'),
    saida_almoco: sliceHora(jornada.hora_saida_intervalo, '12:00'),
    retorno_almoco: sliceHora(jornada.hora_retorno_intervalo, '13:00'),
    saida_servico: sliceHora(jornada.hora_saida, '17:00'),
  }

  const horarios_semana: HorariosSemanaAdmissao = {}
  for (const id of dias) {
    horarios_semana[id] = { ...diaPadrao }
  }

  return {
    horarios_semana,
    horarios_dias_ativos: dias,
  }
}

export function admissaoTemHorariosPreenchidos(
  dados?: {
    horarios_semana?: HorariosSemanaAdmissao | null
    horarios_dias_ativos?: DiaSemanaAdmissao[] | null
  } | null,
): boolean {
  return jornadaFromHorariosAdmissao(
    dados?.horarios_semana,
    dados?.horarios_dias_ativos,
  ) != null
}

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
