import type { LeadWhiteboardDrawing } from '@/hooks/useLeadWhiteboard';
import { furnitureCorners } from '@/lib/furniture-modules';

export const WHITEBOARD_ANNOTATION_PREFIX = 'WB_JSON:';
export const WHITEBOARD_IMAGE_BIND_PREFIX = 'WB_IMG:';

/** Vincula um desenho (traço ou anotação) à foto em que foi criado. */
export function bindDrawingToImage(imageId: string, pathData: string): string {
  const { pathData: inner } = unbindDrawingImage(pathData);
  return `${WHITEBOARD_IMAGE_BIND_PREFIX}${imageId}:${inner}`;
}

/** Extrai o id da foto e o path_data original. */
export function unbindDrawingImage(pathData: string): { imageId: string | null; pathData: string } {
  if (!pathData.startsWith(WHITEBOARD_IMAGE_BIND_PREFIX)) {
    return { imageId: null, pathData };
  }
  const rest = pathData.slice(WHITEBOARD_IMAGE_BIND_PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep <= 0) return { imageId: null, pathData };
  return { imageId: rest.slice(0, sep), pathData: rest.slice(sep + 1) };
}

export function getDrawingPathData(pathData: string): string {
  return unbindDrawingImage(pathData).pathData;
}

export function drawingBelongsToImage(
  drawing: LeadWhiteboardDrawing,
  imageId: string,
  legacyFallbackImageId?: string | null,
): boolean {
  const { imageId: bound } = unbindDrawingImage(drawing.path_data);
  if (bound) return bound === imageId;
  return legacyFallbackImageId === imageId;
}

export function filterDrawingsByImage(
  drawings: LeadWhiteboardDrawing[],
  imageId: string,
  legacyFallbackImageId?: string | null,
): LeadWhiteboardDrawing[] {
  return drawings.filter((d) => drawingBelongsToImage(d, imageId, legacyFallbackImageId));
}

/** Limites da caixa de texto na lousa (coordenadas do mundo). */
export const WHITEBOARD_TEXT_MIN_W = 80;
export const WHITEBOARD_TEXT_MIN_H = 32;
export const WHITEBOARD_TEXT_MAX_W = 720;
export const WHITEBOARD_TEXT_MAX_H = 480;

export type WhiteboardShapeKind =
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'measure'
  | 'furniture_module';

