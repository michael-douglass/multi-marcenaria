export interface FurnitureFinishPreset {
  id: string;
  label: string;
  hex: string;
}

/** Cor padrão ao colocar um objeto — o 3D realista não pinta a madeira até o usuário escolher outra. */
export const DEFAULT_FURNITURE_COLOR = '#f2d892';

export function isCustomFurnitureColor(hex?: string): boolean {
  if (!hex) return false;
  return hex.trim().toLowerCase() !== DEFAULT_FURNITURE_COLOR;
}

/** Acabamentos de marcenaria, laca, tecido e pedra — para pintar a peça na lousa. */
export const FURNITURE_FINISH_PRESETS: FurnitureFinishPreset[] = [
  { id: 'mogno', label: 'Mogno', hex: '#3a241c' },
  { id: 'ouro', label: 'Ouro', hex: '#f2d892' },
  { id: 'noce', label: 'Noce', hex: '#6b4226' },
  { id: 'carvalho', label: 'Carvalho', hex: '#c4a574' },
  { id: 'laca_branca', label: 'Laca branca', hex: '#f4efe6' },
  { id: 'laca_preta', label: 'Laca preta', hex: '#1a1614' },
  { id: 'cinza', label: 'Cinza', hex: '#8a8580' },
  { id: 'verde', label: 'Verde musgo', hex: '#3d5c4a' },
  { id: 'azul', label: 'Azul petróleo', hex: '#3a4a62' },
  { id: 'terracota', label: 'Terracota', hex: '#a85a3a' },
  { id: 'linho', label: 'Linho', hex: '#d9cbb8' },
  { id: 'calacatta', label: 'Calacatta', hex: '#e8e2d6' },
  { id: 'granito', label: 'Granito', hex: '#2c2c2c' },
  { id: 'quartzo', label: 'Quartzo', hex: '#c4b8a8' },
];
