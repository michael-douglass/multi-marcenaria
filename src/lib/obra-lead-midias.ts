import { collectObraLeadIds } from '@/lib/obra-markup-custos'
import type { LeadMidia, LeadMidiaTipo, ObraFull, UserRole } from '@/types'

export { collectObraLeadIds }

/** Montador admin (e gestores de obras) veem PDFs além das fotos. */
export function canViewLeadDocumentos(roles: UserRole[]): boolean {
  return (
    roles.includes('MontadorAdmin') ||
    roles.includes('Administrador') ||
    roles.includes('AdministradorObras')
  )
}

function normalizeTipo(raw: string | null | undefined): LeadMidiaTipo {
  if (raw === 'pdf' || raw === 'video' || raw === 'audio') return raw
  return 'imagem'
}

export function mapLeadMidiaRows(
  rows: Array<{
    id: string
    lead_id: string
    tipo: string
    titulo: string
    file_name: string
    file_url: string
    folder_nome?: string | null
    criado_em?: string | null
  }> | null | undefined,
): LeadMidia[] {
  return (rows ?? []).map(row => ({
    id: String(row.id),
    lead_id: String(row.lead_id),
    tipo: normalizeTipo(row.tipo),
    titulo: row.titulo || row.file_name || 'Arquivo',
    file_name: row.file_name || row.titulo || 'arquivo',
    file_url: row.file_url,
    folder_nome: row.folder_nome ?? null,
    criado_em: row.criado_em ?? null,
  }))
}

/** Agrupa mídias por lead_id (ordem já vem do RPC: mais recentes primeiro). */
export function groupLeadMidiasByLead(midias: LeadMidia[]): Map<string, LeadMidia[]> {
  const map = new Map<string, LeadMidia[]>()
  for (const midia of midias) {
    const list = map.get(midia.lead_id) ?? []
    list.push(midia)
    map.set(midia.lead_id, list)
  }
  return map
}

const EMPTY_LEAD_MIDIAS: LeadMidia[] = []

export function getObraLeadMidias(
  obra: Pick<ObraFull, 'origem_lead_id'>,
  midiasByLead: ReadonlyMap<string, LeadMidia[]>,
): LeadMidia[] {
  const leadId = obra.origem_lead_id?.trim()
  if (!leadId) return EMPTY_LEAD_MIDIAS
  return midiasByLead.get(leadId) ?? EMPTY_LEAD_MIDIAS
}