export type FurnitureModuleType =
  // Nichos
  | 'nicho'
  | 'nicho_colmeia'
  | 'nicho_losango'
  | 'nicho_goulart'
  | 'nicho_vazio'
  | 'nicho_cruz'
  | 'nicho_hex'
  // Armários
  | 'armario_vazio'
  | 'armario_2_portas'
  | 'armario_4_portas'
  | 'armario_prateleiras'
  | 'armario_canto'
  // Guarda-roupas
  | 'guarda_roupa'
  | 'guarda_roupa_casal'
  | 'guarda_roupa_correr'
  | 'guarda_roupa_gavetas'
  // Cozinha
  | 'armario_cozinha'
  | 'armario_cozinha_2gav'
  | 'armario_cozinha_canto'
  // Demais
  | 'gaveta'
  | 'gaveta_3'
  | 'gaveta_5'
  | 'sapateira'
  | 'sapateira_basculante'
  | 'sapateira_prateleiras'
  | 'armario_aereo'
  | 'aereo_2portas'
  | 'aereo_prateleira'
  | 'painel_tv'
  | 'painel_tv_nichos'
  | 'painel_tv_rack'
  | 'mesa_cabeceira'
  | 'mesa_cabeceira_2gav'
  | 'bancada'
  | 'bancada_ilha'
  | 'cristaleira'
  | 'cristaleira_alta'
  | 'rack'
  | 'rack_2nichos'
  // Eletros e pia
  | 'forno_embutido'
  | 'forno_torre'
  | 'fogao_4bocas'
  | 'fogao_5bocas'
  | 'fogao_6bocas'
  | 'cooktop'
  | 'coifa_parede'
  | 'coifa_ilha'
  | 'depurador'
  | 'microondas'
  | 'geladeira'
  | 'lava_loucas'
  | 'cuba_pia'
  | 'air_fryer'
  | 'liquidificador'
  | 'cafeteira'
  | 'chaleira'
  | 'torradeira'
  | 'panela'
  // Espelhos
  | 'espelho_retangular'
  | 'espelho_oval'
  | 'espelho_redondo'
  | 'espelho_corpo'
  | 'espelheira'
  | 'espelho_adnet'
  // Quarto
  | 'cama'
  | 'cabeceira'
  | 'penteadeira'
  | 'abajur'
  | 'puff'
  | 'comoda'
  | 'luminaria_chao'
  // Sala — casa do cliente
  | 'cadeira'
  | 'cadeira_poltrona'
  | 'sofa'
  | 'sofa_2lugares'
  | 'sofa_canto'
  | 'modulo_cubo'
  // Decoração (Promob / Revit Furniture / Archicad Library)
  | 'tapete'
  | 'tapete_redondo'
  | 'cortina'
  | 'persiana'
  | 'vaso'
  | 'vaso_alto'
  | 'planta'
  | 'planta_chao'
  | 'quadro'
  | 'galeria_quadros'
  | 'almofada'
  | 'manta'
  | 'cachepot'
  | 'escultura'
  | 'relogio_parede'
  | 'livros'
  | 'lareira'
  | 'biombo'
  // Iluminação
  | 'pendente'
  | 'pendente_triplo'
  | 'arandela'
  | 'spot'
  | 'trilha_spots'
  | 'fita_led'
  | 'plafon'
  // Mesas e apoio
  | 'mesa_jantar'
  | 'mesa_jantar_redonda'
  | 'mesa_centro'
  | 'mesa_lateral'
  | 'aparador'
  | 'escrivaninha'
  | 'estante'
  | 'buffet'
  | 'chaise'
  // Bancadas e pedras (Silestone, Dekton, granito, mármore)
  | 'bancada_granito'
  | 'bancada_marmore'
  | 'bancada_quartzo'
  | 'bancada_silestone'
  | 'bancada_madeira'
  | 'bancada_corian'
  | 'pedra_marmore'
  | 'pedra_calacatta'
  | 'pedra_granito'
  | 'pedra_preto_sao_gabriel'
  | 'pedra_quartzito'
  | 'pedra_travertino'
  | 'pedra_sao_tome'
  // Revestimentos
  | 'revest_ripado'
  | 'revest_3d'
  | 'revest_porcelanato'
  | 'revest_tijolinho'
  | 'revest_cimento'
  | 'revest_papel'
  | 'revest_lambris'
  // Banheiro
  | 'cuba_apoiada'
  | 'gabinete_banheiro'
  | 'toalheiro'
  | 'banco'
  | 'banqueta'
  | 'candelabro'
  | 'tapete_pele'
  | 'planta_costela'
  | 'bancada_dekton'
  | 'pedra_carrara'
  | 'pedra_onyx'
  | 'revest_canjiquinha'
  | 'revest_pastilha'
  // Banheiro — armários e peças da casa
  | 'armario_banheiro_aereo'
  | 'armario_banheiro_aereo_vidro'
  | 'armario_banheiro_bancada'
  | 'armario_banheiro_bancada_vidro'
  | 'armario_banheiro_coluna'
  | 'gabinete_banheiro_gavetas'
  | 'nicho_box'
  | 'box_vidro'
  | 'ducha'
  | 'vaso_sanitario'
  | 'lixeira_banheiro'
  | 'papeleira'
  // Cozinha — mesas e marcenaria
  | 'mesa_cozinha'
  | 'mesa_cozinha_redonda'
  | 'mesa_cozinha_quadrada'
  | 'mesa_cozinha_extensivel'
  | 'mesa_cozinha_vidro'
  | 'mesa_cozinha_6lugares'
  | 'mesa_bistro'
  | 'paneleiro'
  | 'adega'
  | 'canto_cafe'
  | 'aereo_canto'
  | 'aereo_vidro'
  | 'torre_geladeira'
  // Guarda-roupas e closet
  | 'guarda_roupa_2portas'
  | 'guarda_roupa_4portas'
  | 'guarda_roupa_espelho'
  | 'guarda_roupa_canto'
  | 'guarda_roupa_solteiro'
  | 'guarda_roupa_vidro'
  | 'guarda_roupa_aberto'
  | 'closet'
  | 'closet_ilha'
  // Mesas — jantar, centro, apoio
  | 'mesa_jantar_oval'
  | 'mesa_jantar_quadrada'
  | 'mesa_jantar_6lugares'
  | 'mesa_jantar_8lugares'
  | 'mesa_jantar_vidro'
  | 'mesa_jantar_pedestal'
  | 'mesa_centro_redonda'
  | 'mesa_centro_vidro'
  | 'mesa_canto'
  | 'mesa_apoio'
  | 'mesa_bar'
  | 'mesa_industrial'
  | 'mesa_dobravel'
  // Sofás e poltronas
  | 'sofa_4lugares'
  | 'sofa_reclinavel'
  | 'sofa_cama'
  | 'sofa_modular'
  | 'sofa_namoradeira'
  | 'sofa_canto_chaise'
  | 'sofa_capitone'
  | 'poltrona_giro'
  | 'poltrona_leitura'
  // Quarto — camas e cômodas
  | 'cama_solteiro'
  | 'cama_casal'
  | 'cama_queen'
  | 'cama_king'
  | 'cama_beliche'
  | 'cama_bicama'
  | 'cabeceira_estofada'
  | 'cabeceira_capitone'
  | 'comoda_6gav'
  | 'berco'
  // Serviço e escritório
  | 'tanque'
  | 'armario_lavanderia'
  | 'cesto_roupa'
  | 'tabua_passar'
  | 'cadeira_escritorio'
  | 'arquivo';

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardMeasurePayload {
  kind: 'measure';
  a: WhiteboardPoint;
  b: WhiteboardPoint;
  via?: WhiteboardPoint;
  label: string;
  colorHex?: string;
  bidirectional?: boolean;
  showZone?: boolean;
}

