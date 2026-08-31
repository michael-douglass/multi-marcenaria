import type {
  AmbienteBackground,
  AmbienteFurnitureObject,
  AmbienteGeoShape,
  AmbienteImageOverlay,
  AmbienteLabelMarker,
} from '@/lib/lead-ai-ambiente-types';

const SHAPE_LABELS: Record<string, string> = {
  rect: 'retângulo',
  ellipse: 'elipse',
  line: 'linha',
  triangle: 'triângulo',
  pencil: 'traço livre',
};

export interface AmbienteInventarioInput {
  descricao?: string;
  background: AmbienteBackground | null;
  overlays: AmbienteImageOverlay[];
  objects: AmbienteFurnitureObject[];
  markers: AmbienteLabelMarker[];
  shapes?: AmbienteGeoShape[];
}

function yamlScalar(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return 'null';
  if (/[:#\n"'{}[\]]/.test(trimmed)) return JSON.stringify(trimmed);
  return trimmed;
}

function pct(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function describePosicao(x: number, y: number): string {
  const horizontal = x < 0.33 ? 'esquerda' : x > 0.66 ? 'direita' : 'centro';
  const vertical = y < 0.33 ? 'topo' : y > 0.66 ? 'base' : 'meio';
  return `${vertical}-${horizontal} (${pct(x)}% × ${pct(y)}%)`;
}

/**
 * Lista objetiva do que o vendedor montou na lousa.
 * A IA de imagem usa isso como fonte da verdade — não pode variar o móvel.
 */
export function buildAmbienteCenaInventario(input: AmbienteInventarioInput): string {
  const shapes = input.shapes ?? [];
  const tiposDesenho = [...new Set(shapes.map((shape) => SHAPE_LABELS[shape.kind] || shape.kind))];

  const lines: string[] = [
    'tipo: inventario_cena_montada',
    'cena_montada:',
    `  tem_foto_fundo: ${input.background ? 'true' : 'false'}`,
    `  foto_fundo: ${yamlScalar(input.background?.label ?? null)}`,
    `  desenhos_na_lousa: ${shapes.length}`,
    `  tipos_desenho: [${tiposDesenho.map((item) => yamlScalar(item)).join(', ')}]`,
    `  fotos_de_moveis_posicionadas: ${input.overlays.length}`,
    `  icones_de_catalogo: ${input.objects.length}`,
    `  marcadores: ${input.markers.length}`,
  ];

  if (input.descricao?.trim()) {
    lines.push(`descricao_do_ambiente: ${yamlScalar(input.descricao.trim())}`);
  }

  lines.push('moveis_posicionados:');

  const placed = [
    ...input.overlays.map((overlay, index) => ({
      fonte: 'foto_projeto',
      nome: overlay.label || `Foto ${index + 1}`,
      posicao: describePosicao(overlay.x + overlay.width / 2, overlay.y + overlay.height / 2),
      tamanho: `${pct(overlay.width)}% × ${pct(overlay.height)}%`,
      rotacao: Math.round(overlay.rotation || 0),
      extra: '  tipo_modulo: null',
    })),
    ...input.objects.map((object) => ({
      fonte: 'icone_catalogo',
      nome: object.label || object.moduleType,
      posicao: describePosicao(object.x, object.y),
      tamanho: `${pct(object.width)}% × ${pct(object.height)}%`,
      rotacao: Math.round(object.rotation || 0),
      extra: `  tipo_modulo: ${yamlScalar(object.moduleType)}\n  cor: ${yamlScalar(object.colorHex || '#f2d892')}`,
    })),
  ];

  if (placed.length === 0) {
    lines.push('  []');
  } else {
    for (const item of placed) {
      lines.push(`  - fonte: ${item.fonte}`);
      lines.push(`    nome: ${yamlScalar(item.nome)}`);
      lines.push(`    posicao: ${yamlScalar(item.posicao)}`);
      lines.push(`    tamanho: ${item.tamanho}`);
      lines.push(`    rotacao_graus: ${item.rotacao}`);
      lines.push(item.extra);
      lines.push('    regra: reproduzir_identico');
    }
  }

  lines.push('marcadores:');
  if (input.markers.length === 0) {
    lines.push('  []');
  } else {
    for (const marker of input.markers) {
      lines.push(`  - nome: ${yamlScalar(marker.nome)}`);
      lines.push(`    posicao: ${yamlScalar(describePosicao(marker.x, marker.y))}`);
    }
  }

  lines.push(
    'regra_geral: Cada móvel listado e visível na montagem deve aparecer na foto final com o MESMO desenho, módulos, materiais, cores e proporções. É proibido criar variação do produto. O cômodo (piso, paredes, luz, clima) vem da descrição e da foto de fundo.',
  );

  return lines.join('\n');
}
