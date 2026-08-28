import { FURNITURE_MODULES } from '@/lib/furniture-modules';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import type { AmbienteSuggestion } from '@/lib/lead-ai-ambiente-types';

const KNOWN_TYPES = new Set(FURNITURE_MODULES.map((m) => m.type));

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function matchFurnitureModuleFromSuggestion(
  nome: string,
  tipoModulo?: string | null,
): FurnitureModuleType | null {
  const explicit = tipoModulo?.trim().toLowerCase();
  if (explicit && KNOWN_TYPES.has(explicit as FurnitureModuleType)) {
    return explicit as FurnitureModuleType;
  }

  const query = nome.trim().toLowerCase();
  if (!query) return null;

  const exact = FURNITURE_MODULES.find(
    (m) => m.type === query || m.label.toLowerCase() === query,
  );
  if (exact) return exact.type;

  const partial = FURNITURE_MODULES.find((m) => {
    const haystack = `${m.label} ${m.type} ${(m.keywords ?? []).join(' ')}`.toLowerCase();
    return haystack.includes(query) || query.includes(m.label.toLowerCase());
  });
  return partial?.type ?? null;
}

function fieldValue(block: string, key: string): string {
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${key}:\\s*(.+)`, 'i'));
  if (!match) return '';
  return match[1].replace(/^['"]|['"]$/g, '').trim();
}

/** Extrai chips de objetos sugeridos do YAML da análise de ambiente. */
export function parseAmbienteSugestoes(yamlText: string): AmbienteSuggestion[] {
  const sectionMatch = yamlText.match(
    /objetos_sugeridos:\s*\n([\s\S]*?)(?=\n[a-z_][\w]*:|\s*$)/i,
  );
  if (!sectionMatch) return [];

  const blocks = sectionMatch[1]
    .split(/\n\s*-\s+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: AmbienteSuggestion[] = [];

  for (const block of blocks) {
    const nome = fieldValue(block, 'nome') || fieldValue(block, 'id');
    if (!nome || nome.toLowerCase() === 'null') continue;

    const idRaw = fieldValue(block, 'id') || slugify(nome);
    const id = slugify(idRaw) || `obj-${result.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const tipoRaw = fieldValue(block, 'tipo_modulo');
    const tipoModulo = matchFurnitureModuleFromSuggestion(
      nome,
      tipoRaw && tipoRaw.toLowerCase() !== 'null' ? tipoRaw : null,
    );

    result.push({
      id,
      nome,
      categoria: fieldValue(block, 'categoria') || 'movel',
      tipoModulo,
      posicaoSugerida: fieldValue(block, 'posicao_sugerida'),
      justificativa: fieldValue(block, 'justificativa'),
    });
  }

  return result.slice(0, 12);
}
