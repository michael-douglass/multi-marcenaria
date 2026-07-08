import { RECIBO_STATUS_LABEL } from '@/lib/funcionario-constants'
import { PRESTADOR_MONTHS_FULL } from '@/lib/prestador-financeiro'
import type { ContaPagarStatus, FuncionarioRecibo } from '@/types'

export interface ReciboMesGrupo {
  key: string
  mes: number
  ano: number
  label: string
  recibos: FuncionarioRecibo[]
  isMesAtual: boolean
  isFuturo: boolean
  abertoPorPadrao: boolean
}

export function reciboMesKey(recibo: FuncionarioRecibo): string {
  const raw = recibo.data_pagamento ?? recibo.criado_em?.slice(0, 10) ?? ''
  if (raw.length >= 7) return raw.slice(0, 7)
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatReciboMesLabel(mes: number, ano: number): string {
  const nome = PRESTADOR_MONTHS_FULL[mes - 1] ?? String(mes)
  return `${nome} ${ano}`
}

export function mesAtualKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseMesKey(key: string): { mes: number; ano: number } {
  const [anoStr, mesStr] = key.split('-')
  return { ano: Number(anoStr), mes: Number(mesStr) }
}

export function agruparRecibosPorMes(recibos: FuncionarioRecibo[], refDate = new Date()): ReciboMesGrupo[] {
  const atualKey = mesAtualKey(refDate)
  const map = new Map<string, FuncionarioRecibo[]>()

  for (const recibo of recibos) {
    const key = reciboMesKey(recibo)
    const list = map.get(key) ?? []
    list.push(recibo)
    map.set(key, list)
  }

  map.set(atualKey, map.get(atualKey) ?? [])

  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))

  const atualIdx = keys.indexOf(atualKey)
  if (atualIdx > 0) {
    keys.splice(atualIdx, 1)
    keys.unshift(atualKey)
  } else if (atualIdx === -1) {
    keys.unshift(atualKey)
  }

  return keys.map(key => {
    const { mes, ano } = parseMesKey(key)
    const isMesAtual = key === atualKey
    const isFuturo = key > atualKey
    return {
      key,
      mes,
      ano,
      label: formatReciboMesLabel(mes, ano),
      recibos: (map.get(key) ?? []).sort((a, b) => {
        const da = a.data_pagamento ?? a.criado_em ?? ''
        const db = b.data_pagamento ?? b.criado_em ?? ''
        return db.localeCompare(da)
      }),
      isMesAtual,
      isFuturo,
      abertoPorPadrao: isMesAtual || isFuturo,
    }
  })
}

export function reciboContaPagarPaga(recibo: FuncionarioRecibo): boolean {
  return recibo.conta_pagar_status === 'pago'
}

export function reciboPendenteAssinatura(recibo: FuncionarioRecibo): boolean {
  if (recibo.status === 'assinado') return false
  if (!reciboContaPagarPaga(recibo)) return false
  return recibo.status === 'aguardando_assinatura' || recibo.status === 'gerado'
}

export function podeAssinarRecibo(recibo: FuncionarioRecibo): boolean {
  return reciboPendenteAssinatura(recibo)
}

export function reciboStatusExibicao(recibo: FuncionarioRecibo): {
  label: string
  colorClass: string
} {
  if (recibo.status === 'assinado') {
    return {
      label: RECIBO_STATUS_LABEL.assinado,
      colorClass: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
    }
  }

  if (!reciboContaPagarPaga(recibo)) {
    return {
      label: 'Aguardando pagamento',
      colorClass: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
    }
  }

  return {
    label: RECIBO_STATUS_LABEL[recibo.status],
    colorClass: recibo.status === 'gerado'
      ? 'text-blue-300 border-blue-500/30 bg-blue-500/10'
      : 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  }
}

type ReciboRowComContaPagar = FuncionarioRecibo & {
  conta_pagar?: { status: ContaPagarStatus } | null
}

export const RECIBO_SELECT_COM_CONTA_PAGAR = '*, conta_pagar:movelaria_contas_pagar(status)'

export function mapRecibosComContaPagar(rows: ReciboRowComContaPagar[] | null): FuncionarioRecibo[] {
  return (rows ?? []).map(({ conta_pagar, ...recibo }) => ({
    ...recibo,
    conta_pagar_status: conta_pagar?.status ?? null,
  }))
}
