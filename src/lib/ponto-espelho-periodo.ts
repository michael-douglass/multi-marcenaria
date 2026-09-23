import {
  filterMarcacoesNoPeriodo,
  formatHoraPonto,
  horaParaMinutosDoDia,
  marcacaoDataLocal,
  marcacaoHoraEfetiva,
  pontoDataLocal,
  PONTO_TIMEZONE,
} from '@/lib/funcionario-ponto'
import { calcularBalancoResumoPonto, montarDiasResumoPonto } from '@/lib/resumo-ponto-pdf'
import type {
  FuncionarioJornada,
  FuncionarioTipo,
  PontoMarcacao,
  PontoOcorrencia,
  PontoResumoBatida,
  PontoResumoFuncionarioPeriodo,
} from '@/types'

export interface EspelhoOcorrenciaResumo {
  data: string
  observacao?: string | null
  automatica: boolean
  abater_banco_horas?: boolean
  minutos_abatidos?: number | null
}

export interface EspelhoPontoPeriodo {
  de: string
  ate: string
  row: PontoResumoFuncionarioPeriodo
  marcacoes: PontoMarcacao[]
  faltas: EspelhoOcorrenciaResumo[]
  folgas: EspelhoOcorrenciaResumo[]
  abonos: EspelhoOcorrenciaResumo[]
  batidasComFoto: number
  batidasComAssinatura: number
  horaExtraMinutos: number
  atrasoMinutos: number
  saldoMinutos: number
}

export interface MontarEspelhoPontoInput {
  funcionarioId: string
  funcionarioNome: string
  funcionarioTipo: FuncionarioTipo
  jornada: FuncionarioJornada | null
  marcacoes: PontoMarcacao[]
  ocorrencias: PontoOcorrencia[]
  de: string
  ate: string
}

function addDaysIso(iso: string, days: number): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function isoWeekdaySaoPaulo(isoDate: string): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: PONTO_TIMEZONE,
    weekday: 'short',
  }).format(new Date(`${isoDate}T12:00:00`))
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  }
  return map[wd] ?? 1
}

/** Igual a `movelaria_ponto_data_faltas_ate`: hoje só conta falta a partir das 23h (SP). */
export function dataFaltasAte(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: PONTO_TIMEZONE,
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'hour')?.value ?? '0',
  )
  const hoje = pontoDataLocal()
  return hour >= 23 ? hoje : addDaysIso(hoje, -1)
}

function eachDateInclusive(de: string, ate: string): string[] {
  if (de > ate) return []
  const out: string[] = []
  let cur = de
  while (cur <= ate) {
    out.push(cur)
    cur = addDaysIso(cur, 1)
  }
  return out
}

function minutosHoraExtraSaida(
  marcacao: PontoMarcacao,
  jornada: FuncionarioJornada | null,
): number {
  if (marcacao.tipo !== 'saida' || !jornada?.hora_saida) return 0
  const efetiva = horaParaMinutosDoDia(marcacaoHoraEfetiva(marcacao))
  const prevista = horaParaMinutosDoDia(jornada.hora_saida)
  if (efetiva == null || prevista == null) return 0
  return Math.max(0, Math.floor(efetiva - prevista))
}

function toResumoBatida(
  m: PontoMarcacao,
  jornada: FuncionarioJornada | null,
): PontoResumoBatida {
  return {
    data: marcacaoDataLocal(m),
    hora: formatHoraPonto(marcacaoHoraEfetiva(m)),
    atraso_minutos: Math.max(0, Math.floor(Number(m.atraso_minutos) || 0)),
    hora_extra_minutos: minutosHoraExtraSaida(m, jornada),
    tipo: m.tipo,
  }
}

function ocorrenciaNoPeriodo(
  o: PontoOcorrencia,
  de: string,
  ate: string,
): boolean {
  return o.data >= de && o.data <= ate
}

/**
 * Monta o espelho de um único funcionário a partir dos dados já carregados na pasta.
 * HE e faltas seguem a mesma regra do resumo oficial (RPC).
 */