export interface WhiteboardTextPayload {
  kind: 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  text: string;
  fontSize: number;
}

export interface WhiteboardRectPayload {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface WhiteboardEllipsePayload {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
}

export interface WhiteboardPolylinePayload {
  kind: 'polyline';
  points: WhiteboardPoint[];
}

export interface WhiteboardLinePayload {
  kind: 'line';
  a: WhiteboardPoint;
  b: WhiteboardPoint;
}

export interface WhiteboardFurnitureModulePayload {
  kind: 'furniture_module';
  moduleType: FurnitureModuleType;
  /** Topo do móvel (1º clique — de cima para baixo). */
  a: WhiteboardPoint;
  /** Base do móvel (2º clique — puxar para baixo). */
  b: WhiteboardPoint;
  /**
   * Legacy: altura perpendicular quando a/b eram a base horizontal.
   * Mantido para não quebrar anotações antigas.
   */
  heightOverride?: number;
  /** Largura do frontal; se omitida, usa proporção tipica do módulo. */
  widthOverride?: number;
  /**
   * true = a/b são sempre eixo altura (topo→base), mesmo após rotação horizontal.
   * Ausente = anotações antigas (heurística de orientação).
   */
  topDown?: boolean;
  /** Só o frontal, sem profundidade (banco retos). */
  flatFront?: boolean;
  colorHex?: string;
  /**
   * Índices das arestas/traços ocultos (apagados pelo usuário).
   * A ordem vem de furnitureFrame().lines.
   */
  hiddenLineIndices?: number[];
  /**
   * false/ausente = rascunho editável (apagar traços, redimensionar).
   * true = fixo após Salvar.
   */
  locked?: boolean;
}

export type WhiteboardAnnotationPayload =
  | WhiteboardTextPayload
  | WhiteboardRectPayload
  | WhiteboardEllipsePayload
  | WhiteboardLinePayload
  | WhiteboardPolylinePayload
  | WhiteboardMeasurePayload
  | WhiteboardFurnitureModulePayload;

export interface DecodedWhiteboardAnnotation {
  id: string;
  lead_id: number;
  cor: string;
  stroke_width: number;
  criado_em: string;
  payload: WhiteboardAnnotationPayload;
}

export function isAnnotationDrawing(drawing: LeadWhiteboardDrawing): boolean {
  return getDrawingPathData(drawing.path_data).startsWith(WHITEBOARD_ANNOTATION_PREFIX);
}

export function encodeAnnotationPayload(payload: WhiteboardAnnotationPayload): string {
  return WHITEBOARD_ANNOTATION_PREFIX + JSON.stringify(payload);
}

export function decodeAnnotationDrawing(drawing: LeadWhiteboardDrawing): DecodedWhiteboardAnnotation | null {
  const innerPath = getDrawingPathData(drawing.path_data);
  if (!innerPath.startsWith(WHITEBOARD_ANNOTATION_PREFIX)) return null;
  try {
    const payload = JSON.parse(
      innerPath.slice(WHITEBOARD_ANNOTATION_PREFIX.length),
    ) as WhiteboardAnnotationPayload;
    if (!payload?.kind) return null;
    return {
      id: drawing.id,
      lead_id: drawing.lead_id,
      cor: drawing.cor,
      stroke_width: Number(drawing.stroke_width),
      criado_em: drawing.criado_em,
      payload,
    };
  } catch {
    return null;
  }
}

/** Une anotação do servidor com versão local (otimista). 
 * Se uma anotação está na lista de otimistas, ela representa a intenção mais recente do usuário.
 */
export function mergeDecodedAnnotations(
  server: DecodedWhiteboardAnnotation,
  local: DecodedWhiteboardAnnotation,
): DecodedWhiteboardAnnotation {
  if (server.id !== local.id) return server;
  // Se está no estado otimista, a intenção do usuário é o que vale.
  // Mantemos metadados do servidor (como criado_em se preferir), mas o payload e estilo vêm do local.
  return {
    ...server,
    ...local,
    payload: local.payload,
  };
}

export function splitWhiteboardDrawings(drawings: LeadWhiteboardDrawing[]) {
  const strokes: LeadWhiteboardDrawing[] = [];
  const annotations: DecodedWhiteboardAnnotation[] = [];

  for (const d of drawings) {
    const ann = decodeAnnotationDrawing(d);
    if (ann) annotations.push(ann);
    else strokes.push(d);
  }

  return { strokes, annotations };
}

export function annotationBounds(payload: WhiteboardAnnotationPayload): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  switch (payload.kind) {
    case 'text':
    case 'rect': {
      const corners = rectCorners(payload.x, payload.y, payload.w, payload.h, payload.rotation);
      return boundsFromPoints(corners);
    }
    case 'ellipse': {
      const pad = Math.max(payload.rx, payload.ry);
      return {
        minX: payload.cx - pad,
        minY: payload.cy - pad,
        maxX: payload.cx + pad,
        maxY: payload.cy + pad,
      };
    }
    case 'polyline':
      return boundsFromPoints(payload.points);
    case 'line':
      return boundsFromPoints([payload.a, payload.b]);
    case 'measure': {
      const pts = [payload.a, payload.b];
      if (payload.via) pts.push(payload.via);
      return boundsFromPoints(pts);
    }
    case 'furniture_module': {
      return boundsFromPoints(
        furnitureCorners(
          payload.a,
          payload.b,
          payload.moduleType,
          payload.heightOverride,
          payload.widthOverride,
          payload.topDown === true,
        ),
      );
    }
    default:
      return { minX: 0, minY: 0, maxX: WORLD_MIN, maxY: WORLD_MIN };
  }
}

