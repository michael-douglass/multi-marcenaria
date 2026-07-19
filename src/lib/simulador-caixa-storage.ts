/**
 * Tipos e helpers do Simulador de Caixa (Dashboard).
 * Persistência fica no Supabase (compartilhado entre usuários).
 */

export interface SimuladorMes {
  mes: string
  receitas: number
  despesas: number
}

export type SimuladorAjusteTipo = 'adicionar' | 'remover'
export type SimuladorAjusteCampo = 'receitas' | 'despesas'

export interface SimuladorAjuste {
  id: string
  titulo: string
  tipo: SimuladorAjusteTipo
  valor: number
  criadoEm: string
  /** Mês curto (ex.: Mai). null = ajuste geral no caixa. */
  mes: string | null
  /** Campo do mês afetado. null = ajuste geral. */
  campo: SimuladorAjusteCampo | null
}

export interface SimulacaoCaixa {
  ano: number
  meses: SimuladorMes[]
  previsaoRecebimento: number
  previsaoDespesas: number
  ajustes: SimuladorAjuste[]
  salvoEm: string
}

export function toNumberMoney(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

export function parseAjuste(raw: unknown): SimuladorAjuste | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<SimuladorAjuste> & {
    criado_em?: string
  }
  if (typeof item.id !== 'string' || typeof item.titulo !== 'string') return null
  if (item.tipo !== 'adicionar' && item.tipo !== 'remover') return null

  const campo =
    item.campo === 'receitas' || item.campo === 'despesas' ? item.campo : null
  const mes = typeof item.mes === 'string' && item.mes.trim() ? item.mes.trim() : null
  const criadoEm =
    typeof item.criadoEm === 'string'
      ? item.criadoEm
      : typeof item.criado_em === 'string'
        ? item.criado_em
        : new Date().toISOString()

  return {
    id: item.id,
    titulo: item.titulo.trim() || 'Sem título',
    tipo: item.tipo,
    valor: toNumberMoney(item.valor),
    criadoEm,
    mes,
    campo,
  }
}

export function parseSimulacao(raw: unknown, ano: number): SimulacaoCaixa | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<SimulacaoCaixa> & {
    previsao_recebimento?: unknown
    previsao_despesas?: unknown
    atualizado_em?: string
  }
  if (!Array.isArray(record.meses)) return null

  const meses = record.meses
    .filter(m => m && typeof m === 'object' && typeof (m as SimuladorMes).mes === 'string')
    .map(m => {
      const item = m as SimuladorMes
      return {
        mes: item.mes,
        receitas: toNumberMoney(item.receitas),
        despesas: toNumberMoney(item.despesas),
      }
    })

  if (meses.length === 0) return null

  const ajustes = Array.isArray(record.ajustes)
    ? record.ajustes.map(parseAjuste).filter((a): a is SimuladorAjuste => a != null)
    : []

  const previsaoRecebimento = toNumberMoney(
    record.previsaoRecebimento ?? record.previsao_recebimento,
  )
  const previsaoDespesas = toNumberMoney(
    record.previsaoDespesas ?? record.previsao_despesas,
  )
  const salvoEm =
    typeof record.salvoEm === 'string'
      ? record.salvoEm
      : typeof record.atualizado_em === 'string'
        ? record.atualizado_em
        : new Date().toISOString()

  return {
    ano,
    meses,
    previsaoRecebimento,
    previsaoDespesas,
    ajustes,
    salvoEm,
  }
}

/** Só ajustes gerais (sem mês) entram fora da soma dos meses — evita contar 2 vezes. */
export function somarAjustes(ajustes: SimuladorAjuste[]): number {
  return ajustes.reduce((acc, a) => {
    if (a.mes && a.campo) return acc
    const v = toNumberMoney(a.valor)
    return a.tipo === 'adicionar' ? acc + v : acc - v
  }, 0)
}

export function rotuloCampoAjuste(campo: SimuladorAjusteCampo | null): string {
  if (campo === 'receitas') return 'A receber'
  if (campo === 'despesas') return 'A pagar'
  return 'Caixa'
}

export function normalizeSimulacaoPayload(
  payload: Omit<SimulacaoCaixa, 'salvoEm'> & { salvoEm?: string },
): SimulacaoCaixa {
  return {
    ano: payload.ano,
    meses: payload.meses.map(m => ({
      mes: m.mes,
      receitas: toNumberMoney(m.receitas),
      despesas: toNumberMoney(m.despesas),
    })),
    previsaoRecebimento: toNumberMoney(payload.previsaoRecebimento),
    previsaoDespesas: toNumberMoney(payload.previsaoDespesas),
    ajustes: (payload.ajustes ?? []).map(a => ({
      id: a.id,
      titulo: a.titulo.trim() || 'Sem título',
      tipo: a.tipo,
      valor: toNumberMoney(a.valor),
      criadoEm: a.criadoEm,
      mes: a.mes ?? null,
      campo: a.campo ?? null,
    })),
    salvoEm: payload.salvoEm ?? new Date().toISOString(),
  }
}
