import type { ObraComissaoItem, ObraFull, ObraInput } from '@/types'
import { getObraMontadorIds, getObraMontadorNomes } from '@/lib/obra-montadores'

/** Converte arrays paralelos da obra em itens de comissão. */
export function parseObraComissaoItens(obra: Pick<
  ObraFull,
  'comissao_prestador_ids' | 'comissao_prestador_nomes' | 'comissao_valores'
>): ObraComissaoItem[] {
  const ids = obra.comissao_prestador_ids ?? []
  const nomes = obra.comissao_prestador_nomes ?? []
  const valores = obra.comissao_valores ?? []
  return ids.map((prestador_id, i) => ({
    prestador_id,
    prestador_nome: nomes[i],
    valor: Number(valores[i] ?? 0),
  })).filter(item => item.valor > 0)
}

/** Itens de comissão visíveis para um prestador (ou todos para admin). */
export function getObraComissaoItensVisiveis(
  obra: Pick<
    ObraFull,
    'comissao_habilitada' | 'comissao_prestador_ids' | 'comissao_prestador_nomes' | 'comissao_valores'
  >,
  options?: { prestadorId?: string | null; showAll?: boolean },
): ObraComissaoItem[] {
  if (!obra.comissao_habilitada) return []
  const itens = parseObraComissaoItens(obra)
  if (options?.showAll || !options?.prestadorId) return itens
  return itens.filter(i => i.prestador_id === options.prestadorId)
}

/** Soma dos valores de comissão da obra. */
export function sumObraComissao(itens: ObraComissaoItem[]): number {
  return itens.reduce((acc, i) => acc + (Number(i.valor) || 0), 0)
}

/** Monta itens iniciais para o formulário a partir da obra ou dos montadores selecionados. */
export function buildComissaoItensFromObra(
  obra: ObraFull | null,
  montadorIds: string[],
  montadores: { id: string; nome?: string | null; email: string }[],
): ObraComissaoItem[] {
  if (obra) {
    const existentes = parseObraComissaoItens(obra)
    const map = new Map(existentes.map(i => [i.prestador_id, i]))
    return montadorIds.map(id => {
      const existente = map.get(id)
      const m = montadores.find(x => x.id === id)
      const nome = m?.nome ?? m?.email ?? existente?.prestador_nome
      return {
        prestador_id: id,
        prestador_nome: nome,
        valor: existente?.valor ?? 0,
      }
    })
  }
  return montadorIds.map(id => {
    const m = montadores.find(x => x.id === id)
    return {
      prestador_id: id,
      prestador_nome: m?.nome ?? m?.email,
      valor: 0,
    }
  })
}

/** Extrai dados de comissão do ObraInput para RPC. */
export function splitComissaoForSave(input: ObraInput): {
  habilitada: boolean
  prestadorIds: string[]
  valores: number[]
} {
  const habilitada = input.comissao_habilitada ?? false
  const itens = (input.comissao_itens ?? []).filter(i => i.valor > 0)
  return {
    habilitada,
    prestadorIds: itens.map(i => i.prestador_id),
    valores: itens.map(i => Number(i.valor) || 0),
  }
}

/** Label para exibição nos cards (ex.: "João: R$ 300"). */
export function formatComissaoStripLabel(
  itens: ObraComissaoItem[],
  fmt: (v: number) => string,
): string | null {
  if (!itens.length) return null
  return itens
    .map(i => `${i.prestador_nome ?? 'Montador'}: ${fmt(i.valor)}`)
    .join(' · ')
}

/** Nomes dos montadores com fallback para montador principal. */
export function getMontadorOptionsForComissao(
  obra: ObraFull | null,
  montadorIds: string[],
  montadores: { id: string; nome?: string | null; email: string }[],
): { id: string; nome: string }[] {
  const ids = montadorIds.length
    ? montadorIds
    : obra
      ? getObraMontadorIds(obra)
      : []
  const nomes = obra ? getObraMontadorNomes(obra) : []
  return ids.map((id, i) => {
    const m = montadores.find(x => x.id === id)
    return {
      id,
      nome: m?.nome ?? m?.email ?? nomes[i] ?? 'Montador',
    }
  })
}
