import type { AgendaMesFiltro } from '@/lib/agenda-mes-filtro-storage'
import { obraEmAtrasoAberta, obraVisivelNoDiaCalendario } from '@/lib/obra-dias-trabalho'
import { applyAgendaMesFiltro } from '@/lib/obra-mes-filtro'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import { fmtDate } from '@/lib/utils'
import type { ObraFull } from '@/types'

function hojeIsoLocal(ref: Date = new Date()): string {
  const y = ref.getFullYear()
  const m = String(ref.getMonth() + 1).padStart(2, '0')
  const d = String(ref.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface ObraFiltrosFila {
  busca: string
  mesFiltro: AgendaMesFiltro
  /** ISO `YYYY-MM-DD` — quando preenchido, só obras daquele dia. */
  dataDia: string
}

export interface FilaDataColuna {
  /** Data de entrega (ISO YYYY-MM-DD). */
  iso: string
  label: string
  /** Coluna de prazo já vencido. */
  atrasada: boolean
  /** É o dia de hoje. */
  hoje: boolean
  cor: string
  obras: ObraFull[]
}

/**
 * Só entra na fila se estiver aberta e tiver datas previstas
 * (início e fim). Sem datas → não aparece.
 */
export function obraVisivelNaFila(obra: ObraFull): boolean {
  const status = getStatusEfetivo(obra)
  if (status === 'concluida' || status === 'cancelada') return false
  return Boolean(obra.data_prevista_inicio && obra.data_prevista_fim)
}

function obraMatchesBuscaFila(obra: ObraFull, q: string): boolean {
  if (!q) return true
  const status = getStatusEfetivo(obra)
  const haystack = [
    obra.cliente_nome,
    obra.lousa,
    obra.endereco_obra,
    obra.tipo_obra_nome,
    obra.grupo_obra_nome,
    obra.montador_nome,
    obra.montador_admin_nome,
    obra.data_prevista_inicio,
    obra.data_prevista_fim,
    status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

/** Dentro de uma data: nome do cliente. */
function sortObrasDentroDoDia(obras: ObraFull[]): ObraFull[] {
  return [...obras].sort((a, b) => {
    const iniA = a.data_prevista_inicio ?? ''
    const iniB = b.data_prevista_inicio ?? ''
    if (iniA !== iniB) return iniA.localeCompare(iniB)
    return a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
  })
}

/**
 * Ordena a lista plana: data de entrega crescente (atrasadas / mais cedo primeiro);
 * desempate por início e nome.
 */
export function sortObrasFila(
  obras: ObraFull[],
  _hojeIso: string = hojeIsoLocal(),
): ObraFull[] {
  return [...obras].sort((a, b) => {
    const fimA = a.data_prevista_fim ?? ''
    const fimB = b.data_prevista_fim ?? ''
    if (fimA !== fimB) return fimA.localeCompare(fimB)

    const iniA = a.data_prevista_inicio ?? ''
    const iniB = b.data_prevista_inicio ?? ''
    if (iniA !== iniB) return iniA.localeCompare(iniB)

    return a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
  })
}

export function filtrarObrasFila(
  obras: ObraFull[],
  filtros: ObraFiltrosFila,
  refDate: Date = new Date(),
): ObraFull[] {
  const q = filtros.busca.trim().toLowerCase()
  const hojeIso = hojeIsoLocal(refDate)

  let lista = obras.filter(obraVisivelNaFila)
  lista = applyAgendaMesFiltro(lista, filtros.mesFiltro, refDate)

  if (filtros.dataDia) {
    lista = lista.filter(obra =>
      obraVisivelNoDiaCalendario(obra, filtros.dataDia, [0, 1, 2, 3, 4, 5, 6], hojeIso),
    )
  }

  if (q) {
    lista = lista.filter(obra => obraMatchesBuscaFila(obra, q))
  }

  return sortObrasFila(lista, hojeIso)
}

/**
 * Uma coluna por data de entrega (`data_prevista_fim`), da mais cedo à mais tarde.
 * Assim as filas são só por data e cabem lado a lado (rolagem horizontal).
 */
export function groupObrasFilaPorData(
  obras: ObraFull[],
  refDate: Date = new Date(),
): FilaDataColuna[] {
  const hojeIso = hojeIsoLocal(refDate)
  const byDate = new Map<string, ObraFull[]>()

  for (const obra of obras) {
    const iso = obra.data_prevista_fim?.slice(0, 10)
    if (!iso) continue
    const list = byDate.get(iso)
    if (list) list.push(obra)
    else byDate.set(iso, [obra])
  }

  const isos = [...byDate.keys()].sort((a, b) => a.localeCompare(b))

  return isos.map(iso => {
    const atrasada = iso < hojeIso
    const hoje = iso === hojeIso
    const cor = atrasada ? '#ef4444' : hoje ? '#d97706' : '#3b82f6'
    return {
      iso,
      label: fmtDate(iso),
      atrasada,
      hoje,
      cor,
      obras: sortObrasDentroDoDia(byDate.get(iso) ?? []),
    }
  })
}
