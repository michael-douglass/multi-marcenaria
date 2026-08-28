/**
 * Exportação do vídeo gravado em 480p / 720p / 1080p → sempre MP4 no download.
 * A gravação no Chrome pode ser WebM (estável); na hora de baixar convertemos para MP4.
 *
 * Importante (anti “imagem parada + áudio”):
 * - O <video> precisa continuar no pipeline de decode do browser.
 *   Elementos 2×2 fora da tela (left:-9999) fazem o Chrome pular frames de vídeo
 *   e gravar só o áudio — por isso usamos um player mínimo visível ao compositor.
 * - Preferimos video.captureStream() quando não há downscale (mais rápido/estável).
 * - Canvas só entra quando precisamos redimensionar ou converter WebM→MP4;
 *   frames via requestVideoFrameCallback + interval.
 */

import {
  isMp4MimeType,
  pickWindowsFriendlyMp4Mime,
  sniffVideoContainer,
} from '@/lib/orcamento-slide-video-browser';

export type OrcamentoExportQualityId = '480' | '720' | '1080';

export interface OrcamentoExportQualityOption {
  id: OrcamentoExportQualityId;
  /** Rótulo curto na UI. */
  label: string;
  /** Descrição (ex.: Full HD). */
  hint: string;
  /** Maior lado em pixels. */
  maxEdge: number;
  videoBitsPerSecond: number;
}

/** Atalho Full HD — mesma entrada da lista pública. */
export const ORCAMENTO_FULL_HD_EXPORT_QUALITY: OrcamentoExportQualityOption = {
  id: '1080',
  label: '1080p',
  hint: 'Full HD · máxima qualidade',
  maxEdge: 1080,
  // ~5 Mbps: nítido em slides e ~metade do tamanho anterior (evita travar o download).
  videoBitsPerSecond: 5_000_000,
};

/** Qualidades oferecidas no download do estúdio. */
export const ORCAMENTO_EXPORT_QUALITIES: readonly OrcamentoExportQualityOption[] = [
  {
    id: '480',
    label: '480p',
    hint: 'Mais leve · WhatsApp / envio rápido',
    maxEdge: 480,
    videoBitsPerSecond: 1_500_000,
  },
  {
    id: '720',
    label: '720p',
    hint: 'Equilíbrio · recomendado',
    maxEdge: 720,
    videoBitsPerSecond: 3_000_000,
  },
  ORCAMENTO_FULL_HD_EXPORT_QUALITY,
] as const;

const AUDIO_BITS_PER_SECOND = 128_000;

/** Arquivo convertido menor que isso quase sempre está corrompido. */
export const MIN_VALID_EXPORT_BYTES = 100_000;

export function getExportQualityOption(
  id: OrcamentoExportQualityId = '720',
): OrcamentoExportQualityOption {
  return (
    ORCAMENTO_EXPORT_QUALITIES.find((q) => q.id === id) ??
    ORCAMENTO_EXPORT_QUALITIES.find((q) => q.id === '720') ??
    ORCAMENTO_FULL_HD_EXPORT_QUALITY
  );
}

/**
 * True se o blob parece um vídeo real (não o “~200 KB vazio” do encoder quebrado).
 * @param durationMs duração gravada — se longa e o arquivo for minúsculo, rejeita.
 */
export function isPlausibleVideoBlob(
  blob: Blob,
  sourceBytes?: number,
  durationMs?: number,
): boolean {
  if (!blob || blob.size < 25_000) return false;

  if (durationMs && durationMs >= 2000) {
    // Piso bem conservador (~20 KB/s). Abaixo disso = encoder morto.
    const minByDuration = Math.min(220_000, Math.max(40_000, Math.round(durationMs * 20)));
    if (blob.size < minByDuration) return false;
  } else if (blob.size < MIN_VALID_EXPORT_BYTES) {
    return false;
  }

  // Reencode MP4 pode ficar bem menor que WebM — só rejeita se for ridículo.
  if (sourceBytes && sourceBytes > 500_000 && blob.size < sourceBytes * 0.04) {
    return false;
  }
  return true;
}

