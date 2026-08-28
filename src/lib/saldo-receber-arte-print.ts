/**
 * Captura da arte de saldo a receber (JPG).
 * Clona o nó fora do Dialog (que usa transform) — html2canvas falha com ancestrais transformados.
 */

export interface SaldoReceberArteOpts {
  prestadorNome: string;
  valorSaldo: number;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
}

export function fileSafeArteName(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'prestador'
  );
}

/** Converte URL remota em data URL (evita canvas “contaminado” por CORS). */
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Falha ao ler logo'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  ).then(() => undefined);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

/** Aumenta contraste e saturação — html2canvas tende a gerar JPG “lavado”. */
function sharpenExportCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const contrast = 1.22;
  const brightness = -12;
  const saturation = 1.18;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] + brightness;
    let g = data[i + 1] + brightness;
    let b = data[i + 2] + brightness;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(image, 0, 0);
}

/**
 * Gera e baixa JPG nítido a partir do elemento da prévia.
 * Clona para o body (sem transform do Dialog) e embute a logo como data URL.
 */
export async function baixarArteSaldoReceberJpg(
  sourceEl: HTMLElement,
  fileName: string,
  logoUrl?: string | null,
): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;

  const width = Math.max(sourceEl.offsetWidth, sourceEl.scrollWidth, 640);
  const height = Math.max(sourceEl.offsetHeight, sourceEl.scrollHeight, 1);

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.removeAttribute('data-state');
  clone.classList.remove(
    'motion-safe:animate-in',
    'motion-safe:fade-in',
    'motion-safe:zoom-in-95',
    'motion-safe:duration-500',
  );
  clone.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${width}px`,
    'margin:0',
    'transform:none',
    'opacity:1',
    'filter:none',
    'pointer-events:none',
    'z-index:-1',
    'box-shadow:none',
    'background-color:#e8d9b8',
  ].join(';');

  // Fundo mais encorpado no export (a prévia clara “lava” no JPG)
  const bg = clone.querySelector<HTMLElement>('[data-arte-bg]');
  if (bg) {
    bg.style.background =
      'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,162,39,0.42) 0%, transparent 55%), radial-gradient(ellipse 40% 35% at 90% 85%, rgba(31,107,69,0.18) 0%, transparent 50%), linear-gradient(165deg, #f3e6c8 0%, #e4d0a4 45%, #d4bc7a 100%)';
  }
  clone.querySelector('[data-arte-grain]')?.remove();

  clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
    node.style.opacity = '1';
  });

  // Valor em cor sólida e mais escura
  clone.querySelectorAll('[data-arte-valor]').forEach((node) => {
    const el = node as HTMLElement;
    el.style.background = 'none';
    el.style.webkitBackgroundClip = 'unset';
    el.style.backgroundClip = 'unset';
    el.style.color = '#145c38';
    el.style.fontWeight = '700';
  });

  document.body.appendChild(clone);

  try {
    const logoImg = clone.querySelector<HTMLImageElement>('img[data-arte-logo]');
    if (logoImg && logoUrl) {
      const dataUrl = await urlToDataUrl(logoUrl);
      if (dataUrl) {
        logoImg.removeAttribute('crossorigin');
        logoImg.style.filter = 'none';
        logoImg.src = dataUrl;
      } else {
        logoImg.remove();
      }
    } else if (logoImg && !logoUrl) {
      logoImg.remove();
    }

    await waitForImages(clone);
    // Pequena pausa para o browser pintar fontes/gradientes no clone
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#e8d9b8',
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15_000,
    });

    if (canvas.width < 2 || canvas.height < 2) {
      throw new Error('Canvas vazio');
    }

    sharpenExportCanvas(canvas);

    const safeName = fileName.replace(/\.jpe?g$/i, '') + '.jpg';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar JPG'))),
        'image/jpeg',
        0.98,
      );
    });

    triggerDownload(blob, safeName);
  } finally {
    clone.remove();
  }
}
