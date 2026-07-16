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

const STORAGE_PREFIX = 'movelaria_simulador_caixa_'

function storageKey(ano: number): string {
  return `${STORAGE_PREFIX}${ano}`
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function parseAjuste(raw: unknown): SimuladorAjuste | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<SimuladorAjuste>
  if (typeof item.id !== 'string' || typeof item.titulo !== 'string') return null
  if (item.tipo !== 'adicionar' && item.tipo !== 'remover') return null

  const campo =
    item.campo === 'receitas' || item.campo === 'despesas' ? item.campo : null
  const mes = typeof item.mes === 'string' && item.mes.trim() ? item.mes.trim() : null

  return {
    id: item.id,
    titulo: item.titulo.trim() || 'Sem título',
    tipo: item.tipo,
    valor: toNumber(item.valor),
    criadoEm: typeof item.criadoEm === 'string' ? item.criadoEm : new Date().toISOString(),
    mes,
    campo,
  }
}

function parseSimulacao(raw: unknown, ano: number): SimulacaoCaixa | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<SimulacaoCaixa>
  if (record.ano !== ano || !Array.isArray(record.meses)) return null

  const meses = record.meses
    .filter(m => m && typeof m === 'object' && typeof (m as SimuladorMes).mes === 'string')
    .map(m => {
      const item = m as SimuladorMes
      return {
        mes: item.mes,
        receitas: toNumber(item.receitas),
        despesas: toNumber(item.despesas),
      }
    })

  if (meses.length === 0) return null

  const ajustes = Array.isArray(record.ajustes)
    ? record.ajustes.map(parseAjuste).filter((a): a is SimuladorAjuste => a != null)
    : []

  return {
    ano,
    meses,
    previsaoRecebimento: toNumber(record.previsaoRecebimento),
    previsaoDespesas: toNumber(record.previsaoDespesas),
    ajustes,
    salvoEm: typeof record.salvoEm === 'string' ? record.salvoEm : new Date().toISOString(),
  }
}

export function loadSimulacao(ano: number): SimulacaoCaixa | null {
  try {
    const raw = localStorage.getItem(storageKey(ano))
    if (!raw) return null
    return parseSimulacao(JSON.parse(raw), ano)
  } catch {
    return null
  }
}

export function saveSimulacao(payload: Omit<SimulacaoCaixa, 'salvoEm'> & { salvoEm?: string }): void {
  const data: SimulacaoCaixa = {
    ano: payload.ano,
    meses: payload.meses.map(m => ({
      mes: m.mes,
      receitas: toNumber(m.receitas),
      despesas: toNumber(m.despesas),
    })),
    previsaoRecebimento: toNumber(payload.previsaoRecebimento),
    previsaoDespesas: toNumber(payload.previsaoDespesas),
    ajustes: (payload.ajustes ?? []).map(a => ({
      id: a.id,
      titulo: a.titulo.trim() || 'Sem título',
      tipo: a.tipo,
      valor: toNumber(a.valor),
      criadoEm: a.criadoEm,
      mes: a.mes ?? null,
      campo: a.campo ?? null,
    })),
    salvoEm: payload.salvoEm ?? new Date().toISOString(),
  }
  localStorage.setItem(storageKey(payload.ano), JSON.stringify(data))
}

export function clearSimulacao(ano: number): void {
  localStorage.removeItem(storageKey(ano))
}

/** Só ajustes gerais (sem mês) entram fora da soma dos meses — evita contar 2 vezes. */
export function somarAjustes(ajustes: SimuladorAjuste[]): number {
  return ajustes.reduce((acc, a) => {
    if (a.mes && a.campo) return acc
    const v = toNumber(a.valor)
    return a.tipo === 'adicionar' ? acc + v : acc - v
  }, 0)
}

export function rotuloCampoAjuste(campo: SimuladorAjusteCampo | null): string {
  if (campo === 'receitas') return 'Recebidos'
  if (campo === 'despesas') return 'Gastos'
  return 'Caixa'
}
