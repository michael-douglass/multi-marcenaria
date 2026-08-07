import { fmtDate } from './utils'
import type { ContaReceber, ObraFull } from '../types'

type ObraDatas = Pick<
  ObraFull,
  | 'id'
  | 'origem_lead_id'
  | 'cliente_id'
  | 'cliente_nome'
  | 'data_prevista_inicio'
  | 'data_prevista_fim'
  | 'criado_em'
>

/** Mesmo formato do card da Agenda: "11/08/2026 → 13/08/2026". */
export function formatInicioEntregaObra(
  obra: Pick<ObraFull, 'data_prevista_inicio' | 'data_prevista_fim'> | null | undefined,
): string {
  if (!obra) return '—'
  if (!obra.data_prevista_inicio && !obra.data_prevista_fim) return '—'
  const inicio = obra.data_prevista_inicio ? fmtDate(obra.data_prevista_inicio) : '?'
  const fim = obra.data_prevista_fim ? fmtDate(obra.data_prevista_fim) : '?'
  return `${inicio} → ${fim}`
}

function obraTemDatas(obra: Pick<ObraFull, 'data_prevista_inicio' | 'data_prevista_fim'>): boolean {
  return !!(obra.data_prevista_inicio || obra.data_prevista_fim)
}

/** Prefere obra com datas; depois a entrega mais recente. */
function pickBestObra(obras: ObraDatas[]): ObraDatas | null {
  if (obras.length === 0) return null
  return [...obras].sort((a, b) => {
    const aHas = obraTemDatas(a)
    const bHas = obraTemDatas(b)
    if (aHas !== bHas) return aHas ? -1 : 1
    const af = a.data_prevista_fim ?? ''
    const bf = b.data_prevista_fim ?? ''
    if (af !== bf) return bf.localeCompare(af)
    return (b.criado_em ?? '').localeCompare(a.criado_em ?? '')
  })[0] ?? null
}

/**
 * Liga cobrança → obra da Agenda (lead do orçamento, depois cliente).
 * Assim a coluna de Cobranças espelha as datas do card da Agenda.
 */
export function findObraParaConta(conta: ContaReceber, obras: ObraDatas[]): ObraDatas | null {
  if (conta.origem_lead_id) {
    const byLead = obras.filter(o => o.origem_lead_id === conta.origem_lead_id)
    const best = pickBestObra(byLead)
    if (best) return best
  }

  if (conta.cliente_id) {
    const byId = obras.filter(o => o.cliente_id === conta.cliente_id)
    const best = pickBestObra(byId)
    if (best) return best
  }

  const nome = conta.cliente_nome?.trim().toLowerCase()
  if (nome) {
    const byNome = obras.filter(o => o.cliente_nome.trim().toLowerCase() === nome)
    return pickBestObra(byNome)
  }

  return null
}

/** Mapa contaId → texto "início → entrega" para a tabela de Cobranças. */
export function buildInicioEntregaPorConta(
  contas: ContaReceber[],
  obras: ObraDatas[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const conta of contas) {
    map.set(conta.id, formatInicioEntregaObra(findObraParaConta(conta, obras)))
  }
  return map
}
