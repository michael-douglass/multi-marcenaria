import {
  SLIDE_PREVIEW_DESKTOP,
  SLIDE_PREVIEW_MOBILE,
} from '@/lib/orcamento-slide-imagem-spec';
import type { OrcamentoExportViewport } from '@/lib/orcamento-slide-export-constants';
import {
  clearOrcamentoVideoPlaybackCache,
  prefetchOrcamentoApresentacaoVideos,
} from '@/lib/orcamento-slide-video-playback-cache';
import {
  isIOSDevice,
  isMp4MimeType,
  isSafariBrowser,
  mp4RecorderMimeCandidates,
  pickSupportedMp4Mime,
  pickWindowsFriendlyMp4Mime,
  prefersMp4Recording,
  resolveCaptureRootElement,
  resolveVideoDownloadName,
  shouldUseElementCaptureRecording,
  sniffVideoContainer,
  supportsDisplayMediaCapture,
  supportsMediaRecorder,
} from '@/lib/orcamento-slide-video-browser';

export {
  isIOSDevice,
  isOrcamentoVideoRecordingSupported,
  isSafariBrowser,
  prefersMp4Recording,
  shouldUseElementCaptureRecording,
  supportsDisplayMediaCapture,
} from '@/lib/orcamento-slide-video-browser';

// Re-export sniff for callers that already import from this module.
export { sniffVideoContainer, resolveVideoDownloadName } from '@/lib/orcamento-slide-video-browser';

export type OrcamentoVideoRecordSize = { width: number; height: number };

/** Duração máxima da simulação em vídeo (cronômetro regressivo na tela). */
export const ORCAMENTO_VIDEO_MAX_DURATION_SEC = 60;
export const ORCAMENTO_VIDEO_MAX_DURATION_MS = ORCAMENTO_VIDEO_MAX_DURATION_SEC * 1000;

/** Full HD: celular 1080×1920 · computador 1920×1080 */
export function resolveVideoRecordSize(
  viewport: OrcamentoExportViewport,
): OrcamentoVideoRecordSize {
  return viewport === 'mobile'
    ? { width: SLIDE_PREVIEW_MOBILE.width, height: SLIDE_PREVIEW_MOBILE.height }
    : { width: SLIDE_PREVIEW_DESKTOP.width, height: SLIDE_PREVIEW_DESKTOP.height };
}

export function labelVideoRecordViewport(viewport: OrcamentoExportViewport): string {
  return viewport === 'mobile'
    ? 'Full HD 1080×1920 (celular)'
    : 'Full HD 1920×1080 (computador)';
}

/**
 * Bitrate de gravação — nítido o bastante para slides, sem inflar o arquivo.
 * 16 Mbps gerava vídeos enormes e travava o Chrome no download/conversão.
 * ~6 Mbps Full HD cobre texto/foto com folga (YouTube usa ~8 Mbps em 1080p60).
 */
function resolveVideoHdBitrate(width: number, height: number): number {
  const pixels = width * height;
  // ~1080×1920 ≈ 2.07 MP · 1920×1080 ≈ 2.07 MP
  if (pixels >= 1_900_000) return 6_000_000;
  if (pixels >= 900_000) return 4_000_000;
  return 2_500_000;
}

/**
 * Superfície no compositor do Chrome.
 * Canvas/vídeo minúsculo, invisível ou fora da tela → o Chrome para de emitir
 * frames e a gravação fica “só áudio” ou imagem congelada após alguns segundos.
 */
