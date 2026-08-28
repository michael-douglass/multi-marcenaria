/**
 * Cache rápido dos vídeos da apresentação para a gravação.
 *
 * Antes: reencodava ~720p (muito lento).
 * Agora: só baixa para memória (blob:) — segundos, não minutos.
 * Isso já evita travar por streaming remoto durante o MediaRecorder.
 */

const MAX_CACHE_BYTES = 80 * 1024 * 1024;
/** Tempo máximo por arquivo no prefetch (não trava o “Começar”). */
const FETCH_TIMEOUT_MS = 12_000;

const memoryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function isOrcamentoVideoBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

export function normalizeOrcamentoVideoCacheKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url.split('#')[0] ?? url;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = window.setTimeout(() => ctrl?.abort(), timeoutMs);
  try {
    return await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      // `force-cache` dispara ERR_CACHE_OPERATION_NOT_SUPPORTED em alguns Chrome/extensões.
      cache: 'default',
      signal: ctrl?.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Mantido por compatibilidade: não reencoda mais (era lento demais).
 * Devolve o blob original imediatamente.
 */
export async function optimizeVideoBlobForRecording(sourceBlob: Blob): Promise<Blob> {
  return sourceBlob;
}

/**
 * URL local (blob) do vídeo — download rápido em memória.
 * `opts.lite` é ignorado (antes gerava reencode; agora é o mesmo cache rápido).
 */
export async function resolveCachedVideoUrl(
  url: string,
  _opts?: { lite?: boolean },
): Promise<string> {
  if (!url || isOrcamentoVideoBlobUrl(url)) return url;

  const key = normalizeOrcamentoVideoCacheKey(url);
  const hit = memoryCache.get(key);
  if (hit) return hit;

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
        if (!res.ok) return url;

        const blob = await res.blob();
        if (blob.size < 256) return url;
        if (blob.size > MAX_CACHE_BYTES) return url;

        const objectUrl = URL.createObjectURL(blob);
        memoryCache.set(key, objectUrl);
        return objectUrl;
      } catch {
        return url;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, pending);
  }

  return pending;
}

export interface PrefetchVideosResult {
  cached: number;
  total: number;
  lite: boolean;
  elapsedMs: number;
}

/** Pré-carrega em paralelo todos os vídeos visíveis (rápido, sem reencode). */
export async function prefetchOrcamentoApresentacaoVideos(
  root: ParentNode = document,
  opts?: { lite?: boolean; timeoutMs?: number },
): Promise<PrefetchVideosResult> {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (typeof document === 'undefined') {
    return { cached: 0, total: 0, lite: !!opts?.lite, elapsedMs: 0 };
  }

  const urls = new Set<string>();

  root.querySelectorAll('[data-orcamento-video] video').forEach((node) => {
    const video = node as HTMLVideoElement;
    const fromAttr = video.getAttribute('src');
    const current = video.currentSrc || video.src || fromAttr || '';
    const original =
      (video.closest('[data-orcamento-video]') as HTMLElement | null)?.dataset.videoSrc ||
      current;
    if (original && !isOrcamentoVideoBlobUrl(original)) {
      urls.add(normalizeOrcamentoVideoCacheKey(original));
    }
  });

  root.querySelectorAll('[data-orcamento-video][data-video-src]').forEach((node) => {
    const u = (node as HTMLElement).dataset.videoSrc;
    if (u && !isOrcamentoVideoBlobUrl(u)) urls.add(normalizeOrcamentoVideoCacheKey(u));
  });

  const list = [...urls];
  if (list.length === 0) {
    return {
      cached: 0,
      total: 0,
      lite: !!opts?.lite,
      elapsedMs: Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started,
      ),
    };
  }

  // Limite global: não segura o usuário mais que ~15s no total.
  const budgetMs = opts?.timeoutMs ?? 15_000;
  const work = Promise.all(list.map((u) => resolveCachedVideoUrl(u)));
  const results = await Promise.race([
    work,
    new Promise<string[]>((resolve) => {
      window.setTimeout(() => {
        resolve(list.map((u) => memoryCache.get(u) ?? u));
      }, budgetMs);
    }),
  ]);

  const cached = results.filter((r) => isOrcamentoVideoBlobUrl(r)).length;
  return {
    cached,
    total: list.length,
    lite: !!opts?.lite,
    elapsedMs: Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started,
    ),
  };
}

export function getCachedVideoUrlIfReady(
  url: string,
  _opts?: { lite?: boolean },
): string | null {
  if (!url || isOrcamentoVideoBlobUrl(url)) return url || null;
  return memoryCache.get(normalizeOrcamentoVideoCacheKey(url)) ?? null;
}

export function clearOrcamentoVideoPlaybackCache(): void {
  for (const objectUrl of memoryCache.values()) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      /* ignore */
    }
  }
  memoryCache.clear();
  inflight.clear();
}

export function orcamentoVideoPlaybackCacheSize(): number {
  return memoryCache.size;
}

/** Pausa os outros vídeos da apresentação (só um decode por vez na gravação). */
export function pauseOtherOrcamentoVideos(except: HTMLVideoElement): void {
  document.querySelectorAll('[data-orcamento-video] video').forEach((node) => {
    const video = node as HTMLVideoElement;
    if (video === except) return;
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  });
}
