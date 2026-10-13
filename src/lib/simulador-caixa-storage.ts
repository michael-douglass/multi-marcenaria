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
/** Origem da parcela real quando o ajuste é “ocultar conta”. */
export type SimuladorAjusteOrigem = 'receber' | 'pagar'

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
  /**
   * ID da parcela real (contas a receber / a pagar).
   * Quando preenchido + tipo remover = conta ocultada só na simulação.
   */
  contaId?: string | null
  /** Tabela de origem da parcela ocultada. */
  origem?: SimuladorAjusteOrigem | null
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
    conta_id?: string
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

  const contaIdRaw = item.contaId ?? item.conta_id
  const contaId =
    typeof contaIdRaw === 'string' && contaIdRaw.trim() ? contaIdRaw.trim() : null
  const origem: SimuladorAjusteOrigem | null =
    item.origem === 'receber' || item.origem === 'pagar' ? item.origem : null

  return {
    id: item.id,
    titulo: item.titulo.trim() || 'Sem título',
    tipo: item.tipo,
    valor: toNumberMoney(item.valor),
    criadoEm,
    mes,
    campo,
    contaId,
    origem,
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

/** Ajuste que oculta uma parcela real (não é valor digitado na mão). */
export function isAjusteOcultarConta(a: SimuladorAjuste): boolean {
  return a.tipo === 'remover' && typeof a.contaId === 'string' && a.contaId.length > 0
}

/** IDs das parcelas ocultadas só na simulação. */
export function idsContasOcultas(ajustes: SimuladorAjuste[]): Set<string> {
  const ids = new Set<string>()
  for (const a of ajustes) {
    if (isAjusteOcultarConta(a) && a.contaId) ids.add(a.contaId)
  }
  return ids
}

const MESES_CURTOS_BASE = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const

/** Item mínimo para somar a base mensal (sem contas ocultadas). */
export interface SimuladorItemParaBase {
  id: string
  mes: string
  campo: SimuladorAjusteCampo
  valor: number
}

/**
 * Monta os 12 meses somando só parcelas que NÃO estão ocultadas no histórico.
 * (Útil quando a base precisa ser reconstruída só a partir dos itens.)
 */
export function buildMesesBaseFromItens(
  itens: SimuladorItemParaBase[],
  ocultos: Set<string>,
): SimuladorMes[] {
  const data: SimuladorMes[] = MESES_CURTOS_BASE.map(mes => ({
    mes,
    receitas: 0,
    despesas: 0,
  }))

  for (const item of itens) {
    if (ocultos.has(item.id)) continue
    const idx = MESES_CURTOS_BASE.indexOf(item.mes as (typeof MESES_CURTOS_BASE)[number])
    if (idx < 0) continue
    const v = toNumberMoney(item.valor)
    if (v <= 0) continue
    if (item.campo === 'receitas') data[idx].receitas += v
    else data[idx].despesas += v
  }

  return data.map(m => ({
    mes: m.mes,
    receitas: toNumberMoney(m.receitas),
    despesas: toNumberMoney(m.despesas),
  }))
}

/**
 * Parte dos totais oficiais do sistema (iguais às Anotações) e desconta
 * só as parcelas ocultadas na simulação — evita divergência a receber/a pagar.
 */
export function aplicarOcultosNaBase(
  base: SimuladorMes[],
  itens: SimuladorItemParaBase[],
  ocultos: Set<string>,
): SimuladorMes[] {
  if (ocultos.size === 0) {
    return base.map(m => ({
      mes: m.mes,
      receitas: toNumberMoney(m.receitas),
      despesas: toNumberMoney(m.despesas),
    }))
  }

  const result = base.map(m => ({
    mes: m.mes,
    receitas: toNumberMoney(m.receitas),
    despesas: toNumberMoney(m.despesas),
  }))

  for (const item of itens) {
    if (!ocultos.has(item.id)) continue
    const idx = result.findIndex(m => m.mes === item.mes)
    if (idx < 0) continue
    const v = toNumberMoney(item.valor)
    if (v <= 0) continue
    result[idx] = {
      ...result[idx],
      [item.campo]: toNumberMoney(Math.max(0, result[idx][item.campo] - v)),
    }
  }

  return result
}

/**
 * Parte da base real do sistema (contas em aberto) e reaplica só o histórico (+/−).
 * Ajustes com contaId (ocultar parcela) NÃO entram aqui — a base já exclui essas contas.
 * Assim os valores acompanham o sistema; o histórico manual permanece.
 */
export function aplicarAjustesNosMeses(
  base: SimuladorMes[],
  ajustes: SimuladorAjuste[],
): SimuladorMes[] {
  const result = base.map(m => ({
    mes: m.mes,
    receitas: toNumberMoney(m.receitas),
    despesas: toNumberMoney(m.despesas),
  }))

  // Histórico guarda o mais novo na frente; reaplica do mais antigo ao mais novo.
  for (const a of [...ajustes].reverse()) {
    if (!a.mes || !a.campo) continue
    // Ocultação por conta já foi aplicada ao montar a base a partir dos itens.
    if (isAjusteOcultarConta(a)) continue
    const idx = result.findIndex(m => m.mes === a.mes)
    if (idx < 0) continue
    const sinal = a.tipo === 'adicionar' ? 1 : -1
    const atual = result[idx][a.campo]
    result[idx] = {
      ...result[idx],
      [a.campo]: toNumberMoney(Math.max(0, atual + sinal * toNumberMoney(a.valor))),
    }
  }

  return result
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
      contaId: a.contaId ?? null,
      origem: a.origem === 'receber' || a.origem === 'pagar' ? a.origem : null,
    })),
    salvoEm: payload.salvoEm ?? new Date().toISOString(),
  }
}