function compositorCaptureSurfaceCss(portrait: boolean): string {
  const w = portrait ? 180 : 320;
  const h = portrait ? 320 : 180;
  return [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${w}px`,
    `height:${h}px`,
    'opacity:0.04',
    'pointer-events:none',
    'z-index:-1',
    'background:#000',
  ].join(';');
}

function requestCanvasCaptureFrame(track: MediaStreamTrack | null | undefined): void {
  if (!track) return;
  const t = track as MediaStreamTrack & { requestFrame?: () => void };
  if (typeof t.requestFrame !== 'function') return;
  try {
    t.requestFrame();
  } catch {
    /* ignore */
  }
}

function pickRecorderMimeType(withAudio: boolean): string {
  if (typeof MediaRecorder === 'undefined') return '';

  // Safari/iOS: só MP4 (H.264) é confiável.
  // Chrome/Edge: WebM primeiro — o MediaRecorder MP4 do Chrome costuma gerar
  // arquivos minúsculos (~200 KB) que não abrem / não têm imagem.
  // VP8 antes de VP9: encode em tempo real mais estável (menos “só áudio” / frame drop).
  const webmCandidates = withAudio
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];

  if (isIOSDevice() || isSafariBrowser()) {
    const friendly = pickWindowsFriendlyMp4Mime(withAudio);
    if (friendly) return friendly;
    for (const mime of mp4RecorderMimeCandidates(withAudio)) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) return mime;
      } catch {
        /* ignore */
      }
    }
  }

  for (const mime of webmCandidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* ignore */
    }
  }

  const friendly = pickWindowsFriendlyMp4Mime(withAudio);
  if (friendly) return friendly;
  return pickSupportedMp4Mime(withAudio);
}

export function extensionForMimeType(mimeType: string): string {
  if (isMp4MimeType(mimeType)) return 'mp4';
  return 'webm';
}

/** Ajusta type/extensão do blob conforme o contêiner real (bytes). */
async function finalizeRecordingBlob(
  chunks: Blob[],
  claimedMime: string,
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  // Um único Blob a partir dos chunks — evita cópia extra que dobra a RAM.
  const provisional = new Blob(chunks, {
    type: claimedMime || 'application/octet-stream',
  });
  // Libera referências dos pedaços assim que o Blob único existe.
  chunks.length = 0;

  const container = await sniffVideoContainer(provisional);
  if (container === 'mp4') {
    const mimeType = 'video/mp4';
    return {
      blob: isMp4MimeType(provisional.type)
        ? provisional
        : new Blob([provisional], { type: mimeType }),
      mimeType,
      extension: 'mp4',
    };
  }
  if (container === 'webm') {
    const mimeType =
      provisional.type && provisional.type.includes('webm')
        ? provisional.type
        : 'video/webm';
    // Reusa o blob se o type já estiver certo — não duplica dezenas/centenas de MB.
    return {
      blob:
        provisional.type === mimeType
          ? provisional
          : new Blob([provisional], { type: mimeType }),
      mimeType,
      extension: 'webm',
    };
  }
  const mimeType = claimedMime || 'video/webm';
  return {
    blob: provisional,
    mimeType,
    extension: extensionForMimeType(mimeType),
  };
}

function slugTituloVideo(titulo: string): string {
  return (
    titulo
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'proposta'
  );
}

export function buildVideoFileName(
  titulo: string,
  viewport: OrcamentoExportViewport,
  mimeType: string,
): string {
  const modo = viewport === 'mobile' ? 'celular' : 'computador';
  return `proposta-${slugTituloVideo(titulo)}-${modo}.${extensionForMimeType(mimeType)}`;
}

/**
 * Baixa o vídeo com a extensão correta (MP4 ou WebM), baseada nos bytes reais.
 * Nunca renomeia WebM para .mp4 — isso quebra o Windows (“formato incompatível”).
 *
 * Arquivos grandes: prioriza “Salvar como…” (File System Access) com stream
 * para o disco — evita travar a aba ao montar um segundo File/URL gigante.
 *
 * @returns true se o arquivo foi salvo/compartilhado/baixado; false se o usuário cancelou.
 */
export async function triggerVideoBlobDownload(
  blob: Blob,
  downloadName: string,
): Promise<boolean> {
  const resolved = await resolveVideoDownloadName(blob, downloadName);

  // Cede um frame para a UI atualizar (“Convertendo…”) antes do I/O pesado.
  await new Promise<void>((r) => window.requestAnimationFrame(() => r()));

  // Chrome/Edge desktop: grava direto no disco sem duplicar o blob na RAM.
  const pickerResult = await trySaveBlobWithFilePicker(
    blob,
    resolved.fileName,
    resolved.mimeType,
  );
  if (pickerResult === 'saved') return true;
  if (pickerResult === 'cancelled') return false;

  // iOS Safari: <a download> quase nunca salva — usa compartilhamento nativo.
  // Só cria File (cópia) neste caminho; em desktop o picker/anchor usam o Blob.
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    try {
      const file = new File([blob], resolved.fileName, { type: resolved.mimeType });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: resolved.fileName });
        return true;
      }
    } catch (err) {
      // AbortError = usuário cancelou o share sheet.
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      // Outro erro — tenta o link.
    }
  }

  fallbackAnchorDownload(blob, resolved.fileName);
  return true;
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<FileSystemWritableFileStream>;
  }>;
};

type FilePickerSaveResult = 'saved' | 'cancelled' | 'unavailable';

async function trySaveBlobWithFilePicker(
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<FilePickerSaveResult> {
  const w = window as SaveFilePickerWindow;
  if (typeof w.showSaveFilePicker !== 'function') return 'unavailable';

  const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '.mp4';
  const acceptType = mimeType || 'application/octet-stream';

  let writable: FileSystemWritableFileStream | null = null;

  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: 'Vídeo',
          accept: { [acceptType]: [ext] },
        },
      ],
    });
    writable = await handle.createWritable();

    // Stream chunk a chunk — bem mais leve que writable.write(blob) em arquivos grandes.
    if (typeof blob.stream === 'function') {
      await blob.stream().pipeTo(writable);
      writable = null; // pipeTo já fecha o stream
    } else {
      await writable.write(blob);
      await writable.close();
      writable = null;
    }
    return 'saved';
  } catch (err) {
    try {
      await writable?.abort();
    } catch {
      /* ignore */
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unavailable';
  }
}

function fallbackAnchorDownload(blob: Blob, downloadName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = downloadName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Arquivos grandes: dá mais tempo ao download começar antes de revogar a URL.
  const revokeMs = blob.size > 80 * 1024 * 1024 ? 120_000 : 8_000;
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), revokeMs);
}

type DisplayMediaConstraints = MediaStreamConstraints & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
};

async function dispositivoTemMicrofone(): Promise<boolean> {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === 'audioinput');
  } catch {
    return false;
  }
}

async function tentarMicrofoneOpcional(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const temMic = await dispositivoTemMicrofone();
  if (!temMic) return null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }
    return stream;
  } catch {
    return null;
  }
}

function isDisplayPermissionDenied(err: unknown): boolean {
  const name = err instanceof DOMException ? err.name : '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'AbortError';
}

/**
 * Pede a aba com vídeo + áudio da aba (vídeos e sons tocados entram na filmagem).
 * Se o browser não permitir áudio da tela, cai para só vídeo.
 * Cancelamento do usuário NÃO reabre o seletor (evita “travar” em vários diálogos).
 *
 * Importante:
 * - suppressLocalAudioPlayback fica OFF: você ouve vídeos/música na própria aba.
 * - systemAudio fica exclude: não captura alto-falantes (evita loop/ruído).
 * - echoCancellation/noiseSuppression no áudio da aba geram artefato — desligados.
 */
async function pedirTelaComAudio(width: number, height: number): Promise<MediaStream> {
  const audioConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    suppressLocalAudioPlayback: false,
  } as MediaTrackConstraints;

  const attempts: DisplayMediaConstraints[] = [
    {
      video: {
        width: { ideal: Math.max(width, 1920), max: 3840 },
        height: { ideal: Math.max(height, 1080), max: 3840 },
        frameRate: { ideal: 30, max: 30 },
        displaySurface: 'browser',
      } as MediaTrackConstraints,
      audio: audioConstraints,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      systemAudio: 'exclude',
    },
    {
      video: {
        width: { ideal: Math.max(width, 1920), max: 3840 },
        height: { ideal: Math.max(height, 1080), max: 3840 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false,
      } as MediaTrackConstraints,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'exclude',
    },
    {
      video: true,
      audio: true,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (err) {
      lastError = err;
      if (isDisplayPermissionDenied(err)) {
        throw new Error(
          'Compartilhamento de tela cancelado. Selecione esta aba e marque “Compartilhar áudio da aba” se quiser o som dos vídeos.',
        );
      }
    }
  }

  if (isDisplayPermissionDenied(lastError)) {
    throw new Error(
      'Compartilhamento de tela cancelado. Selecione esta aba e marque “Compartilhar áudio da aba” se quiser o som dos vídeos.',
    );
  }
  throw new Error('Não foi possível gravar a tela neste navegador.');
}

export interface OrcamentoVideoMusicOptions {
  /** URL pública do áudio (biblioteca). */
  url: string;
  /** Volume 0–1. */
  volume: number;
  titulo?: string;
}

export interface OrcamentoVideoRecordingResult {
  blob: Blob;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  durationMs: number;
  hasAudio: boolean;
  hasTabAudio: boolean;
  hasMusic: boolean;
}

export interface OrcamentoVideoRecordingSession {
  hasAudio: boolean;
  hasTabAudio: boolean;
  hasMusic: boolean;
  /** Inicia o MediaRecorder. Lança erro se não conseguir gravar. */
  begin: () => void;
  /** Pausa gravação + música (tempo “de parede” continua no HUD via UI). */
  pause: () => void;
  /** Retoma gravação + música. */
  resume: () => void;
  /** true se o MediaRecorder está em paused. */
  isPaused: () => boolean;
  stop: () => Promise<OrcamentoVideoRecordingResult>;
  dispose: () => void;
  /** Ajusta volume da música de fundo ao vivo (0–1). */
  setMusicVolume: (volume: number) => void;
}

/** Volume da música: 0–1, respeitando o valor do usuário. */
export function clampOrcamentoMusicVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(1, Math.max(0, volume));
}

interface MixAudioResult {
  mixedAudioStream: MediaStream | null;
  hasTabAudio: boolean;
  hasMic: boolean;
  hasMusic: boolean;
  setMusicVolume: (v: number) => void;
  /** Desbloqueia AudioContext + prepara o elemento (gesto do usuário). */
  unlockMusic: () => Promise<void>;
  startMusic: () => Promise<void>;
  pauseMusic: () => void;
  resumeMusic: () => Promise<void>;
  dispose: () => void;
}

function createHiddenAudioElement(src: string, volume: number): HTMLAudioElement {
  const el = document.createElement('audio');
  el.crossOrigin = 'anonymous';
  el.loop = true;
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;bottom:0';
  el.src = src;
  el.volume = clampOrcamentoMusicVolume(volume);
  document.body.appendChild(el);
  return el;
}

function disposeAudioElement(el: HTMLAudioElement | null): void {
  if (!el) return;
  try {
    el.pause();
    el.removeAttribute('src');
    el.load();
    el.remove();
  } catch {
    /* ignore */
  }
}

/**
 * Mistura áudio da aba + microfone + música de fundo.
 *
 * Dois caminhos (anti-ruído / anti-silêncio):
 *
 * 1) Com áudio da aba (Chrome/Edge):
 *    - Você ouve vídeos e música na própria aba (sem “monitor” extra).
 *    - Música toca como elemento de áudio normal e entra UMA vez via captura da aba.
 *    - NÃO tocamos dest.stream de novo na aba (isso gerava loop → ruído).
 *    - Mic (se ligado) entra via Web Audio só no arquivo.
 *
 * 2) Sem áudio da aba (iOS/canvas):
 *    - Música + mic via Web Audio → arquivo e alto-falantes (sem captura de aba).
 */
async function misturarAudios(opts: {
  displayStream: MediaStream;
  micStream: MediaStream | null;
  music: OrcamentoVideoMusicOptions | null;
}): Promise<MixAudioResult> {
  const tabAudioTracks = opts.displayStream.getAudioTracks();
  const hasTabAudio = tabAudioTracks.length > 0;
  const hasMic = !!(opts.micStream && opts.micStream.getAudioTracks().length > 0);
  const wantsMusic = !!(opts.music?.url);

  const noopMix = (
    partial: Partial<MixAudioResult> &
      Pick<MixAudioResult, 'mixedAudioStream' | 'hasTabAudio' | 'hasMic' | 'hasMusic'>,
  ): MixAudioResult => ({
    setMusicVolume: () => undefined,
    unlockMusic: async () => undefined,
    startMusic: async () => undefined,
    pauseMusic: () => undefined,
    resumeMusic: async () => undefined,
    dispose: () => undefined,
    ...partial,
  });

  if (!hasTabAudio && !hasMic && !wantsMusic) {
    return noopMix({
      mixedAudioStream: null,
      hasTabAudio: false,
      hasMic: false,
      hasMusic: false,
    });
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  // ——— Caminho A: há áudio da aba ———
  // Música nativa na página (capturada uma vez). Sem monitor recirculante.
  if (hasTabAudio) {
    let musicEl: HTMLAudioElement | null = null;
    let musicReady = false;

    if (wantsMusic && opts.music) {
      musicEl = createHiddenAudioElement(opts.music.url, opts.music.volume);
      musicReady = true;
    }

    // Sem mic (ou sem Web Audio): tracks da aba direto no gravador (vídeos + música).
    if (!hasMic || !opts.micStream || !AudioCtx) {
      const micTracks =
        hasMic && opts.micStream ? opts.micStream.getAudioTracks() : [];
      const tracks: MediaStreamTrack[] = [...tabAudioTracks, ...micTracks];
      return {
        mixedAudioStream: tracks.length ? new MediaStream(tracks) : null,
        hasTabAudio: true,
        hasMic: micTracks.length > 0,
        hasMusic: musicReady,
        setMusicVolume: (v) => {
          if (musicEl) musicEl.volume = clampOrcamentoMusicVolume(v);
        },
        unlockMusic: async () => {
          if (!musicEl) return;
          try {
            musicEl.muted = true;
            await musicEl.play();
            musicEl.pause();
            musicEl.currentTime = 0;
            musicEl.muted = false;
          } catch {
            /* gestos */
          }
        },
        startMusic: async () => {
          if (!musicEl) return;
          try {
            musicEl.muted = false;
            await musicEl.play();
          } catch {
            /* autoplay */
          }
        },
        pauseMusic: () => {
          try {
            musicEl?.pause();
          } catch {
            /* ignore */
          }
        },
        resumeMusic: async () => {
          if (!musicEl) return;
          try {
            await musicEl.play();
          } catch {
            /* ignore */
          }
        },
        dispose: () => {
          disposeAudioElement(musicEl);
          musicEl = null;
        },
      };
    }

    // Com mic: mistura aba + mic no Web Audio (só para o arquivo).
    // Música continua no <audio> da página → entra via tracks da aba.
    const ctx = new AudioCtx({ latencyHint: 'interactive' });
    const dest = ctx.createMediaStreamDestination();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(dest);
    const clonedTabTracks: MediaStreamTrack[] = [];

    for (const track of tabAudioTracks) {
      try {
        const cloned = track.clone();
        clonedTabTracks.push(cloned);
        const src = ctx.createMediaStreamSource(new MediaStream([cloned]));
        const g = ctx.createGain();
        g.gain.value = 0.95;
        src.connect(g);
        g.connect(masterGain);
      } catch {
        /* ignore */
      }
    }

    try {
      const src = ctx.createMediaStreamSource(opts.micStream);
      const g = ctx.createGain();
      g.gain.value = 0.8;
      src.connect(g);
      g.connect(masterGain);
    } catch {
      /* ignore */
    }

    const ensureCtxRunning = async () => {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => undefined);
      }
    };

    return {
      mixedAudioStream: dest.stream,
      hasTabAudio: true,
      hasMic: true,
      hasMusic: musicReady,
      setMusicVolume: (v) => {
        if (musicEl) musicEl.volume = clampOrcamentoMusicVolume(v);
      },
      unlockMusic: async () => {
        await ensureCtxRunning();
        if (!musicEl) return;
        try {
          musicEl.muted = true;
          await musicEl.play();
          musicEl.pause();
          musicEl.currentTime = 0;
          musicEl.muted = false;
        } catch {
          /* gestos */
        }
      },
      startMusic: async () => {
        await ensureCtxRunning();
        if (!musicEl) return;
        try {
          musicEl.muted = false;
          await musicEl.play();
        } catch {
          /* autoplay */
        }
      },
      pauseMusic: () => {
        try {
          musicEl?.pause();
        } catch {
          /* ignore */
        }
      },
      resumeMusic: async () => {
        await ensureCtxRunning();
        if (!musicEl) return;
        try {
          await musicEl.play();
        } catch {
          /* ignore */
        }
      },
      dispose: () => {
        disposeAudioElement(musicEl);
        musicEl = null;
        clonedTabTracks.forEach((t) => {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
        void ctx.close().catch(() => undefined);
      },
    };
  }

  // ——— Caminho B: sem áudio da aba (iOS / canvas) ———
  if (!AudioCtx) {
    if (wantsMusic) {
      return noopMix({
        mixedAudioStream: null,
        hasTabAudio: false,
        hasMic,
        hasMusic: false,
      });
    }
    const tracks =
      hasMic && opts.micStream ? opts.micStream.getAudioTracks() : [];
    return noopMix({
      mixedAudioStream: tracks.length ? new MediaStream(tracks) : null,
      hasTabAudio: false,
      hasMic,
      hasMusic: false,
    });
  }

  const ctx = new AudioCtx({ latencyHint: 'interactive' });
  const dest = ctx.createMediaStreamDestination();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  // Arquivo + alto-falantes (sem captura de aba = sem loop).
  masterGain.connect(dest);
  masterGain.connect(ctx.destination);

  let musicGain: GainNode | null = null;
  let musicEl: HTMLAudioElement | null = null;
  let musicReady = false;

  if (hasMic && opts.micStream) {
    try {
      const src = ctx.createMediaStreamSource(opts.micStream);
      const g = ctx.createGain();
      g.gain.value = 0.85;
      src.connect(g);
      g.connect(masterGain);
    } catch {
      /* ignore */
    }
  }

  if (wantsMusic && opts.music) {
    const vol = clampOrcamentoMusicVolume(opts.music.volume);
    musicEl = createHiddenAudioElement(opts.music.url, 1);
    musicGain = ctx.createGain();
    musicGain.gain.value = vol;
    try {
      const musicSource = ctx.createMediaElementSource(musicEl);
      musicSource.connect(musicGain);
      musicGain.connect(masterGain);
      musicReady = true;
    } catch {
      musicEl.volume = vol;
      musicGain = null;
      musicReady = true;
    }
  }

  const ensureCtxRunning = async () => {
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined);
    }
  };

  return {
    mixedAudioStream: dest.stream,
    hasTabAudio: false,
    hasMic,
    hasMusic: musicReady,
    setMusicVolume: (v) => {
      const clamped = clampOrcamentoMusicVolume(v);
      if (musicGain) {
        musicGain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.02);
        return;
      }
      if (musicEl) musicEl.volume = clamped;
    },
    unlockMusic: async () => {
      await ensureCtxRunning();
      if (!musicEl) return;
      try {
        musicEl.muted = true;
        await musicEl.play();
        musicEl.pause();
        musicEl.currentTime = 0;
        musicEl.muted = false;
      } catch {
        /* gestos */
      }
    },
    startMusic: async () => {
      await ensureCtxRunning();
      if (!musicEl) return;
      try {
        musicEl.muted = false;
        await musicEl.play();
      } catch {
        /* autoplay */
      }
    },
    pauseMusic: () => {
      try {
        musicEl?.pause();
      } catch {
        /* ignore */
      }
    },
    resumeMusic: async () => {
      await ensureCtxRunning();
      if (!musicEl) return;
      try {
        await musicEl.play();
      } catch {
        /* ignore */
      }
    },
    dispose: () => {
      disposeAudioElement(musicEl);
      musicEl = null;
      void ctx.close().catch(() => undefined);
    },
  };
}

const ORCAMENTO_AUDIBLE_EVENT = 'orcamento-apresentacao-audible';

/**
 * Liga/desliga o áudio dos vídeos da apresentação (ex.: enquanto grava a tela).
 * Na gravação: desmuta e deixa pausado — você dá play na hora certa.
 * Também dispara o cache local dos vídeos (playback sem streaming remoto).
 */
export function setApresentacaoMidiaAudible(audible: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.orcamentoAudible = audible ? '1' : '0';
  document.querySelectorAll('[data-orcamento-video] video').forEach((node) => {
    const video = node as HTMLVideoElement;
    video.muted = !audible;
    if (audible) {
      video.pause();
    }
  });
  window.dispatchEvent(
    new CustomEvent(ORCAMENTO_AUDIBLE_EVENT, { detail: { audible } }),
  );
  if (audible) {
    void prefetchOrcamentoApresentacaoVideos(document, { lite: true });
  } else {
    clearOrcamentoVideoPlaybackCache();
  }
}

export function isApresentacaoMidiaAudible(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.orcamentoAudible === '1';
}

export function subscribeApresentacaoMidiaAudible(
  listener: (audible: boolean) => void,
): () => void {
  const handler = (ev: Event) => {
    const detail = (ev as CustomEvent<{ audible?: boolean }>).detail;
    listener(!!detail?.audible || isApresentacaoMidiaAudible());
  };
  window.addEventListener(ORCAMENTO_AUDIBLE_EVENT, handler);
  return () => window.removeEventListener(ORCAMENTO_AUDIBLE_EVENT, handler);
}

/**
 * Prepara o vídeo da gravação:
 * - Computador (paisagem): usa a tela principal direto (sem canvas).
 * - Celular (retrato): recorta o centro 9:16 e escala para Full HD.
 */
async function criarTrackVideoRecortado(
  displayStream: MediaStream,
  width: number,
  height: number,
): Promise<{ track: MediaStreamTrack; stop: () => void }> {
  const sourceTrack = displayStream.getVideoTracks()[0];
  if (!sourceTrack) {
    throw new Error('A gravação de tela não retornou vídeo.');
  }

  const isMobileTarget = height > width;

  // Desktop = tela principal como o Chrome entregou.
  if (!isMobileTarget) {
    try {
      sourceTrack.contentHint = 'detail';
    } catch {
      /* ignore */
    }
    return { track: sourceTrack, stop: () => undefined };
  }

  const fallback = (): { track: MediaStreamTrack; stop: () => void } => ({
    track: sourceTrack,
    stop: () => undefined,
  });

  try {
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    // Precisa ficar no compositor — senão o Chrome corta os frames após poucos segundos.
    video.style.cssText = `${compositorCaptureSurfaceCss(true)};object-fit:contain`;
    document.body.appendChild(video);
    video.srcObject = new MediaStream([sourceTrack]);

    await Promise.race([
      video.play().catch(() => undefined),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 900);
      }),
    ]);

    await Promise.race([
      new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
          return;
        }
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          resolve();
        };
        video.addEventListener('loadedmetadata', onMeta);
      }),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 900);
      }),
    ]);

    // Sem frame útil → grava a tela bruta (melhor que tela preta).
    if (video.videoWidth < 2 || video.videoHeight < 2) {
      video.pause();
      video.srcObject = null;
      video.remove();
      return fallback();
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText = compositorCaptureSurfaceCss(true);
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) {
      video.pause();
      video.srcObject = null;
      video.remove();
      canvas.remove();
      return fallback();
    }

    ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = 'high';
    } catch {
      /* ignore */
    }

    const paintOnce = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw <= 0 || vh <= 0) {
        ctx.fillStyle = '#0a0706';
        ctx.fillRect(0, 0, width, height);
        return;
      }
      // Cover central 9:16: pega a faixa do meio da tela (moldura do celular).
      const targetAspect = width / height;
      const srcAspect = vw / vh;
      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;
      if (srcAspect > targetAspect) {
        sw = vh * targetAspect;
        sx = (vw - sw) / 2;
      } else if (srcAspect < targetAspect) {
        sh = vw / targetAspect;
        sy = (vh - sh) / 2;
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
    };
    paintOnce();

    let running = true;
    let raf = 0;
    let intervalId = 0;
    // 30 fps + requestFrame (quando existe) + interval (rAF some em aba “oculta”).
    const canvasStream = canvas.captureStream(30);
    const croppedTrack = canvasStream.getVideoTracks()[0];
    if (!croppedTrack || croppedTrack.readyState === 'ended') {
      running = false;
      video.pause();
      video.srcObject = null;
      video.remove();
      canvasStream.getTracks().forEach((t) => t.stop());
      try {
        canvas.remove();
      } catch {
        /* ignore */
      }
      return fallback();
    }

    const tick = () => {
      if (!running) return;
      // Mantém o <video> do getDisplayMedia vivo no pipeline.
      if (video.paused) {
        void video.play().catch(() => undefined);
      }
      paintOnce();
      requestCanvasCaptureFrame(croppedTrack);
    };

    const loop = () => {
      tick();
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // Backup: rAF some quando o Chrome acha a aba “oculta”; interval mantém os frames.
    intervalId = window.setInterval(tick, 33);

    try {
      croppedTrack.contentHint = 'detail';
    } catch {
      /* ignore */
    }

    return {
      track: croppedTrack,
      stop: () => {
        running = false;
        cancelAnimationFrame(raf);
        if (intervalId) window.clearInterval(intervalId);
        try {
          video.pause();
        } catch {
          /* ignore */
        }
        video.srcObject = null;
        video.remove();
        canvasStream.getTracks().forEach((t) => t.stop());
        try {
          canvas.remove();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return fallback();
  }
}

/**
 * Pinta a apresentação no canvas (modo iOS / sem getDisplayMedia).
 * Prioriza vídeos e imagens visíveis — o que o usuário vê ao rolar.
 */
function paintApresentacaoFrame(
  ctx: CanvasRenderingContext2D,
  root: HTMLElement,
  width: number,
  height: number,
): void {
  const rect = root.getBoundingClientRect();
  const rw = Math.max(1, rect.width);
  const rh = Math.max(1, rect.height);
  const scaleX = width / rw;
  const scaleY = height / rh;

  ctx.fillStyle = '#0a0706';
  ctx.fillRect(0, 0, width, height);

  const nodes = root.querySelectorAll('img, video, canvas');
  nodes.forEach((node) => {
    const el = node as HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    // Fora da área visível do root
    if (r.bottom < rect.top || r.top > rect.bottom || r.right < rect.left || r.left > rect.right) {
      return;
    }

    const dx = (r.left - rect.left) * scaleX;
    const dy = (r.top - rect.top) * scaleY;
    const dw = r.width * scaleX;
    const dh = r.height * scaleY;

    try {
      if (el instanceof HTMLVideoElement) {
        if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          ctx.drawImage(el, dx, dy, dw, dh);
        }
      } else if (el instanceof HTMLImageElement) {
        if (el.complete && el.naturalWidth > 0) {
          ctx.drawImage(el, dx, dy, dw, dh);
        }
      } else if (el instanceof HTMLCanvasElement && el.width > 0) {
        ctx.drawImage(el, dx, dy, dw, dh);
      }
    } catch {
      /* CORS / tainted */
    }
  });
}

/**
 * Gravação interna da apresentação (canvas) — funciona no Safari/iOS
 * onde getDisplayMedia não existe.
 */
async function startElementCaptureRecording(opts: {
  width: number;
  height: number;
  music?: OrcamentoVideoMusicOptions | null;
  includeMicrophone?: boolean;
}): Promise<OrcamentoVideoRecordingSession> {
  if (!supportsMediaRecorder()) {
    throw new Error(
      'Este navegador não grava vídeo. Atualize o Safari ou use Chrome no computador.',
    );
  }

  const root = resolveCaptureRootElement();
  if (!root) {
    throw new Error(
      'Não encontramos a apresentação na tela. Abra o modo apresentar e tente de novo.',
    );
  }

  const { width, height, music = null, includeMicrophone = false } = opts;

  // No iOS usamos resolução um pouco menor para o encode H.264 aguentar.
  const outW = isIOSDevice() ? Math.min(width, height > width ? 1080 : 1280) : width;
  const outH = isIOSDevice()
    ? Math.round((outW / width) * height)
    : height;
  const evenW = Math.max(2, Math.round(outW / 2) * 2);
  const evenH = Math.max(2, Math.round(outH / 2) * 2);

  const canvas = document.createElement('canvas');
  canvas.width = evenW;
  canvas.height = evenH;
  // Nunca fora da tela / 2px: Chrome corta frames e grava só áudio.
  canvas.style.cssText = compositorCaptureSurfaceCss(evenH > evenW);
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) {
    canvas.remove();
    throw new Error('Não foi possível iniciar a gravação neste dispositivo.');
  }

  const fps = isIOSDevice() ? 20 : 24;
  // fps explícito + requestFrame a cada paint (mais estável em takes longas).
  const canvasStream = canvas.captureStream(fps);
  const videoTrack = canvasStream.getVideoTracks()[0];
  if (!videoTrack) {
    canvas.remove();
    throw new Error('Não foi possível capturar a apresentação.');
  }
  try {
    videoTrack.contentHint = 'detail';
  } catch {
    /* ignore */
  }

  // Sem áudio de aba: só música + mic opcional.
  const emptyDisplay = new MediaStream();
  const micStream = includeMicrophone ? await tentarMicrofoneOpcional() : null;
  const mix = await misturarAudios({
    displayStream: emptyDisplay,
    micStream,
    music: music?.url ? music : null,
  });

  const hasAnyAudio = !!(mix.mixedAudioStream && mix.mixedAudioStream.getAudioTracks().length);
  const mixed = new MediaStream([
    videoTrack,
    ...(hasAnyAudio ? mix.mixedAudioStream!.getAudioTracks() : []),
  ]);

  const mimeType = pickRecorderMimeType(hasAnyAudio);
  const bitrate = isIOSDevice() ? 4_000_000 : resolveVideoHdBitrate(evenW, evenH);

  const buildRecorder = (bits: number) => {
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: bits,
    };
    if (mimeType) recorderOptions.mimeType = mimeType;
    if (hasAnyAudio) recorderOptions.audioBitsPerSecond = 128_000;
    try {
      return new MediaRecorder(mixed, recorderOptions);
    } catch {
      try {
        return new MediaRecorder(mixed, mimeType ? { mimeType } : undefined);
      } catch {
        return new MediaRecorder(mixed);
      }
    }
  };

  const chunks: Blob[] = [];
  let disposed = false;
  let encodingStartedAt = 0;
  let pausedAccumMs = 0;
  let pauseStartedAt = 0;
  let stopResolve: ((result: OrcamentoVideoRecordingResult) => void) | null = null;
  let stopReject: ((err: Error) => void) | null = null;
  let paintRaf = 0;
  let paintInterval = 0;
  let painting = false;

  const wireRecorder = (rec: MediaRecorder) => {
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    rec.onerror = () => {
      stopReject?.(new Error('Falha durante a gravação do vídeo.'));
      stopResolve = null;
      stopReject = null;
    };
    rec.onstop = () => {
      const wallMs = encodingStartedAt
        ? Math.max(0, performance.now() - encodingStartedAt)
        : 0;
      const durationMs = Math.max(0, wallMs - pausedAccumMs);
      const claimed =
        rec.mimeType || mimeType || (prefersMp4Recording() ? 'video/mp4' : 'video/webm');
      const resolve = stopResolve;
      const reject = stopReject;
      stopResolve = null;
      stopReject = null;
      void finalizeRecordingBlob(chunks, claimed)
        .then(({ blob, mimeType: finalMime, extension }) => {
          // Só libera tracks depois do blob pronto — senão o Chrome corta o fim.
          disposeInternals();
          resolve?.({
            blob,
            mimeType: finalMime,
            extension,
            width: evenW,
            height: evenH,
            durationMs,
            hasAudio: hasAnyAudio,
            hasTabAudio: false,
            hasMusic: mix.hasMusic,
          });
        })
        .catch((err) => {
          disposeInternals();
          reject?.(err instanceof Error ? err : new Error('Falha ao finalizar o vídeo.'));
        });
    };
  };

  let recorder = buildRecorder(bitrate);
  wireRecorder(recorder);

  const stopPaint = () => {
    painting = false;
    if (paintRaf) cancelAnimationFrame(paintRaf);
    paintRaf = 0;
    if (paintInterval) {
      window.clearInterval(paintInterval);
      paintInterval = 0;
    }
  };

  const startPaint = () => {
    painting = true;
    const tick = () => {
      if (!painting) return;
      paintApresentacaoFrame(ctx, root, evenW, evenH);
      requestCanvasCaptureFrame(videoTrack);
    };
    tick();
    const loop = () => {
      tick();
      if (painting) paintRaf = requestAnimationFrame(loop);
    };
    paintRaf = requestAnimationFrame(loop);
    // Interval garante frames mesmo se o Chrome reduzir o rAF.
    paintInterval = window.setInterval(tick, Math.round(1000 / fps));
  };

  const disposeInternals = () => {
    if (disposed) return;
    disposed = true;
    stopPaint();
    mix.dispose();
    micStream?.getTracks().forEach((t) => t.stop());
    canvasStream.getTracks().forEach((t) => t.stop());
    try {
      canvas.remove();
    } catch {
      /* ignore */
    }
  };

  void mix.unlockMusic();

  const begin = () => {
    if (disposed) throw new Error('A sessão de gravação já foi encerrada.');
    if (recorder.state === 'recording' || recorder.state === 'paused') return;

    encodingStartedAt = performance.now();
    pausedAccumMs = 0;
    pauseStartedAt = 0;
    void mix.startMusic();
    startPaint();

    const tryStart = (rec: MediaRecorder) => {
      // Só MP4 real (Safari) sem timeslice. Chrome WebM: timeslice 1s (estável + menos truncamento).
      const useMp4Block =
        (isMp4MimeType(mimeType) || isIOSDevice() || isSafariBrowser()) &&
        !mimeType.includes('webm');
      if (useMp4Block) {
        try {
          rec.start();
          return true;
        } catch {
          try {
            rec.start(1000);
            return true;
          } catch {
            return false;
          }
        }
      }
      try {
        rec.start(1000);
        return true;
      } catch {
        try {
          rec.start();
          return true;
        } catch {
          return false;
        }
      }
    };

    if (!tryStart(recorder)) {
      recorder = buildRecorder(Math.min(bitrate, 2_500_000));
      wireRecorder(recorder);
      if (!tryStart(recorder)) {
        stopPaint();
        throw new Error('Não foi possível iniciar a gravação neste Safari/iPhone.');
      }
    }
  };

  const pause = () => {
    if (disposed || recorder.state !== 'recording') return;
    try {
      recorder.pause();
    } catch {
      return;
    }
    pauseStartedAt = performance.now();
    stopPaint();
    mix.pauseMusic();
  };

  const resume = () => {
    if (disposed || recorder.state !== 'paused') return;
    try {
      recorder.resume();
    } catch {
      return;
    }
    if (pauseStartedAt > 0) {
      pausedAccumMs += performance.now() - pauseStartedAt;
      pauseStartedAt = 0;
    }
    startPaint();
    void mix.resumeMusic();
  };

  const isPaused = () => recorder.state === 'paused';

  const dispose = () => {
    if (disposed) return;
    try {
      if (recorder.state === 'recording' || recorder.state === 'paused') {
        recorder.stop();
      }
    } catch {
      /* ignore */
    }
    disposeInternals();
  };

  const stop = () =>
    new Promise<OrcamentoVideoRecordingResult>((resolve, reject) => {
      if (disposed) {
        reject(new Error('A sessão de gravação já foi encerrada.'));
        return;
      }
      if (recorder.state === 'inactive') {
        reject(new Error('A gravação ainda não tinha começado.'));
        return;
      }
      if (recorder.state === 'paused' && pauseStartedAt > 0) {
        pausedAccumMs += performance.now() - pauseStartedAt;
        pauseStartedAt = 0;
      }
      stopResolve = resolve;
      stopReject = reject;

      const failSafe = window.setTimeout(() => {
        if (!stopReject) return;
        const r = stopReject;
        stopResolve = null;
        stopReject = null;
        disposeInternals();
        r(new Error('A finalização da gravação demorou demais. Tente de novo.'));
      }, 20_000);

      const clearFailSafe = () => window.clearTimeout(failSafe);
      const prevResolve = stopResolve;
      const prevReject = stopReject;
      stopResolve = (result) => {
        clearFailSafe();
        prevResolve?.(result);
      };
      stopReject = (err) => {
        clearFailSafe();
        prevReject?.(err);
      };

      try {
        if (recorder.state === 'paused') {
          try {
            recorder.resume();
          } catch {
            /* ignore */
          }
        }
        if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
          try {
            recorder.requestData();
          } catch {
            /* ignore */
          }
        }
        // Pequena pausa: o Chrome flusha o último cluster depois do requestData.
        window.setTimeout(() => {
          try {
            if (recorder.state === 'recording' || recorder.state === 'paused') {
              recorder.stop();
            }
          } catch (err) {
            clearFailSafe();
            stopResolve = null;
            stopReject = null;
            reject(
              err instanceof Error ? err : new Error('Não foi possível finalizar a gravação.'),
            );
          }
        }, 150);
      } catch (err) {
        clearFailSafe();
        stopResolve = null;
        stopReject = null;
        reject(err instanceof Error ? err : new Error('Não foi possível finalizar a gravação.'));
      }
    });

  return {
    hasAudio: hasAnyAudio,
    hasTabAudio: false,
    hasMusic: mix.hasMusic,
    begin,
    pause,
    resume,
    isPaused,
    stop,
    dispose,
    setMusicVolume: mix.setMusicVolume,
  };
}

/**
 * Grava a tela (layout real) + áudio da aba/sistema + mic opcional + música de fundo.
 * No iOS/Safari sem getDisplayMedia: grava a apresentação por canvas (MP4).
 */
export async function startOrcamentoVideoRecording(opts: {
  width: number;
  height: number;
  music?: OrcamentoVideoMusicOptions | null;
  /** Default false: mic ligado sozinho costuma gravar chiado ambiente. */
  includeMicrophone?: boolean;
  /** Força modo interno (canvas), útil em testes. */
  forceElementCapture?: boolean;
}): Promise<OrcamentoVideoRecordingSession> {
  if (!supportsMediaRecorder()) {
    throw new Error(
      'Este navegador não grava vídeo. Atualize o Safari ou use Chrome/Edge no computador.',
    );
  }

  const useElement =
    opts.forceElementCapture ||
    shouldUseElementCaptureRecording();

  if (useElement) {
    return startElementCaptureRecording(opts);
  }

  return startDisplayMediaRecording(opts);
}

/**
 * Grava a tela (layout real) + áudio da aba/sistema + mic opcional + música de fundo.
 * Sempre exporta no tamanho pedido (ex.: celular 1080×1920) com crop central.
 */
async function startDisplayMediaRecording(opts: {
  width: number;
  height: number;
  music?: OrcamentoVideoMusicOptions | null;
  includeMicrophone?: boolean;
}): Promise<OrcamentoVideoRecordingSession> {
  if (!supportsDisplayMediaCapture()) {
    return startElementCaptureRecording(opts);
  }

  const { width, height, music = null, includeMicrophone = false } = opts;

  const displayStream = await pedirTelaComAudio(width, height);
  if (!displayStream.getVideoTracks()[0]) {
    displayStream.getTracks().forEach((t) => t.stop());
    throw new Error('A gravação de tela não retornou vídeo.');
  }

  const crop = await criarTrackVideoRecortado(displayStream, width, height);
  const displayTrack = displayStream.getVideoTracks()[0]!;

  const micStream = includeMicrophone ? await tentarMicrofoneOpcional() : null;
  const mix = await misturarAudios({
    displayStream,
    micStream,
    music: music?.url ? music : null,
  });

  const hasAnyAudio = !!(mix.mixedAudioStream && mix.mixedAudioStream.getAudioTracks().length);
  const mixed = new MediaStream([
    crop.track,
    ...(hasAnyAudio ? mix.mixedAudioStream!.getAudioTracks() : []),
  ]);

  const mimeType = pickRecorderMimeType(hasAnyAudio);
  const bitrate = resolveVideoHdBitrate(width, height);
  const buildRecorder = (bits: number) => {
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: bits,
    };
    if (mimeType) recorderOptions.mimeType = mimeType;
    if (hasAnyAudio) recorderOptions.audioBitsPerSecond = 192_000;
    try {
      return new MediaRecorder(mixed, recorderOptions);
    } catch {
      try {
        return new MediaRecorder(mixed, mimeType ? { mimeType } : undefined);
      } catch {
        return new MediaRecorder(mixed);
      }
    }
  };

  const chunks: Blob[] = [];

  let disposed = false;
  let encodingStartedAt = 0;
  /** Tempo acumulado em pause (para durationMs refletir só o gravado). */
  let pausedAccumMs = 0;
  let pauseStartedAt = 0;
  let stopResolve: ((result: OrcamentoVideoRecordingResult) => void) | null = null;
  let stopReject: ((err: Error) => void) | null = null;

  const recordedWidth = width;
  const recordedHeight = height;

  const wireRecorder = (rec: MediaRecorder) => {
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    rec.onerror = () => {
      stopReject?.(new Error('Falha durante a gravação do vídeo.'));
      stopResolve = null;
      stopReject = null;
    };
    rec.onstop = () => {
      const wallMs = encodingStartedAt
        ? Math.max(0, performance.now() - encodingStartedAt)
        : 0;
      const durationMs = Math.max(0, wallMs - pausedAccumMs);
      const claimed = rec.mimeType || mimeType || 'video/webm';
      const resolve = stopResolve;
      const reject = stopReject;
      stopResolve = null;
      stopReject = null;
      void finalizeRecordingBlob(chunks, claimed)
        .then(({ blob, mimeType: finalMime, extension }) => {
          // Só libera tela/áudio depois do blob pronto — senão o Chrome corta o fim.
          disposeInternals();
          resolve?.({
            blob,
            mimeType: finalMime,
            extension,
            width: recordedWidth,
            height: recordedHeight,
            durationMs,
            hasAudio: hasAnyAudio,
            hasTabAudio: mix.hasTabAudio,
            hasMusic: mix.hasMusic,
          });
        })
        .catch((err) => {
          disposeInternals();
          reject?.(err instanceof Error ? err : new Error('Falha ao finalizar o vídeo.'));
        });
    };
  };

  let recorder = buildRecorder(bitrate);
  wireRecorder(recorder);

  displayTrack.addEventListener('ended', () => {
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
  });

  const disposeInternals = () => {
    if (disposed) return;
    disposed = true;
    crop.stop();
    mix.dispose();
    micStream?.getTracks().forEach((t) => t.stop());
    displayStream.getTracks().forEach((t) => t.stop());
  };

  // Desbloqueia áudio ainda no gesto do getDisplayMedia (antes do countdown).
  void mix.unlockMusic();

  const begin = () => {
    if (disposed) {
      throw new Error('A sessão de gravação já foi encerrada.');
    }
    if (recorder.state === 'recording' || recorder.state === 'paused') return;

    encodingStartedAt = performance.now();
    pausedAccumMs = 0;
    pauseStartedAt = 0;
    void mix.startMusic();

    const tryStart = (rec: MediaRecorder) => {
      // Só Safari/iOS MP4 sem timeslice. Chrome WebM: timeslice 1s (estável + menos truncamento).
      const useMp4Block =
        (isMp4MimeType(mimeType) || isIOSDevice() || isSafariBrowser()) &&
        !mimeType.includes('webm');
      if (useMp4Block) {
        try {
          rec.start();
          return true;
        } catch {
          try {
            rec.start(1000);
            return true;
          } catch {
            return false;
          }
        }
      }
      try {
        rec.start(1000);
        return true;
      } catch {
        try {
          rec.start();
          return true;
        } catch {
          return false;
        }
      }
    };

    if (!tryStart(recorder)) {
      recorder = buildRecorder(Math.min(bitrate, 6_000_000));
      wireRecorder(recorder);
      if (!tryStart(recorder)) {
        throw new Error('Não foi possível iniciar o MediaRecorder neste navegador.');
      }
    }

    if (recorder.state !== 'recording' && recorder.state !== 'paused') {
      throw new Error('A gravação não entrou em modo REC. Tente novamente e compartilhe esta aba.');
    }
  };

  const pause = () => {
    if (disposed || recorder.state !== 'recording') return;
    try {
      recorder.pause();
    } catch {
      return;
    }
    pauseStartedAt = performance.now();
    mix.pauseMusic();
  };

  const resume = () => {
    if (disposed || recorder.state !== 'paused') return;
    try {
      recorder.resume();
    } catch {
      return;
    }
    if (pauseStartedAt > 0) {
      pausedAccumMs += performance.now() - pauseStartedAt;
      pauseStartedAt = 0;
    }
    void mix.resumeMusic();
  };

  const isPaused = () => recorder.state === 'paused';

  const dispose = () => {
    if (disposed) return;
    try {
      if (recorder.state === 'recording' || recorder.state === 'paused') {
        recorder.stop();
      }
    } catch {
      /* ignore */
    }
    disposeInternals();
  };

  const stop = () =>
    new Promise<OrcamentoVideoRecordingResult>((resolve, reject) => {
      if (disposed) {
        reject(new Error('A sessão de gravação já foi encerrada.'));
        return;
      }
      if (recorder.state === 'inactive') {
        reject(new Error('A gravação ainda não tinha começado.'));
        return;
      }
      if (recorder.state === 'paused' && pauseStartedAt > 0) {
        pausedAccumMs += performance.now() - pauseStartedAt;
        pauseStartedAt = 0;
      }
      stopResolve = resolve;
      stopReject = reject;

      const failSafe = window.setTimeout(() => {
        if (!stopReject) return;
        const r = stopReject;
        stopResolve = null;
        stopReject = null;
        disposeInternals();
        r(new Error('A finalização da gravação demorou demais. Tente de novo.'));
      }, 20_000);

      const clearFailSafe = () => window.clearTimeout(failSafe);
      const prevResolve = stopResolve;
      const prevReject = stopReject;
      stopResolve = (result) => {
        clearFailSafe();
        prevResolve?.(result);
      };
      stopReject = (err) => {
        clearFailSafe();
        prevReject?.(err);
      };

      try {
        if (recorder.state === 'paused') {
          try {
            recorder.resume();
          } catch {
            /* ignore */
          }
        }
        if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
          try {
            recorder.requestData();
          } catch {
            /* ignore */
          }
        }
        // Pequena pausa: o Chrome flusha o último cluster depois do requestData.
        window.setTimeout(() => {
          try {
            if (recorder.state === 'recording' || recorder.state === 'paused') {
              recorder.stop();
            }
          } catch (err) {
            clearFailSafe();
            stopResolve = null;
            stopReject = null;
            reject(
              err instanceof Error ? err : new Error('Não foi possível finalizar a gravação.'),
            );
          }
        }, 150);
      } catch (err) {
        clearFailSafe();
        stopResolve = null;
        stopReject = null;
        reject(err instanceof Error ? err : new Error('Não foi possível finalizar a gravação.'));
      }
    });

  return {
    hasAudio: hasAnyAudio,
    hasTabAudio: mix.hasTabAudio,
    hasMusic: mix.hasMusic,
    begin,
    pause,
    resume,
    isPaused,
    stop,
    dispose,
    setMusicVolume: mix.setMusicVolume,
  };
}
