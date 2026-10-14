import type { CutPiece, IndustrialLabel, ModuleSpec } from '@/lib/orcamentos-ia/bom-engine/types'

/**
 * Gera etiquetas industriais por peça (Módulos 5–6).
 * `barcode_payload` é texto estável para QR/código de barras na obra.
 */
export function buildIndustrialLabels(
  pieces: CutPiece[],
  spec: Pick<ModuleSpec, 'name' | 'room_tag'>,
): IndustrialLabel[] {
  const room = (spec.room_tag || 'GERAL').trim().toUpperCase().slice(0, 24)
  const moduleName = (spec.name || 'MODULO').trim().slice(0, 40)
  return pieces.map((p) => {
    const col = p.column_index != null ? `C${p.column_index}` : 'C0'
    const barcode_payload = [
      room,
      moduleName.replace(/\s+/g, '_').slice(0, 20),
      p.role,
      `${Math.round(p.width_mm)}x${Math.round(p.height_mm)}x${Math.round(p.thickness_mm)}`,
      col,
      `Q${p.quantity}`,
    ].join('|')
    return {
      room_tag: room,
      module_name: moduleName,
      piece_id: p.id,
      piece_name: p.name,
      role: p.role,
      width_mm: p.width_mm,
      height_mm: p.height_mm,
      thickness_mm: p.thickness_mm,
      quantity: p.quantity,
      column_index: p.column_index,
      barcode_payload,
    }
  })
}

/** Texto simples para impressão / cópia (sem dependência de impressora ZPL). */
export function formatLabelsForPrint(labels: IndustrialLabel[]): string {
  if (!labels.length) return ''
  const lines = [
    '=== ETIQUETAS INDUSTRIAIS (Orçamentos IA v11) ===',
    ...labels.map(
      (l, i) =>
        `${i + 1}. [${l.room_tag}] ${l.module_name} · ${l.piece_name} · ` +
        `${Math.round(l.width_mm)}×${Math.round(l.height_mm)}×${Math.round(l.thickness_mm)} mm · qtd ${l.quantity}` +
        (l.column_index != null ? ` · col ${l.column_index}` : '') +
        `\n   código: ${l.barcode_payload}`,
    ),
  ]
  return lines.join('\n')
}