/** Estimativa de tamanho do arquivo final (bytes). */
export function estimateExportSizeBytes(opts: {
  durationSec: number;
  quality: OrcamentoExportQualityOption;
  /** Se a fonte já for menor que o alvo, usamos o tamanho real como teto. */
  sourceBytes?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}): number {
  const duration = Math.max(0.5, opts.durationSec);
  const bitsPerSec = opts.quality.videoBitsPerSecond + AUDIO_BITS_PER_SECOND;
  let estimate = Math.round((bitsPerSec / 8) * duration * 1.06);

  const srcW = opts.sourceWidth ?? 0;
  const srcH = opts.sourceHeight ?? 0;
  const srcEdge = Math.max(srcW, srcH);
  if (srcEdge > 0 && opts.sourceBytes && opts.sourceBytes > 0) {
    // Se pedir qualidade ≥ fonte, o arquivo não fica maior que o original (sem upscale).
    if (opts.quality.maxEdge >= srcEdge - 8) {
      estimate = Math.min(estimate, opts.sourceBytes);
    } else {
      const scale = (opts.quality.maxEdge / srcEdge) ** 2;
      const scaledFromSource = Math.round(opts.sourceBytes * Math.max(0.12, scale) * 0.95);
      // Média entre bitrate teórico e proporção do arquivo fonte.
      estimate = Math.round((estimate + scaledFromSource) / 2);
    }
  }

  return Math.max(40_000, estimate);
}

export function formatExportFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
}

function pickExportMime(hasAudio: boolean): string {
  // Windows / Filmes e TV: H.264 + AAC. Sem Opus disfarçado de MP4.
  const mp4 = pickWindowsFriendlyMp4Mime(hasAudio);
  if (mp4) return mp4;
  // Sem MP4 confiável — WebM (Chrome/VLC abrem; Windows Media Player não).
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const list = hasAudio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const mime of list) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* ignore */
    }
  }
  return 'video/webm';
}

/** Todos os MIME MP4 que o Chrome/Edge/Safari costumam aceitar no MediaRecorder. */
function listMp4MimeCandidates(hasAudio: boolean): string[] {
  if (typeof MediaRecorder === 'undefined') return [];
  const preferred = hasAudio
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1',
        'video/mp4',
      ]
    : [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1.4d002a',
        'video/mp4;codecs=avc1',
        'video/mp4',
      ];
  const out: string[] = [];
  for (const mime of preferred) {
    try {
      if (MediaRecorder.isTypeSupported(mime) && !out.includes(mime)) out.push(mime);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function clampSec(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

type VideoElWithCapture = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: unknown) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function captureVideoElementStream(video: VideoElWithCapture): MediaStream | null {
  if (typeof video.captureStream === 'function') {
    try {
      return video.captureStream();
    } catch {
      /* ignore */
    }
  }
  if (typeof video.mozCaptureStream === 'function') {
    try {
      return video.mozCaptureStream();
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Mantém o vídeo no pipeline de decode (evita frame único + áudio).
 * Precisa ter tamanho real e estar “no compositor”, mesmo com opacidade baixa.
 */
function attachExportVideoElement(video: HTMLVideoElement): void {
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = false;
  video.disablePictureInPicture = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  // 160px é o suficiente para o Chrome continuar decodificando frames.
  video.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:160px',
    'height:90px',
    'opacity:0.02',
    'pointer-events:none',
    'z-index:-1',
    'object-fit:contain',
    'background:#000',
  ].join(';');
  document.body.appendChild(video);
}

async function waitForSeek(video: HTMLVideoElement, timeSec: number): Promise<void> {
  if (Math.abs(video.currentTime - timeSec) < 0.04) return;
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    video.addEventListener('seeked', done, { once: true });
    try {
      video.currentTime = timeSec;
    } catch {
      resolve();
      return;
    }
    window.setTimeout(done, 1500);
  });
}

export interface ExportOrcamentoVideoOptions {
  quality: OrcamentoExportQualityOption;
  startSec?: number;
  endSec?: number;
  /** Se true (padrão), garante contêiner MP4 quando o navegador gravar MP4. */
  forceMp4?: boolean;
  /**
   * Duração conhecida da gravação (segundos).
   * WebM do MediaRecorder costuma reportar duration = Infinity/NaN — usamos este fallback.
   */
  fallbackDurationSec?: number;
}

/**
 * Une duração reportada pelo player com o cronômetro da gravação.
 * WebM do MediaRecorder (Chrome) costuma mentir com valores curtos ou Infinity —
 * se o relógio da sessão for bem maior, ele manda.
 */
export function pickReliableVideoDurationSec(
  reportedSec: number,
  fallbackSec?: number,
): number {
  const reported =
    Number.isFinite(reportedSec) && reportedSec > 0.2 ? reportedSec : 0;
  const fallback =
    fallbackSec && Number.isFinite(fallbackSec) && fallbackSec > 0.2
      ? fallbackSec
      : 0;
  if (reported > 0 && fallback > 0) {
    // Metadado curto demais vs. tempo real da take → usa o cronômetro.
    if (reported < fallback * 0.85) return fallback;
    return Math.max(reported, fallback);
  }
  return reported || fallback || 0;
}

/**
 * Descobre a duração real do <video>.
 * WebM gravado no Chrome frequentemente vem com duration = Infinity ou curta demais.
 */
async function resolvePlayableDuration(
  video: HTMLVideoElement,
  fallbackSec?: number,
): Promise<number> {
  let reported = 0;
  const raw = video.duration;
  if (Number.isFinite(raw) && raw > 0.2) {
    reported = raw;
  } else {
    // Truque clássico: seek longe força o browser a revelar o fim do WebM.
    try {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        video.addEventListener('seeked', done, { once: true });
        try {
          video.currentTime = 1e10;
        } catch {
          resolve();
          return;
        }
        window.setTimeout(done, 1200);
      });
      const probed = video.currentTime;
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      if (Number.isFinite(probed) && probed > 0.2) reported = probed;
    } catch {
      /* ignore */
    }
  }

  return pickReliableVideoDurationSec(reported, fallbackSec);
}