export function montarEspelhoPontoPeriodo(input: MontarEspelhoPontoInput): EspelhoPontoPeriodo {
  const { funcionarioId, funcionarioNome, funcionarioTipo, jornada, de, ate } = input
  const marcacoes = filterMarcacoesNoPeriodo(input.marcacoes, de, ate).slice().sort((a, b) => {
    const ta = marcacaoHoraEfetiva(a)
    const tb = marcacaoHoraEfetiva(b)
    return ta.localeCompare(tb)
  })

  const ocorrenciasPeriodo = input.ocorrencias.filter((o) => ocorrenciaNoPeriodo(o, de, ate))
  const folgas = ocorrenciasPeriodo
    .filter((o) => o.tipo === 'folga')
    .map((o) => ({ data: o.data, observacao: o.observacao, automatica: o.automatica }))
    .sort((a, b) => a.data.localeCompare(b.data))
  const abonos = ocorrenciasPeriodo
    .filter((o) => o.tipo === 'abono')
    .map((o) => ({ data: o.data, observacao: o.observacao, automatica: o.automatica }))
    .sort((a, b) => a.data.localeCompare(b.data))

  const diasComBatida = new Set(marcacoes.map((m) => marcacaoDataLocal(m)))
  const diasFolgaAbono = new Set(
    ocorrenciasPeriodo.filter((o) => o.tipo === 'folga' || o.tipo === 'abono').map((o) => o.data),
  )
  const diasUteis = jornada?.dias_uteis?.length ? jornada.dias_uteis : [1, 2, 3, 4, 5]
  const tetoFaltas = dataFaltasAte()
  const fimFaltas = ate < tetoFaltas ? ate : tetoFaltas

  const faltasMap = new Map<string, EspelhoOcorrenciaResumo>()

  for (const o of ocorrenciasPeriodo.filter((x) => x.tipo === 'falta' && x.data <= fimFaltas)) {
    faltasMap.set(o.data, {
      data: o.data,
      observacao: o.observacao,
      automatica: o.automatica,
      abater_banco_horas: Boolean(o.abater_banco_horas),
      minutos_abatidos: o.minutos_abatidos ?? null,
    })
  }

  if (jornada?.ativo !== false) {
    for (const dia of eachDateInclusive(de, fimFaltas)) {
      if (!diasUteis.includes(isoWeekdaySaoPaulo(dia))) continue
      if (diasFolgaAbono.has(dia)) continue
      if (diasComBatida.has(dia)) continue
      if (!faltasMap.has(dia)) {
        faltasMap.set(dia, {
          data: dia,
          observacao: null,
          automatica: true,
          abater_banco_horas: false,
          minutos_abatidos: null,
        })
      }
    }
  }

  const faltas = [...faltasMap.values()].sort((a, b) => a.data.localeCompare(b.data))
  const faltasBancoMinutos = faltas.reduce(
    (acc, f) =>
      acc + (f.abater_banco_horas ? Math.max(0, Math.floor(Number(f.minutos_abatidos) || 0)) : 0),
    0,
  )

  const chegadas = marcacoes
    .filter((m) => m.tipo === 'entrada' || m.tipo === 'retorno_intervalo')
    .map((m) => toResumoBatida(m, jornada))
  const saidas = marcacoes
    .filter((m) => m.tipo === 'saida_intervalo' || m.tipo === 'saida')
    .map((m) => toResumoBatida(m, jornada))

  const horaExtraMinutos = saidas
    .filter((b) => b.tipo === 'saida')
    .reduce((acc, b) => acc + Math.max(0, Math.floor(Number(b.hora_extra_minutos) || 0)), 0)

  const row: PontoResumoFuncionarioPeriodo = {
    funcionario_id: funcionarioId,
    nome: funcionarioNome,
    tipo: funcionarioTipo,
    hora_extra_minutos: horaExtraMinutos,
    faltas: faltas.length,
    faltas_datas: faltas.map((f) => f.data),
    faltas_detalhe: faltas.map((f) => ({
      data: f.data,
      observacao: f.observacao,
      abater_banco_horas: f.abater_banco_horas,
      minutos_abatidos: f.minutos_abatidos,
    })),
    faltas_banco_minutos: faltasBancoMinutos,
    chegadas,
    saidas,
  }

  const balanco = calcularBalancoResumoPonto(row)

  return {
    de,
    ate,
    row,
    marcacoes,
    faltas,
    folgas,
    abonos,
    batidasComFoto: marcacoes.filter((m) => Boolean(m.foto_path)).length,
    batidasComAssinatura: marcacoes.filter((m) => Boolean(m.assinatura_path)).length,
    horaExtraMinutos: balanco.horas_positivas_minutos,
    atrasoMinutos: balanco.horas_negativas_minutos,
    saldoMinutos: balanco.saldo_minutos,
  }
}

export function diasComHoraExtra(espelho: EspelhoPontoPeriodo): Array<{ data: string; minutos: number }> {
  return montarDiasResumoPonto(espelho.row)
    .filter((d) => !d.ehFalta && d.excedente_minutos > 0)
    .map((d) => ({ data: d.data, minutos: d.excedente_minutos }))
}
