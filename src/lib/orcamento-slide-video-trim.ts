/**
 * Corta um trecho do vídeo gravado (início/fim em segundos) sem dependências extras.
 * Usa captura do elemento + MediaRecorder — prioriza MP4.
 */

import {
  isMp4MimeType,
  pickWindowsFriendlyMp4Mime,
} from '@/lib/orcamento-slide-video-browser';

function pickTrimMime(hasAudio: boolean): string {
  if (typeof MediaRecorder === 'undefined') return 'video/mp4';
  const mp4 = pickWindowsFriendlyMp4Mime(hasAudio);
  if (mp4) return mp4;
  const withAudio = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const videoOnly = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const list = hasAudio ? withAudio : videoOnly;
  for (const mime of list) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* ignore */
    }
  }
  return 'video/webm';
}

function clampSec(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function formatVideoClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export interface TrimVideoOptions {
  startSec: number;
  endSec: number;
  /** Bitrate alvo do trecho (default ~8 Mbps). */
  videoBitsPerSecond?: number;
}

/**
 * Gera um novo Blob só com o intervalo [startSec, endSec].
 * Se o intervalo for quase o vídeo inteiro, devolve o blob original.
 */
export async function trimOrcamentoVideoBlob(
  source: Blob,
  opts: TrimVideoOptions,
): Promise<Blob> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    return source;
  }

  const objectUrl = URL.createObjectURL(source);
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = false;
  video.src = objectUrl;
  // Precisa ficar no compositor — 2×2 fora da tela congela o vídeo e deixa só o áudio.
  video.style.cssText =
    'position:fixed;left:0;top:0;width:160px;height:90px;opacity:0.02;pointer-events:none;z-index:-1;object-fit:contain;background:#000';
  document.body.appendChild(video);

  try {
    await new Promise<void>((resolve, reject) => {
      const ok = () => resolve();
      const fail = () => reject(new Error('Não foi possível ler o vídeo para cortar.'));
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      video.addEventListener('loadedmetadata', ok, { once: true });
      video.addEventListener('error', fail, { once: true });
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration < 0.4) return source;

    const start = clampSec(opts.startSec, 0, Math.max(0, duration - 0.2));
    const end = clampSec(opts.endSec, start + 0.2, duration);

    // Quase o vídeo inteiro — não reencoda.
    if (start <= 0.08 && end >= duration - 0.12) {
      return source;
    }

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener('seeked', done, { once: true });
      video.currentTime = start;
      window.setTimeout(done, 1200);
    });

    const capture =
      typeof video.captureStream === 'function'
        ? video.captureStream()
        : typeof (
              video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }
            ).mozCaptureStream === 'function'
          ? (
              video as HTMLVideoElement & { mozCaptureStream: () => MediaStream }
            ).mozCaptureStream()
          : null;

    if (!capture || capture.getVideoTracks().length === 0) {
      throw new Error('Este navegador não permite cortar o vídeo. Baixe o arquivo inteiro.');
    }

    const hasAudio = capture.getAudioTracks().length > 0;
    const mime = pickTrimMime(hasAudio);
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(capture, {
        mimeType: mime,
        videoBitsPerSecond: opts.videoBitsPerSecond ?? 4_000_000,
        audioBitsPerSecond: hasAudio ? 128_000 : undefined,
      });
    } catch {
      recorder = new MediaRecorder(capture);
    }

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || source.type;
        resolve(
          new Blob(chunks, {
            type: isMp4MimeType(type) ? 'video/mp4' : type,
          }),
        );
      };
      recorder.onerror = () => reject(new Error('Falha ao cortar o vídeo.'));
    });

    if (isMp4MimeType(mime)) {
      recorder.start();
    } else {
      recorder.start(100);
    }
    await video.play();

    await new Promise<void>((resolve) => {
      const tick = () => {
        if (video.ended || video.currentTime >= end - 0.04) {
          resolve();
          return;
        }
        window.requestAnimationFrame(tick);
      };
      tick();
      const guardMs = Math.max(1000, (end - start) * 1000 + 4000);
      window.setTimeout(resolve, guardMs);
    });

    try {
      video.pause();
    } catch {
      /* ignore */
    }
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      try {
        if (typeof recorder.requestData === 'function') recorder.requestData();
      } catch {
        /* ignore */
      }
      recorder.stop();
    }

    const out = await stopped;
    capture.getTracks().forEach((t) => t.stop());

    if (out.size < 1500) {
      throw new Error('O trecho ficou vazio. Ajuste o corte e tente de novo.');
    }
    return out;
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
