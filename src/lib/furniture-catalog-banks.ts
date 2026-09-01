import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import {
  FURNITURE_FAMILIES,
  FURNITURE_MODULES,
  getFurnitureModuleMeta,
  getFurnitureVariants,
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
    hint: 'Todos os móveis de frente — planta reta, sem profundidade.',
  },
  {
    id: '3d',
    label: '3D',
    kicker: 'Volume',
    hint: 'Os mesmos móveis em volume, com profundidade.',
  },
  {
    id: 'realista',
    label: 'Realistas',
    kicker: 'Casa',
    hint: 'Os mesmos móveis em madeira 3D — gire para os lados, frente e costas.',
  },
];

export interface RealisticProjectGroup {
  id: string;
  label: string;
  types: FurnitureModuleType[];
}

/** Famílias do catálogo completo — Realistas e Retos usam a mesma lista. */
export const REALISTIC_PROJECT_GROUPS: RealisticProjectGroup[] = FURNITURE_FAMILIES.map((family) => ({
  id: family.id,
  label: family.label,
  types: getFurnitureVariants(family.id).map((mod) => mod.type),
}));

const ALL_MODULE_TYPES = new Set(FURNITURE_MODULES.map((mod) => mod.type));

export function isRealisticProjectType(type: FurnitureModuleType): boolean {
  return ALL_MODULE_TYPES.has(type);
}

export function searchCatalogBank(
  bank: FurnitureCatalogBankId,
  query: string,
  group: FurnitureCatalogGroupId | string,
  favorites?: ReadonlySet<string>,
): FurnitureModuleMeta[] {
  void bank;
  return searchFurnitureModules(query, group as FurnitureCatalogGroupId, favorites);
}

export function furnitureViewIsFlat(mode: FurnitureViewMode | undefined): boolean {
  return mode === 'reto';
}

export function wrapOrbitYaw(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function clampOrbitPitch(deg: number): number {
  return Math.min(48, Math.max(-36, deg));
}

export function quantizeOrbitDeg(deg: number, step = 5): number {
  return Math.round(deg / step) * step;
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
