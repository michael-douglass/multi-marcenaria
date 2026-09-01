import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import type { FurnitureViewMode } from '@/lib/furniture-catalog-banks';

export interface AmbienteImageOverlay {
  id: string;
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Giro no plano da lousa (graus, sentido horário). */
  rotation: number;
  /** Virar no eixo vertical — transversal, para ver o lado. */
  yaw?: number;
  /** Inclinar para ver de cima ou de baixo. */
  pitch?: number;
  /** Espelhar esquerda/direita. */
  flipH?: boolean;
  /** Espelhar cima/baixo. */
  flipV?: boolean;
  zIndex: number;
}

export interface AmbienteFurnitureObject {
  id: string;
  moduleType: FurnitureModuleType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Giro no plano da foto (graus, sentido horário). */
  rotation: number;
  /** Virar a peça no eixo vertical — 0 frente, 90 lado, 180 costas. */
  yaw?: number;
  /** Inclinar para ver de cima ou de baixo. */
  pitch?: number;
  colorHex?: string;
  /** reto = frontal; 3d = volume; realista = madeira na casa do cliente. */
  viewMode?: FurnitureViewMode;
}

export interface AmbienteLabelMarker {
  id: string;
  nome: string;
  x: number;
  y: number;
}

/** Ferramenta ativa na lousa do ambiente. */
export type AmbienteDrawTool = 'select' | 'rect' | 'ellipse' | 'line' | 'triangle' | 'pencil';

export type AmbienteGeoKind = Exclude<AmbienteDrawTool, 'select'>;

/** Forma geométrica em coordenadas 0–1 da cena. */
export interface AmbienteGeoShape {
  id: string;
  kind: AmbienteGeoKind;
  /** Caixa: canto superior esquerdo. Linha: ponto inicial. Lápis: ignorado. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Fim da linha (0–1). */
  x2?: number;
  y2?: number;
  /** Traço livre (0–1). */
  points?: { x: number; y: number }[];
  rotation: number;
  stroke: string;
  fill: boolean;
}

export interface AmbienteSuggestion {
  id: string;
  nome: string;
  categoria: string;
  tipoModulo: FurnitureModuleType | null;
  posicaoSugerida: string;
  justificativa: string;
}

export interface AmbienteBackground {
  url: string;
  label: string;
  naturalWidth: number;
  naturalHeight: number;
  /** 1 = caber na cena; maior = mais perto; menor = mais longe. */
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Giro livre em graus (0–359), sentido horário. */
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

/** Foto vinda da galeria "Esboço do projeto" para a composição. */
export interface AmbienteIncomingPhoto {
  url: string;
  label: string;
  nonce: number;
  /** Se verdadeiro, a foto vira o fundo da lousa (não um recorte por cima). */
  asBackground?: boolean;
}

export interface AmbienteCompositionSnapshot {
  mode: 'ambiente';
  descricao: string;
  backgroundLabel: string | null;
  overlayCount: number;
  objectCount: number;
  markerCount: number;
}
