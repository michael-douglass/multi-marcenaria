export interface LeadAIRenderEditPonto {
  id: number;
  x: number;
  y: number;
}

/** Raio da região editável em relação ao menor lado da imagem (≈9%). */
export const EDIT_REGION_RADIUS_RATIO = 0.09;

const PIN_RADIUS = 18;
const GOLD = '#c9a07b';
const GOLD_DARK = '#8b6914';
const MAHOGANY = '#2a1812';

export function loadImageForMarkers(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem para edição'));
    img.src = url;
  });
}

/** Desenha a render com guias de região + pins numerados (referência visual para a IA). */
export function drawMarkedRenderToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  points: LeadAIRenderEditPonto[],
  regionRadiusRatio = EDIT_REGION_RADIUS_RATIO,
): void {
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);

  const radius = Math.max(24, Math.min(w, h) * regionRadiusRatio);

  for (const point of points) {
    const cx = point.x * w;
    const cy = point.y * h;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 72, 72, 0.92)';
    ctx.lineWidth = Math.max(2, w / 512);
    ctx.setLineDash([Math.max(6, w / 170), Math.max(4, w / 256)]);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 72, 72, 0.12)';
    ctx.fill();
    ctx.restore();
  }

  for (const point of points) {
    drawPin(ctx, point.x * w, point.y * h, point.id, w);
  }
}

export function prepareSurgicalEditImages(
  image: HTMLImageElement,
  points: LeadAIRenderEditPonto[],
): { maskImageBase64: string; markedImageBase64: string } {
  const maskCanvas = document.createElement('canvas');
  generateEditMaskCanvas(maskCanvas, image, points);

  const markedCanvas = document.createElement('canvas');
  drawMarkedRenderToCanvas(markedCanvas, image, points);

  return {
    maskImageBase64: exportMaskBase64(maskCanvas),
    markedImageBase64: exportMarkedImageBase64(markedCanvas),
  };
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  id: number,
  canvasWidth: number,
): void {
  const scale = Math.max(0.75, Math.min(1.5, canvasWidth / 1200));
  const r = PIN_RADIUS * scale;
  const lineW = Math.max(2, 2.5 * scale);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8 * scale;
  ctx.shadowOffsetY = 2 * scale;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = MAHOGANY;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = lineW;
  ctx.strokeStyle = GOLD;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r - lineW * 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = `${GOLD}88`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.font = `bold ${Math.round(14 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id), cx, cy + 0.5);

  ctx.fillStyle = GOLD_DARK;
  ctx.font = `600 ${Math.round(9 * scale)}px system-ui, sans-serif`;
  ctx.fillText(`P${id}`, cx, cy + r + 10 * scale);

  ctx.restore();
}

export function exportMarkedImageBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/** Converte qualquer imagem carregada no navegador para PNG (base64). */
export function imageElementToPngBase64(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem para edição');
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

/** Máscara PNG: opaco = preservar; transparente = região editável (API OpenAI). */
export function generateEditMaskCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  points: LeadAIRenderEditPonto[],
  regionRadiusRatio = EDIT_REGION_RADIUS_RATIO,
): void {
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const radius = Math.max(24, Math.min(w, h) * regionRadiusRatio);
  ctx.globalCompositeOperation = 'destination-out';
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x * w, point.y * h, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function exportMaskBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/** Diâmetro da região de edição em px no container (object-contain). */
export function editRegionDiameterPx(
  containerRect: DOMRect,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  regionRadiusRatio = EDIT_REGION_RADIUS_RATIO,
): number {
  if (!imageNaturalWidth || !imageNaturalHeight) return 0;

  const containerW = containerRect.width;
  const containerH = containerRect.height;
  const imageAspect = imageNaturalWidth / imageNaturalHeight;
  const containerAspect = containerW / containerH;

  let renderedW: number;
  let renderedH: number;

  if (imageAspect > containerAspect) {
    renderedW = containerW;
    renderedH = containerW / imageAspect;
  } else {
    renderedH = containerH;
    renderedW = containerH * imageAspect;
  }

  const radiusPx = Math.max(16, Math.min(renderedW, renderedH) * regionRadiusRatio);
  return radiusPx * 2;
}

/** Converte clique em coordenadas normalizadas dentro da área da imagem object-contain. */
export function pointerToNormalizedPoint(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
): { x: number; y: number } | null {
  if (!imageNaturalWidth || !imageNaturalHeight) return null;

  const containerW = containerRect.width;
  const containerH = containerRect.height;
  const imageAspect = imageNaturalWidth / imageNaturalHeight;
  const containerAspect = containerW / containerH;

  let renderedW: number;
  let renderedH: number;
  let offsetX: number;
  let offsetY: number;

  if (imageAspect > containerAspect) {
    renderedW = containerW;
    renderedH = containerW / imageAspect;
    offsetX = 0;
    offsetY = (containerH - renderedH) / 2;
  } else {
    renderedH = containerH;
    renderedW = containerH * imageAspect;
    offsetX = (containerW - renderedW) / 2;
    offsetY = 0;
  }

  const localX = clientX - containerRect.left - offsetX;
  const localY = clientY - containerRect.top - offsetY;

  if (localX < 0 || localY < 0 || localX > renderedW || localY > renderedH) {
    return null;
  }

  return {
    x: localX / renderedW,
    y: localY / renderedH,
  };
}

/** Posição em px dentro do container para overlay object-contain. */
export function normalizedToContainerPosition(
  x: number,
  y: number,
  containerRect: DOMRect,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
): { left: number; top: number } | null {
  if (!imageNaturalWidth || !imageNaturalHeight) return null;

  const containerW = containerRect.width;
  const containerH = containerRect.height;
  const imageAspect = imageNaturalWidth / imageNaturalHeight;
  const containerAspect = containerW / containerH;

  let renderedW: number;
  let renderedH: number;
  let offsetX: number;
  let offsetY: number;

  if (imageAspect > containerAspect) {
    renderedW = containerW;
    renderedH = containerW / imageAspect;
    offsetX = 0;
    offsetY = (containerH - renderedH) / 2;
  } else {
    renderedH = containerH;
    renderedW = containerH * imageAspect;
    offsetX = (containerW - renderedW) / 2;
    offsetY = 0;
  }

  return {
    left: offsetX + x * renderedW,
    top: offsetY + y * renderedH,
  };
}

export const MAX_EDIT_PONTOS = 8;

export function nextPontoId(points: LeadAIRenderEditPonto[]): number {
  if (points.length === 0) return 1;
  return Math.max(...points.map((p) => p.id)) + 1;
}

export function findPontoAtPosition(
  points: LeadAIRenderEditPonto[],
  x: number,
  y: number,
  containerRect: DOMRect,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  hitRadiusPx = 22,
): LeadAIRenderEditPonto | null {
  for (const point of points) {
    const pos = normalizedToContainerPosition(
      point.x,
      point.y,
      containerRect,
      imageNaturalWidth,
      imageNaturalHeight,
    );
    if (!pos) continue;
    const dx = pos.left - x;
    const dy = pos.top - y;
    if (Math.hypot(dx, dy) <= hitRadiusPx) return point;
  }
  return null;
}
