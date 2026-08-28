/**
 * Capacidades do navegador para o estúdio de vídeo.
 * iOS/Safari não têm getDisplayMedia — usamos gravação da apresentação (canvas).
 */

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS reporta como Mac, mas tem touch
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
}

/** Safari (iOS ou macOS), não Chrome/Firefox em cima do WebKit. */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isWebKit = /WebKit/i.test(ua);
  const isOther = /CriOS|FxiOS|EdgiOS|Chrome|Chromium|Android/i.test(ua);
  // iOS Chrome também é WebKit — tratamos como Safari engine
  if (isIOSDevice()) return true;
  return isWebKit && !/Chrome|Chromium|Edg\//i.test(ua) && !isOther;
}

export function supportsDisplayMediaCapture(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

export function supportsMediaRecorder(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

/**
 * Preferir MP4 sempre que o navegador gravar nesse formato.
 * Safari/iOS: obrigatório (WebM falha). Chrome/Edge modernos: também suportam MP4.
 */
export function prefersMp4Recording(): boolean {
  if (!supportsMediaRecorder()) return false;
  if (isIOSDevice() || isSafariBrowser()) return true;
  try {
    return (
      MediaRecorder.isTypeSupported('video/mp4') ||
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ||
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
    );
  } catch {
    return false;
  }
}

/** Lista de MIME MP4 (H.264) para MediaRecorder, na ordem de preferência. */
export function mp4RecorderMimeCandidates(withAudio: boolean): string[] {
  if (withAudio) {
    return [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ];
  }
  return [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1.4d002a',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
}

/** Primeiro MIME MP4 suportado, ou string vazia. */
export function pickSupportedMp4Mime(withAudio: boolean): string {
  if (!supportsMediaRecorder()) return '';
  for (const mime of mp4RecorderMimeCandidates(withAudio)) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* ignore */
    }
  }
  return '';
}

/**
 * MIME de exportação: só aceita MP4 com H.264 (+ AAC se tiver áudio).
 * Evita `video/mp4` genérico que às vezes sai com áudio Opus — Windows não abre.
 */
export function pickWindowsFriendlyMp4Mime(withAudio: boolean): string {
  if (!supportsMediaRecorder()) return '';
  const preferred = withAudio
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
      ]
    : [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1.4d002a',
        'video/mp4;codecs=avc1',
      ];
  for (const mime of preferred) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* ignore */
    }
  }
  // Último recurso: video/mp4 puro (Safari costuma gravar H.264+AAC).
  try {
    if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
  } catch {
    /* ignore */
  }
  return '';
}

export function isMp4MimeType(mimeType: string | undefined | null): boolean {
  return (mimeType || '').toLowerCase().includes('mp4');
}

/** Detecta contêiner real pelos primeiros bytes (não confia só no type). */
export async function sniffVideoContainer(
  blob: Blob,
): Promise<'mp4' | 'webm' | 'unknown'> {
  try {
    const buf = await blob.slice(0, 16).arrayBuffer();
    const u8 = new Uint8Array(buf);
    // EBML / WebM — tem prioridade sobre o type mentiroso (ex.: WebM salvo como .mp4).
    if (u8.length >= 4 && u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) {
      return 'webm';
    }
    // ISO BMFF: size(4) + 'ftyp'
    if (
      u8.length >= 8 &&
      u8[4] === 0x66 &&
      u8[5] === 0x74 &&
      u8[6] === 0x79 &&
      u8[7] === 0x70
    ) {
      return 'mp4';
    }
  } catch {
    /* ignore */
  }
  // Só usa o type se os bytes não disseram nada.
  if ((blob.type || '').toLowerCase().includes('webm')) return 'webm';
  if (isMp4MimeType(blob.type)) return 'mp4';
  return 'unknown';
}

/**
 * Nome de arquivo com extensão fiel ao conteúdo (nunca WebM disfarçado de .mp4).
 * Windows / Filmes e TV rejeitam WebM renomeado para .mp4 (“formato incompatível”).
 */
export async function resolveVideoDownloadName(
  blob: Blob,
  suggestedName: string,
): Promise<{ fileName: string; mimeType: string; container: 'mp4' | 'webm' | 'unknown' }> {
  const container = await sniffVideoContainer(blob);
  const base =
    suggestedName.replace(/\.(webm|mp4|mov|m4v)$/i, '').trim() || 'proposta-video';
  if (container === 'mp4') {
    return { fileName: `${base}.mp4`, mimeType: 'video/mp4', container };
  }
  if (container === 'webm') {
    return {
      fileName: `${base}.webm`,
      mimeType: blob.type && blob.type.includes('webm') ? blob.type : 'video/webm',
      container,
    };
  }
  // Desconhecido: respeita extensão sugerida só se bater com o type.
  if (isMp4MimeType(blob.type)) {
    return { fileName: `${base}.mp4`, mimeType: 'video/mp4', container: 'unknown' };
  }
  return {
    fileName: `${base}.webm`,
    mimeType: blob.type || 'video/webm',
    container: 'unknown',
  };
}

/**
 * Gravação disponível se:
 * - tem getDisplayMedia (desktop Chrome/Edge/Safari macOS), ou
 * - tem MediaRecorder + canvas (fallback iOS / sem tela)
 */
export function isOrcamentoVideoRecordingSupported(): boolean {
  if (!supportsMediaRecorder()) return false;
  if (supportsDisplayMediaCapture()) return true;
  return typeof HTMLCanvasElement !== 'undefined';
}

/** true = modo interno (canvas), sem seletor de aba do sistema. */
export function shouldUseElementCaptureRecording(): boolean {
  if (!supportsMediaRecorder()) return false;
  if (isIOSDevice()) return true;
  return !supportsDisplayMediaCapture();
}

export function resolveCaptureRootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const framed = document.querySelector<HTMLElement>('[data-video-capture-root]');
  if (framed) return framed;
  const apresentacao = document.querySelector<HTMLElement>('[data-orcamento-apresentacao]');
  return apresentacao;
}