const WORLD_MIN = 400;

function boundsFromPoints(points: WhiteboardPoint[]) {
  if (!points.length) {
    return { minX: 0, minY: 0, maxX: WORLD_MIN, maxY: WORLD_MIN };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function rectCorners(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number,
): WhiteboardPoint[] {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const local = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
  return local.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

export function polylineToPath(points: WhiteboardPoint[]): string {
  if (!points.length) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
}

export function lineToPath(a: WhiteboardPoint, b: WhiteboardPoint): string {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

export function distanceSq(a: WhiteboardPoint, b: WhiteboardPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Distância em coordenadas do mundo para clicar num ponto existente. */
export const POINT_HIT_RADIUS = 14;

export function findNearestPolylinePoint(
  annotations: DecodedWhiteboardAnnotation[],
  world: WhiteboardPoint,
  excludeAnnotationId?: string,
): { annotationId: string; pointIndex: number } | null {
  const hitR2 = POINT_HIT_RADIUS * POINT_HIT_RADIUS;
  let best: { annotationId: string; pointIndex: number; d2: number } | null = null;

  for (const ann of annotations) {
    if (ann.id === excludeAnnotationId) continue;
    if (ann.payload.kind !== 'polyline') continue;
    ann.payload.points.forEach((p, idx) => {
      const d2 = distanceSq(p, world);
      if (d2 <= hitR2 && (!best || d2 < best.d2)) {
        best = { annotationId: ann.id, pointIndex: idx, d2 };
      }
    });
  }

  return best ? { annotationId: best.annotationId, pointIndex: best.pointIndex } : null;
}
