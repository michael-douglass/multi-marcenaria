export interface IrisSpotCoords {
  normalizedX: number;
  normalizedY: number;
}

export interface IrisSpotVisionPayload {
  cropBase64: string;
  normalizedX: number;
  normalizedY: number;
}

const MAX_IMAGE_EDGE_PX = 1280;
const JPEG_QUALITY = 0.72;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    void (async () => {
      let objectUrl: string | null = null;
      try {
        let imageSrc = src;
        if (src.startsWith('http://') || src.startsWith('https://')) {
          const response = await fetch(src);
          if (!response.ok) throw new Error('Falha ao baixar imagem');
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          imageSrc = objectUrl;
        }

        const img = new Image();
        img.onload = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          reject(new Error('Não foi possível carregar a imagem'));
        };
        img.src = imageSrc;
      } catch (error) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(error instanceof Error ? error : new Error('Não foi possível carregar a imagem'));
      }
    })();
  });
}

function scaleToMaxEdge(width: number, height: number, maxEdge: number) {
  const largest = Math.max(width, height);
  if (largest <= maxEdge) return { width, height };
  const ratio = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function drawScaledImage(img: HTMLImageElement, maxEdge = MAX_IMAGE_EDGE_PX): HTMLCanvasElement {
  const { width, height } = scaleToMaxEdge(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): string {
  return canvas.toDataURL('image/jpeg', quality);
}

/** Converte clique na tela em coordenadas 0–1 dentro da imagem renderizada. */
export function getNormalizedImageClickCoords(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
): IrisSpotCoords | null {
  const rect = img.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

  return { normalizedX: relX, normalizedY: relY };
}

/** Recorte comprimido em volta do ponto clicado para envio à Íris. */
export async function buildIrisSpotVisionPayload(
  imageSrc: string,
  coords: IrisSpotCoords,
  cropRadiusRatio = 0.18,
): Promise<IrisSpotVisionPayload> {
  const img = await loadImage(imageSrc);
  const scaledCanvas = drawScaledImage(img);
  const naturalW = scaledCanvas.width;
  const naturalH = scaledCanvas.height;

  const centerX = coords.normalizedX * naturalW;
  const centerY = coords.normalizedY * naturalH;
  const cropSize = Math.max(
    96,
    Math.round(Math.min(naturalW, naturalH) * cropRadiusRatio * 2),
  );

  const cropX = Math.max(0, Math.min(naturalW - cropSize, Math.round(centerX - cropSize / 2)));
  const cropY = Math.max(0, Math.min(naturalH - cropSize, Math.round(centerY - cropSize / 2)));

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropSize;
  cropCanvas.height = cropSize;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) throw new Error('Canvas indisponível');
  cropCtx.drawImage(
    scaledCanvas,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    cropSize,
    cropSize,
  );

  return {
    cropBase64: canvasToJpegBase64(cropCanvas),
    normalizedX: coords.normalizedX,
    normalizedY: coords.normalizedY,
  };
}
