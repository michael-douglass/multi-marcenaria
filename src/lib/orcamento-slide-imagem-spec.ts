export type ImagemOrientacaoSlide = 'paisagem' | 'retrato';

export const SLIDE_IMAGEM_PAISAGEM = { width: 1920, height: 1080 } as const;
export const SLIDE_IMAGEM_RETRATO = { width: 1080, height: 1920 } as const;

/** Dimensões nativas da pré-visualização fiel nas configurações. */
export const SLIDE_PREVIEW_DESKTOP = SLIDE_IMAGEM_PAISAGEM;
export const SLIDE_PREVIEW_MOBILE = SLIDE_IMAGEM_RETRATO;

export const FORMATO_IMAGEM_SLIDE_HINT =
  'Escolha o formato antes de enviar. A imagem será encaixada inteira (sem recorte) em 1920×1080 ou 1080×1920.';

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

/** Cor do fundo da apresentação — preenche as faixas quando a proporção da foto difere do quadro. */
const COR_FUNDO_SLIDE = '#0a0706';

/** Encaixa a imagem inteira no quadro (sem recorte nem ampliação além do necessário). */
function encaixarSemRecorte(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  alvo: { width: number; height: number },
) {
  const escala = Math.min(alvo.width / img.naturalWidth, alvo.height / img.naturalHeight);
  const dw = Math.round(img.naturalWidth * escala);
  const dh = Math.round(img.naturalHeight * escala);
  const dx = Math.round((alvo.width - dw) / 2);
  const dy = Math.round((alvo.height - dh) / 2);

  ctx.fillStyle = COR_FUNDO_SLIDE;
  ctx.fillRect(0, 0, alvo.width, alvo.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);
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

  encaixarSemRecorte(ctx, img, alvo);

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
