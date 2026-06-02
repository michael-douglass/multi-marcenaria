import type { ObraFull } from '@/types'

type ObraMontadorFields = Pick<
  ObraFull,
  'montador_id' | 'montador_nome' | 'montador_admin_id' | 'montador_admin_nome'
>

/** Nome exibível do montador responsável (montador_id, ou admin se não houver montador). */
export function getMontadorResponsavelDisplay(obra: ObraMontadorFields): string | null {
  if (obra.montador_id) {
    const nome = obra.montador_nome?.trim()
    if (nome) return nome
  }

  if (!obra.montador_id && obra.montador_admin_id) {
    const admin = obra.montador_admin_nome?.trim()
    if (admin) return admin
  }

  return null
}
