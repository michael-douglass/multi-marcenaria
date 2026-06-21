import type { ObraFull, ObraInput, ObraMontadorExecucao } from '@/types'

/** IDs de montadores da obra (lista de responsáveis, com fallback no montador principal). */
export function getObraMontadorIds(obra: Pick<ObraFull, 'montador_id' | 'montador_ids'>): string[] {
  if (obra.montador_ids?.length) return obra.montador_ids
  if (obra.montador_id) return [obra.montador_id]
  return []
}

/** Nomes exibíveis dos montadores atribuídos à obra. */
export function getObraMontadorNomes(obra: Pick<ObraFull, 'montador_id' | 'montador_nome' | 'montador_ids' | 'montador_nomes'>): string[] {
  if (obra.montador_nomes?.length) return obra.montador_nomes.filter(Boolean)
  if (obra.montador_nome?.trim()) return [obra.montador_nome.trim()]
  return []
}

/** Texto resumido para badge / detalhe (ex.: "João, Maria" ou "João +2"). */
export function formatObraMontadoresLabel(
  nomes: string[],
  compact = false,
): string | null {
  if (nomes.length === 0) return null
  if (nomes.length === 1) return nomes[0]
  if (compact && nomes.length > 2) return `${nomes[0]} +${nomes.length - 1}`
  if (compact) return nomes.slice(0, 2).join(', ')
  return nomes.join(', ')
}

/** Marcações de início/fim do montador logado nesta obra. */
export function getObraMontadorExecucao(
  obra: Pick<ObraFull, 'montadores_execucao'>,
  montadorId: string | null | undefined,
): ObraMontadorExecucao | undefined {
  if (!montadorId) return undefined
  return obra.montadores_execucao?.find(m => m.montador_id === montadorId)
}

/** Montador já iniciou a obra (marcação individual). */
export function montadorIniciouObra(
  obra: Pick<ObraFull, 'montadores_execucao'>,
  montadorId: string | null | undefined,
): boolean {
  return !!getObraMontadorExecucao(obra, montadorId)?.iniciado_em
}

/** Montador já concluiu a parte dele na obra. */
export function montadorConcluiuObra(
  obra: Pick<ObraFull, 'montadores_execucao'>,
  montadorId: string | null | undefined,
): boolean {
  return !!getObraMontadorExecucao(obra, montadorId)?.finalizado_em
}

export interface ObraMontadorConclusaoStatus {
  montador_id: string
  nome: string
  concluiu: boolean
  finalizado_em?: string | null
}

/** Status de conclusão individual de cada montador atribuído à obra. */
export function getObraMontadoresConclusao(
  obra: Pick<
    ObraFull,
    | 'montador_id'
    | 'montador_ids'
    | 'montador_nome'
    | 'montador_nomes'
    | 'montadores_execucao'
  >,
): ObraMontadorConclusaoStatus[] {
  const ids = getObraMontadorIds(obra)
  const nomes = getObraMontadorNomes(obra)

  return ids.map((montadorId, index) => {
    const exec = getObraMontadorExecucao(obra, montadorId)
    return {
      montador_id: montadorId,
      nome: nomes[index] ?? nomes[0] ?? 'Montador',
      concluiu: !!exec?.finalizado_em,
      finalizado_em: exec?.finalizado_em ?? null,
    }
  })
}

/** Todos os montadores atribuídos já marcaram conclusão individual. */
export function todosMontadoresConcluiramObra(
  obra: Pick<
    ObraFull,
    | 'montador_id'
    | 'montador_ids'
    | 'montador_nome'
    | 'montador_nomes'
    | 'montadores_execucao'
  >,
): boolean {
  const lista = getObraMontadoresConclusao(obra)
  if (lista.length === 0) return true
  return lista.every(m => m.concluiu)
}

/** Obra fechada no kanban, mas ainda há montador sem marcação individual. */
export function obraFechadaPeloAdministrador(
  obra: Pick<
    ObraFull,
    | 'montador_id'
    | 'montador_ids'
    | 'montador_nome'
    | 'montador_nomes'
    | 'montadores_execucao'
    | 'status_kanban'
    | 'finalizado_em'
  >,
): boolean {
  const obraFechada = obra.status_kanban === 'concluida' || !!obra.finalizado_em
  if (!obraFechada) return false
  return !todosMontadoresConcluiramObra(obra)
}

/** Preenche montador admin e grupo padrão quando um Montador Admin cria ou edita obra. */
export function applyMontadorAdminObraDefaults(
  input: ObraInput,
  userId: string | undefined,
  grupos: { id: string; montador_admin_id?: string | null }[],
  isMontadorAdmin: boolean,
): ObraInput {
  if (!isMontadorAdmin || !userId) return input

  const next = { ...input }
  // Montador Admin sempre cria obras sob sua própria responsabilidade.
  next.montador_admin_id = userId
  if (!next.grupo_obra_id) {
    const meusGrupos = grupos.filter(g => g.montador_admin_id === userId)
    if (meusGrupos.length === 1) {
      next.grupo_obra_id = meusGrupos[0].id
    }
  }
  return next
}

/** Separa campos da obra e lista de montadores para persistência. */
export function splitObraInputForSave(input: ObraInput): {
  obraFields: Omit<ObraInput, 'montador_ids'>
  montadorIds: string[]
} {
  const { montador_ids, ...obraFields } = input
  const montadorIds = [...new Set((montador_ids ?? []).filter(Boolean))]
  return {
    obraFields: {
      ...obraFields,
      montador_id: montadorIds[0] ?? null,
    },
    montadorIds,
  }
}
