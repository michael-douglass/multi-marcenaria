const MAX_RENDER_EDGE_PX = 2048;
const JPEG_QUALITY = 0.92;

function scaleToMaxEdge(width: number, height: number, maxEdge: number) {
  const largest = Math.max(width, height);
  if (largest <= maxEdge) return { width, height };
  const ratio = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Carrega imagem de URL pública, blob: ou data: no navegador. */
export function loadImageForRender(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    void (async () => {
      let objectUrl: string | null = null;
      try {
        let imageSrc = src;
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) {
          const response = await fetch(src);
          if (!response.ok) throw new Error('Falha ao baixar imagem');
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          imageSrc = objectUrl;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
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

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  worldW: number,
  worldH: number,
): void {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (nw <= 0 || nh <= 0) return;

  const scale = Math.min(worldW / nw, worldH / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  const dx = (worldW - dw) / 2;
  const dy = (worldH - dh) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, worldW, worldH);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Converte qualquer imagem carregável no browser para JPEG (data URL) aceito pela OpenAI. */
export async function normalizeImageUrlToJpegDataUrl(sourceUrl: string): Promise<string> {
  const img = await loadImageForRender(sourceUrl);
  const worldW = Math.max(img.naturalWidth || 1, 1);
  const worldH = Math.max(img.naturalHeight || 1, 1);
  const { width, height } = scaleToMaxEdge(worldW, worldH, MAX_RENDER_EDGE_PX);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem para renderização');

  drawImageContain(ctx, img, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