async function assertOrCoerceMp4Blob(blob: Blob, forceMp4: boolean): Promise<Blob> {
  const container = await sniffVideoContainer(blob);
  // Confia só nos bytes — type mentiroso (WebM com type video/mp4) quebrava o Windows.
  if (container === 'mp4') {
    if (!isMp4MimeType(blob.type)) {
      return new Blob([blob], { type: 'video/mp4' });
    }
    return blob;
  }
  if (!forceMp4) {
    if (container === 'webm') {
      return isMp4MimeType(blob.type)
        ? new Blob([blob], { type: 'video/webm' })
        : blob;
    }
    return blob;
  }
  throw new Error(
    'Não foi possível gerar um MP4 compatível neste navegador. Atualize o Chrome/Edge ou abra o arquivo .webm no Chrome/VLC.',
  );
}

async function recordMediaStreamOnce(opts: {
  stream: MediaStream;
  mime: string;
  videoBitsPerSecond: number;
  hasAudio: boolean;
  /** Se true, usa timeslice (alguns Chromes só emitem dados assim no MP4). */
  useTimeslice: boolean;
  playUntil: () => Promise<void>;
}): Promise<Blob> {
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(opts.stream, {
      mimeType: opts.mime,
      videoBitsPerSecond: opts.videoBitsPerSecond,
      audioBitsPerSecond: opts.hasAudio ? AUDIO_BITS_PER_SECOND : undefined,
    });
  } catch {
    throw new Error(`MediaRecorder recusou o MIME ${opts.mime}`);
  }

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const type = recorder.mimeType || opts.mime || 'video/mp4';
      resolve(new Blob(chunks, { type: isMp4MimeType(type) ? 'video/mp4' : type }));
    };
    recorder.onerror = () => reject(new Error('Falha ao exportar o vídeo.'));
  });

  if (opts.useTimeslice) {
    recorder.start(1000);
  } else {
    recorder.start();
  }
  await opts.playUntil();

  if (recorder.state === 'recording' || recorder.state === 'paused') {
    try {
      if (typeof recorder.requestData === 'function') recorder.requestData();
    } catch {
      /* ignore */
    }
    // Pequena pausa: o Chrome às vezes finaliza o último fragmento MP4 depois do requestData.
    await new Promise<void>((r) => window.setTimeout(r, 120));
    recorder.stop();
  }

  return stopped;
}

/**
 * Grava o stream em MP4 tentando vários MIME / timeslice.
 * Nunca cai silenciosamente para WebM quando forceMp4=true.
 */
