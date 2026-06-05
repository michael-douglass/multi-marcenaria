import type { ObraFull } from '@/types'
import { formatObraMontadoresLabel, getObraMontadorNomes } from '@/lib/obra-montadores'

type ObraMontadorFields = Pick<
  ObraFull,
  | 'montador_id'
  | 'montador_nome'
  | 'montador_ids'
  | 'montador_nomes'
  | 'montador_admin_id'
  | 'montador_admin_nome'
>

/** Nome(s) exibível(is) dos montadores (ou admin se não houver montador). */
export function getMontadorResponsavelDisplay(obra: ObraMontadorFields): string | null {
  const nomes = getObraMontadorNomes(obra)
  const label = formatObraMontadoresLabel(nomes)
  if (label) return label

  if (!obra.montador_id && obra.montador_admin_id) {
    const admin = obra.montador_admin_nome?.trim()
    if (admin) return admin
  }

  return null
}
