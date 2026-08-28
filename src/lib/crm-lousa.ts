export interface CrmLousaLeadResumo {
  lead_id: number
  lead_nome: string | null
  fotos: number
  tracos: number
}

export interface CrmLousaImage {
  id: string
  file_url: string
  file_name: string
  position_x: number
  position_y: number
  width: number
  height: number
  z_index: number
}

export interface CrmLousaDrawing {
  id: string
  path_data: string
  cor: string
  stroke_width: number
}

export interface CrmLousaBoard {
  lead_id: number
  lead_nome: string | null
  images: CrmLousaImage[]
  drawings: CrmLousaDrawing[]
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function parseLousaBoot(raw: unknown): CrmLousaLeadResumo[] {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (!Array.isArray(row.leads)) return []
  return row.leads.map(item => {
    const l = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      lead_id: asNumber(l.lead_id),
      lead_nome: typeof l.lead_nome === 'string' ? l.lead_nome : null,
      fotos: asNumber(l.fotos),
      tracos: asNumber(l.tracos),
    }
  }).filter(l => l.lead_id > 0)
}

export function parseLousaBoard(raw: unknown): CrmLousaBoard {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    lead_id: asNumber(row.lead_id),
    lead_nome: typeof row.lead_nome === 'string' ? row.lead_nome : null,
    images: Array.isArray(row.images) ? row.images as CrmLousaImage[] : [],
    drawings: Array.isArray(row.drawings) ? row.drawings as CrmLousaDrawing[] : [],
  }
}

const IMG_BIND = 'WB_IMG:'

export function unbindDrawingImage(pathData: string): { imageId: string | null; pathData: string } {
  if (!pathData.startsWith(IMG_BIND)) return { imageId: null, pathData }
  const rest = pathData.slice(IMG_BIND.length)
  const sep = rest.indexOf(':')
  if (sep <= 0) return { imageId: null, pathData }
  return { imageId: rest.slice(0, sep), pathData: rest.slice(sep + 1) }
}

export function isSvgStroke(pathData: string): boolean {
  return drawingToSvgPath(pathData) != null
}

export function drawingToSvgPath(pathData: string): string | null {
  const inner = unbindDrawingImage(pathData).pathData.trim()
  if (inner.startsWith('M') || inner.startsWith('m')) return inner
  const jsonStr = inner.startsWith('WB_JSON:')
    ? inner.slice('WB_JSON:'.length)
    : inner.startsWith('{') ? inner : ''
  if (!jsonStr) return null
  try {
    const json = JSON.parse(jsonStr) as { kind?: string; points?: Array<{ x: unknown; y: unknown }> }
    if (json.kind !== 'polyline' || !Array.isArray(json.points) || json.points.length === 0) return null
    const pts = json.points
      .map(p => ({ x: Number(p.x), y: Number(p.y) }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    if (pts.length === 0) return null
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  } catch {
    return null
  }
}

export function filtrarLousaLeads(lista: CrmLousaLeadResumo[], busca: string): CrmLousaLeadResumo[] {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter(item => (item.lead_nome ?? '').toLowerCase().includes(termo) || String(item.lead_id).includes(termo))
}