async function recordMediaStream(opts: {
  stream: MediaStream;
  mime: string;
  videoBitsPerSecond: number;
  hasAudio: boolean;
  forceMp4: boolean;
  playUntil: () => Promise<void>;
  cleanupTracks: () => void;
  /** Duração esperada (ms) para validar tamanho. */
  expectedDurationMs?: number;
}): Promise<Blob> {
  try {
    const mimeCandidates = opts.forceMp4
      ? (() => {
          const list = listMp4MimeCandidates(opts.hasAudio);
          if (opts.mime && isMp4MimeType(opts.mime) && !list.includes(opts.mime)) {
            list.unshift(opts.mime);
          }
          // Poucos MIME: cada tentativa reexecuta o vídeo inteiro.
          return (list.length ? list : isMp4MimeType(opts.mime) ? [opts.mime] : []).slice(
            0,
            3,
          );
        })()
      : [opts.mime || pickExportMime(opts.hasAudio)];

    if (opts.forceMp4 && mimeCandidates.length === 0) {
      throw new Error(
        'Este navegador não grava em MP4. Use Chrome, Edge ou Safari atualizado.',
      );
    }

    let lastError: Error | null = null;
    for (const mime of mimeCandidates) {
      for (const useTimeslice of opts.forceMp4 ? [false, true] : [!isMp4MimeType(mime)]) {
        try {
          const out = await recordMediaStreamOnce({
            stream: opts.stream,
            mime,
            videoBitsPerSecond: opts.videoBitsPerSecond,
            hasAudio: opts.hasAudio,
            useTimeslice,
            playUntil: opts.playUntil,
          });

          if (
            !isPlausibleVideoBlob(out, undefined, opts.expectedDurationMs)
          ) {
            lastError = new Error(
              'A exportação ficou vazia ou corrompida. Tentando outro modo…',
            );
            continue;
          }

          if (opts.forceMp4) {
            const container = await sniffVideoContainer(out);
            if (container !== 'mp4') {
              lastError = new Error(
                'O navegador não entregou MP4 neste modo. Tentando outro…',
              );
              continue;
            }
            return assertOrCoerceMp4Blob(out, true);
          }

          return assertOrCoerceMp4Blob(out, false);
        } catch (err) {
          lastError =
            err instanceof Error ? err : new Error('Falha ao exportar o vídeo.');
        }
      }
    }

    throw (
      lastError ??
      new Error(
        'Não foi possível gerar um MP4 compatível neste navegador. Atualize o Chrome/Edge.',
      )
    );
  } finally {
    opts.cleanupTracks();
  }
}

/**
 * Reexporta o vídeo no tamanho/bitrate escolhido (e corta o trecho, se houver).
 * Sem upscale: se a fonte for menor que o alvo, mantém a resolução da fonte.
 * Preferência: sempre MP4.
 */
