import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import {
  getFurnitureModuleMeta,
  searchFurnitureModules,
  type FurnitureCatalogGroupId,
  type FurnitureModuleMeta,
} from '@/lib/furniture-modules';
import {
  AMBIENTE_OBJECT_BASE_H,
  clampAmbienteObjectHeight,
  clampAmbienteObjectWidth,
} from '@/lib/lead-ai-ambiente-zoom';

/** Como o móvel aparece na lousa / compositor. */
export type FurnitureViewMode = 'reto' | '3d' | 'realista';

export type FurnitureCatalogBankId = FurnitureViewMode;

export interface FurnitureCatalogBank {
  id: FurnitureCatalogBankId;
  label: string;
  kicker: string;
  hint: string;
}

export const FURNITURE_CATALOG_BANKS: FurnitureCatalogBank[] = [
  {
    id: 'reto',
    label: 'Retos',
    kicker: 'Frontal',
    hint: 'Desenho de frente — planta reta, sem profundidade. O mesmo móvel do banco 3D.',
  },
  {
    id: '3d',
    label: '3D',
    kicker: 'Volume',
    hint: 'Desenho em volume — o mesmo móvel do banco retos, com profundidade.',
  },
  {
    id: 'realista',
    label: 'Realistas',
    kicker: 'Casa',
    hint: 'Peças para montar o projeto na casa do cliente — tamanho ajustável na cena.',
  },
];

export interface RealisticProjectGroup {
  id: string;
  label: string;
  types: FurnitureModuleType[];
}

/** Banco da casa do cliente: cadeiras, sofás, guarda-roupas e módulos. */
export const REALISTIC_PROJECT_GROUPS: RealisticProjectGroup[] = [
  {
    id: 'cadeiras',
    label: 'Cadeiras',
    types: ['cadeira', 'cadeira_poltrona', 'puff'],
  },
  {
    id: 'sofas',
    label: 'Sofás',
    types: ['sofa', 'sofa_2lugares', 'sofa_canto'],
  },
  {
    id: 'guarda_roupas',
    label: 'Guarda-roupas',
    types: ['guarda_roupa', 'guarda_roupa_casal', 'guarda_roupa_correr', 'guarda_roupa_gavetas'],
  },
  {
    id: 'modulos',
    label: 'Módulos',
    types: ['modulo_cubo', 'nicho', 'nicho_vazio', 'armario_2_portas', 'armario_vazio', 'rack'],
  },
];

const REALISTIC_TYPES = new Set(
  REALISTIC_PROJECT_GROUPS.flatMap((group) => group.types),
);

export function isRealisticProjectType(type: FurnitureModuleType): boolean {
  return REALISTIC_TYPES.has(type);
}

export function searchCatalogBank(
  bank: FurnitureCatalogBankId,
  query: string,
  group: FurnitureCatalogGroupId | string,
): FurnitureModuleMeta[] {
  if (bank !== 'realista') {
    return searchFurnitureModules(query, group as FurnitureCatalogGroupId);
  }

  const allowedTypes =
    group === 'todos'
      ? REALISTIC_PROJECT_GROUPS.flatMap((item) => item.types)
      : (REALISTIC_PROJECT_GROUPS.find((item) => item.id === group)?.types ??
        REALISTIC_PROJECT_GROUPS.flatMap((item) => item.types));

  const hits = searchFurnitureModules(query, 'todos');
  const byType = new Map(hits.map((mod) => [mod.type, mod]));
  return allowedTypes
    .map((type) => byType.get(type))
    .filter((mod): mod is FurnitureModuleMeta => Boolean(mod));
}

export function furnitureViewIsFlat(mode: FurnitureViewMode | undefined): boolean {
  return mode === 'reto';
}

/** Tamanho inicial na foto — sofá mais largo, cadeira mais compacta. */
export function ambienteFurnitureDefaultSize(
  moduleType: FurnitureModuleType,
  viewMode: FurnitureViewMode,
): { width: number; height: number } {
  const meta = getFurnitureModuleMeta(moduleType);
  const height = clampAmbienteObjectHeight(
    viewMode === 'realista' ? Math.max(0.22, AMBIENTE_OBJECT_BASE_H * 0.82) : AMBIENTE_OBJECT_BASE_H,
  );
  const width = clampAmbienteObjectWidth(height * Math.max(0.45, meta.aspectWidth) * 0.72);
  return { width, height };
}

export const GARBO_WOOD_TEXTURE_URL = '/imagens/apresentacao-garbo/projetos/cubo-painel-madeira.png';
