import type { FurnitureModuleType } from '@/lib/obra-lousa-annotations'

export interface FurnitureCatalogItem {
  type: FurnitureModuleType
  label: string
  family: string
  /** Proporção largura / altura típica */
  aspect: number
}

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  { type: 'nicho_simples', label: 'Nicho', family: 'Nicho', aspect: 1 },
  { type: 'armario_2_portas', label: 'Armário 2 portas', family: 'Armário', aspect: 0.7 },
  { type: 'armario_4_portas', label: 'Armário 4 portas', family: 'Armário', aspect: 1.2 },
  { type: 'guarda_roupa', label: 'Guarda-roupa', family: 'Guarda-roupa', aspect: 1.4 },
  { type: 'cozinha_armario', label: 'Armário cozinha', family: 'Cozinha', aspect: 1.1 },
  { type: 'gaveta_3', label: '3 gavetas', family: 'Gaveta', aspect: 1.2 },
  { type: 'aereo_2_portas', label: 'Aéreo 2 portas', family: 'Aéreo', aspect: 1.5 },
  { type: 'painel_tv', label: 'Painel TV', family: 'Painel', aspect: 2 },
  { type: 'bancada', label: 'Bancada', family: 'Bancada', aspect: 2.2 },
  { type: 'rack', label: 'Rack', family: 'Rack', aspect: 2 },
]

/** Desenha esboço isométrico simples do móvel no SVG path. */
export function furnitureModulePaths(
  moduleType: FurnitureModuleType,
  topX: number,
  topY: number,
  bottomX: number,
  bottomY: number,
  widthOverride?: number,
): string[] {
  const height = Math.max(24, Math.hypot(bottomX - topX, bottomY - topY))
  const catalog = FURNITURE_CATALOG.find(c => c.type === moduleType)
  const aspect = catalog?.aspect ?? 1
  const width = widthOverride ?? Math.max(40, height * aspect)
  const cx = (topX + bottomX) / 2
  const angle = Math.atan2(bottomY - topY, bottomX - topX) - Math.PI / 2

  const corners = [
    { x: -width / 2, y: 0 },
    { x: width / 2, y: 0 },
    { x: width / 2, y: height },
    { x: -width / 2, y: height },
  ].map(p => ({
    x: cx + p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: topY + p.x * Math.sin(angle) + p.y * Math.cos(angle),
  }))

  const [tl, tr, br, bl] = corners
  const outline = `M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`
  const paths = [outline]

  // Divisões internas por tipo
  if (moduleType === 'armario_2_portas' || moduleType === 'aereo_2_portas' || moduleType === 'guarda_roupa') {
    const mx1 = (tl.x + tr.x) / 2
    const my1 = (tl.y + tr.y) / 2
    const mx2 = (bl.x + br.x) / 2
    const my2 = (bl.y + br.y) / 2
    paths.push(`M ${mx1} ${my1} L ${mx2} ${my2}`)
  }

  if (moduleType === 'armario_4_portas') {
    for (let i = 1; i <= 3; i++) {
      const t = i / 4
      const ax = tl.x + (tr.x - tl.x) * t
      const ay = tl.y + (tr.y - tl.y) * t
      const bx = bl.x + (br.x - bl.x) * t
      const by = bl.y + (br.y - bl.y) * t
      paths.push(`M ${ax} ${ay} L ${bx} ${by}`)
    }
  }

  if (moduleType === 'gaveta_3') {
    for (let i = 1; i <= 2; i++) {
      const t = i / 3
      const ax = tl.x + (bl.x - tl.x) * t
      const ay = tl.y + (bl.y - tl.y) * t
      const bx = tr.x + (br.x - tr.x) * t
      const by = tr.y + (br.y - tr.y) * t
      paths.push(`M ${ax} ${ay} L ${bx} ${by}`)
    }
  }

  if (moduleType === 'nicho_simples' || moduleType === 'painel_tv' || moduleType === 'rack') {
    const inset = 0.2
    const ix1 = tl.x + (tr.x - tl.x) * inset + (bl.x - tl.x) * inset
    const iy1 = tl.y + (tr.y - tl.y) * inset + (bl.y - tl.y) * inset
    const ix2 = tl.x + (tr.x - tl.x) * (1 - inset) + (bl.x - tl.x) * inset
    const iy2 = tl.y + (tr.y - tl.y) * (1 - inset) + (bl.y - tl.y) * inset
    const ix3 = tl.x + (tr.x - tl.x) * (1 - inset) + (bl.x - tl.x) * (1 - inset)
    const iy3 = tl.y + (tr.y - tl.y) * (1 - inset) + (bl.y - tl.y) * (1 - inset)
    const ix4 = tl.x + (tr.x - tl.x) * inset + (bl.x - tl.x) * (1 - inset)
    const iy4 = tl.y + (tr.y - tl.y) * inset + (bl.y - tl.y) * (1 - inset)
    paths.push(`M ${ix1} ${iy1} L ${ix2} ${iy2} L ${ix3} ${iy3} L ${ix4} ${iy4} Z`)
  }

  return paths
}
