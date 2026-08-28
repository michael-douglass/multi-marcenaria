export type ImagemOrientacaoSlide = 'paisagem' | 'retrato';

export const SLIDE_IMAGEM_PAISAGEM = { width: 1920, height: 1080 } as const;
export const SLIDE_IMAGEM_RETRATO = { width: 1080, height: 1920 } as const;

/** Dimensões nativas da pré-visualização fiel nas configurações. */
export const SLIDE_PREVIEW_DESKTOP = SLIDE_IMAGEM_PAISAGEM;
export const SLIDE_PREVIEW_MOBILE = SLIDE_IMAGEM_RETRATO;

export const FORMATO_IMAGEM_SLIDE_HINT =
  'Escolha o formato antes de enviar. A imagem será recortada e ajustada para 1920×1080 ou 1080×1920.';

const RATIO_PAISAGEM = SLIDE_IMAGEM_PAISAGEM.width / SLIDE_IMAGEM_PAISAGEM.height;
const RATIO_RETRATO = SLIDE_IMAGEM_RETRATO.width / SLIDE_IMAGEM_RETRATO.height;
const RATIO_TOLERANCIA = 0.04;

export function aspectRatioSlide(orientacao?: ImagemOrientacaoSlide | null): string {
  return orientacao === 'retrato' ? '9/16' : '16/9';
}

export function estiloContainerImagem(
  orientacao: ImagemOrientacaoSlide,
  opts?: { maxWidthRetratoDesktop?: number },
) {
  return {
    aspectRatio: aspectRatioSlide(orientacao),
    width: '100%',
    maxWidth: orientacao === 'retrato' ? (opts?.maxWidthRetratoDesktop ?? 360) : undefined,
  } as const;
}

export function labelOrientacaoSlide(orientacao: ImagemOrientacaoSlide): string {
  return orientacao === 'retrato' ? '1080×1920' : '1920×1080';
}

function detectarOrientacao(width: number, height: number): ImagemOrientacaoSlide | null {
  if (width < 1 || height < 1) return null;
  const ratio = width / height;
  if (Math.abs(ratio - RATIO_PAISAGEM) <= RATIO_TOLERANCIA) return 'paisagem';
  if (Math.abs(ratio - RATIO_RETRATO) <= RATIO_TOLERANCIA) return 'retrato';
  return null;
}

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

function recortarECobrir(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  alvo: { width: number; height: number },
) {
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = alvo.width / alvo.height;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (srcRatio > dstRatio) {
    sw = img.naturalHeight * dstRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else if (srcRatio < dstRatio) {
    sh = img.naturalWidth / dstRatio;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, alvo.width, alvo.height);
}

/** Redimensiona para 1920×1080 ou 1080×1920 conforme orientação escolhida (ou detectada). */
export async function processarImagemSlide(
  file: File,
  orientacaoForcada?: ImagemOrientacaoSlide,
): Promise<{ file: File; orientacao: ImagemOrientacaoSlide }> {
  const img = await carregarImagem(file);
  const orientacao =
    orientacaoForcada
    ?? detectarOrientacao(img.naturalWidth, img.naturalHeight)
    ?? 'paisagem';

  const alvo = orientacao === 'paisagem' ? SLIDE_IMAGEM_PAISAGEM : SLIDE_IMAGEM_RETRATO;
  const canvas = document.createElement('canvas');
  canvas.width = alvo.width;
  canvas.height = alvo.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');

  recortarECobrir(ctx, img, alvo);

  const MAX_BYTES = 480_000;
  let quality = 0.84;
  let blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar imagem.'))),
      'image/jpeg',
      quality,
    );
  });

  while (blob.size > MAX_BYTES && quality > 0.52) {
    quality -= 0.06;
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar imagem.'))),
        'image/jpeg',
        quality,
      );
    });
  }

  const nome = file.name.replace(/\.[^.]+$/, '') || 'slide';
  const processado = new File([blob], `${nome}-${alvo.width}x${alvo.height}.jpg`, { type: 'image/jpeg' });
  return { file: processado, orientacao };
}