export async function exportOrcamentoVideoAtQuality(
  source: Blob,
  opts: ExportOrcamentoVideoOptions,
): Promise<Blob> {
  const forceMp4 = opts.forceMp4 !== false;

  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    return assertOrCoerceMp4Blob(source, forceMp4);
  }

  const objectUrl = URL.createObjectURL(source);
  const video = document.createElement('video') as VideoElWithCapture;
  // Gesto do botão Baixar já liberou áudio — mantém ligado para o captureStream.
  video.muted = false;
  video.volume = 1;
  video.src = objectUrl;
  attachExportVideoElement(video);

  try {
    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      const ok = () => resolve();
      const fail = () => reject(new Error('Não foi possível ler o vídeo para exportar.'));
      video.addEventListener('loadedmetadata', ok, { once: true });
      video.addEventListener('error', fail, { once: true });
    });

    // Garante pelo menos um frame decodificado antes de capturar.
    await new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolve();
        return;
      }
      const done = () => resolve();
      video.addEventListener('loadeddata', done, { once: true });
      video.addEventListener('canplay', done, { once: true });
      window.setTimeout(done, 2000);
    });

    const duration = await resolvePlayableDuration(video, opts.fallbackDurationSec);
    const sourceContainer = await sniffVideoContainer(source);
    const sourceIsMp4 = sourceContainer === 'mp4';

    if (duration < 0.2) {
      // Sem duração não dá para converter com segurança.
      if (sourceIsMp4) return assertOrCoerceMp4Blob(source, forceMp4);
      throw new Error(
        'Não foi possível ler a duração do vídeo gravado. Grave de novo (alguns segundos) e tente baixar.',
      );
    }

    // Sem suporte a gravar MP4 neste browser — falha clara (não disfarça WebM).
    if (forceMp4 && listMp4MimeCandidates(true).length === 0 && listMp4MimeCandidates(false).length === 0) {
      throw new Error(
        'Este Chrome/Edge ainda não grava MP4. Atualize o navegador (versão recente) e tente de novo.',
      );
    }

    const start = clampSec(opts.startSec ?? 0, 0, Math.max(0, duration - 0.15));
    const end = clampSec(opts.endSec ?? duration, start + 0.15, duration);
    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;
    const srcEdge = Math.max(vw, vh);
    const targetEdge = Math.min(opts.quality.maxEdge, srcEdge);
    const scale = targetEdge / srcEdge;
    const outW = even(vw * scale);
    const outH = even(vh * scale);

    const almostFull = start <= 0.08 && end >= duration - 0.12;
    const sameRes = targetEdge >= srcEdge - 8;

    // Já é MP4 no tamanho pedido e sem corte → devolve (sem reencode).
    if (almostFull && sameRes && sourceIsMp4) {
      return assertOrCoerceMp4Blob(source, forceMp4);
    }
    // Sem forçar MP4 e sem mudança → devolve original (WebM ou MP4).
    if (almostFull && sameRes && !forceMp4) {
      return assertOrCoerceMp4Blob(source, false);
    }

    // WebM → MP4 (ou corte / downscale): reencode abaixo.

    await waitForSeek(video, start);

    const expectedDurationMs = Math.max(500, (end - start) * 1000);

    const playUntilEnd = async () => {
      await waitForSeek(video, start);
      video.muted = false;
      video.volume = 1;
      try {
        await video.play();
      } catch {
        // Último recurso: mudo só para avançar frames (áudio pode ficar sem faixa).
        video.muted = true;
        await video.play().catch(() => undefined);
      }

      // Relógio de parede: não confiar só em video.ended (WebM mentiroso encerra cedo).
      const targetMs = Math.max(500, (end - start) * 1000);
      const deadline = performance.now() + targetMs + 800;

      await new Promise<void>((resolve) => {
        const tick = () => {
          const reachedTime = video.currentTime >= end - 0.04;
          // Só aceita ended se já chegou perto do fim esperado.
          const endedNearTarget =
            video.ended && video.currentTime >= Math.max(0.2, end * 0.85);
          const timedOut = performance.now() >= deadline;
          if (reachedTime || endedNearTarget || timedOut) {
            resolve();
            return;
          }
          window.requestAnimationFrame(tick);
        };
        tick();
        window.setTimeout(resolve, Math.max(1000, targetMs + 2500));
      });

      try {
        video.pause();
      } catch {
        /* ignore */
      }
    };

    const runRecord = async (
      stream: MediaStream,
      hasAudio: boolean,
      cleanup: () => void,
    ) =>
      recordMediaStream({
        stream,
        mime: pickExportMime(hasAudio),
        videoBitsPerSecond: opts.quality.videoBitsPerSecond,
        hasAudio,
        forceMp4,
        playUntil: playUntilEnd,
        cleanupTracks: cleanup,
        expectedDurationMs,
      });

    // ——— 1) Mesma resolução via captureStream nativo (rápido) ———
    // Só em MP4: WebM do MediaRecorder no Chrome costuma virar “só áudio”
    // ou imagem congelada no captureStream em takes longas.
    if (sameRes && sourceIsMp4) {
      const native = captureVideoElementStream(video);
      const videoTrack = native?.getVideoTracks()[0];
      if (native && videoTrack) {
        const audioTracks = native.getAudioTracks();
        try {
          if (audioTracks.length > 0) {
            return await runRecord(native, true, () =>
              native.getTracks().forEach((t) => t.stop()),
            );
          }
          return await runRecord(native, false, () =>
            native.getTracks().forEach((t) => t.stop()),
          );
        } catch {
          native.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              /* ignore */
            }
          });
          // Segue para o canvas.
        }
      }
    }

    // ——— 2) Canvas: downscale e/ou conversão WebM → MP4 mais robusta ———
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    // Canvas também precisa “existir” no documento em alguns Chromes.
    canvas.style.cssText =
      'position:fixed;left:0;top:0;width:160px;height:90px;opacity:0.04;pointer-events:none;z-index:-1';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) {
      canvas.remove();
      throw new Error('Não foi possível preparar a conversão para MP4 neste navegador.');
    }
    ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = 'high';
    } catch {
      /* ignore */
    }

    // 30 fps contínuos + requestFrame: mais estável que captureStream(0) no MP4 do Chrome.
    const nativeForAudio = captureVideoElementStream(video);
    const audioTracks = (nativeForAudio?.getAudioTracks() ?? []).map((t) => t.clone());

    const requestCanvasFrame = (track: MediaStreamTrack) => {
      const t = track as MediaStreamTrack & { requestFrame?: () => void };
      if (typeof t.requestFrame === 'function') {
        try {
          t.requestFrame();
        } catch {
          /* ignore */
        }
      }
    };

    let paintHandle = 0;
    let paintTimer = 0;
    let painting = false;
    let activeRequestTrack: MediaStreamTrack | null = null;

    const paintFrame = () => {
      if (!painting) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          ctx.drawImage(video, 0, 0, outW, outH);
          if (activeRequestTrack) requestCanvasFrame(activeRequestTrack);
        } catch {
          /* decode / CORS */
        }
      }
    };

    const startPainting = () => {
      painting = true;
      paintFrame();
      paintTimer = window.setInterval(paintFrame, Math.round(1000 / 30));
      if (typeof video.requestVideoFrameCallback === 'function') {
        const onFrame = () => {
          if (!painting) return;
          paintFrame();
          paintHandle = video.requestVideoFrameCallback!(onFrame);
        };
        paintHandle = video.requestVideoFrameCallback(onFrame);
      }
    };

    const stopPainting = () => {
      painting = false;
      if (paintTimer) {
        window.clearInterval(paintTimer);
        paintTimer = 0;
      }
      if (typeof video.cancelVideoFrameCallback === 'function' && paintHandle) {
        try {
          video.cancelVideoFrameCallback(paintHandle);
        } catch {
          /* ignore */
        }
      }
      paintHandle = 0;
    };

    const cleanupCanvas = () => {
      stopPainting();
      audioTracks.forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      nativeForAudio?.getTracks().forEach((t) => t.stop());
      try {
        canvas.remove();
      } catch {
        /* ignore */
      }
    };

    try {
      paintFrame();
      startPainting();

      let lastCanvasError: Error | null = null;
      const audioFirst = audioTracks.length > 0;
      for (const withAudio of audioFirst ? [true, false] : [false]) {
        const passStream = canvas.captureStream(30);
        const passTrack = passStream.getVideoTracks()[0];
        if (!passTrack) {
          lastCanvasError = new Error('Não foi possível capturar os frames do vídeo.');
          continue;
        }
        activeRequestTrack = passTrack;
        const clonedAudio = withAudio
          ? audioTracks
              .map((t) => {
                try {
                  return t.clone();
                } catch {
                  return null;
                }
              })
              .filter((t): t is MediaStreamTrack => !!t)
          : [];
        const mixed = new MediaStream(
          withAudio && clonedAudio.length > 0
            ? [passTrack, ...clonedAudio]
            : [passTrack],
        );
        try {
          return await recordMediaStream({
            stream: mixed,
            mime: pickExportMime(clonedAudio.length > 0),
            videoBitsPerSecond: opts.quality.videoBitsPerSecond,
            hasAudio: clonedAudio.length > 0,
            forceMp4,
            playUntil: playUntilEnd,
            expectedDurationMs,
            cleanupTracks: () => {
              passStream.getTracks().forEach((t) => t.stop());
              clonedAudio.forEach((t) => {
                try {
                  t.stop();
                } catch {
                  /* ignore */
                }
              });
            },
          });
        } catch (err) {
          passStream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              /* ignore */
            }
          });
          clonedAudio.forEach((t) => {
            try {
              t.stop();
            } catch {
              /* ignore */
            }
          });
          lastCanvasError =
            err instanceof Error ? err : new Error('Falha ao gerar MP4 no canvas.');
        }
      }

      throw (
        lastCanvasError ??
        new Error('Não foi possível gerar o MP4. Tente de novo no Chrome ou Edge.')
      );
    } finally {
      cleanupCanvas();
    }
  } finally {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    } catch {
      /* ignore */
    }
    URL.revokeObjectURL(objectUrl);
  }
}
