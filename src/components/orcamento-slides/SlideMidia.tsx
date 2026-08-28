import { useEffect, useRef, useState } from 'react';
import { Film, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  urlImagemApresentacao,
  type SlideImagemRedimensionar,
  type SlideImagemTamanho,
} from '@/lib/orcamento-slide-imagem-url';
import { isOrcamentoMidiaVideo } from '@/lib/orcamento-slide-midia-video';
import {
  getCachedVideoUrlIfReady,
  isOrcamentoVideoBlobUrl,
  pauseOtherOrcamentoVideos,
  resolveCachedVideoUrl,
} from '@/lib/orcamento-slide-video-playback-cache';
import {
  isApresentacaoMidiaAudible,
  subscribeApresentacaoMidiaAudible,
} from '@/lib/orcamento-slide-video-record';
import { useSlideLayoutContext } from '@/components/orcamento-slides/orcamento-slide-layout-context';

interface SlideMidiaProps {
  src: string;
  alt?: string;
  fileName?: string | null;
  mimeType?: string | null;
  mobile: boolean;
  tamanho?: SlideImagemTamanho;
  /** cover = preenche e recorta; contain = exibe a mídia inteira. */
  redimensionar?: SlideImagemRedimensionar;
  /** Primeira mídia visível — carrega antes das demais. */
  priority?: boolean;
  className?: string;
  /** Classe do wrapper externo (útil para vídeo com moldura). */
  wrapperClassName?: string;
  /**
   * Força áudio do vídeo (ex.: durante gravação da tela).
   * Autoplay no browser ainda pode exigir interação prévia.
   */
  audible?: boolean;
  /**
   * No celular, preenche a área do slide mesmo antes de ler o tamanho do vídeo
   * (útil para Reels 1080×1920 na gravação).
   */
  forceFillMobile?: boolean;
}

/** Retrato típico de celular / Reels (ex.: 1080×1920). */
function isVerticalVideoSize(width: number, height: number): boolean {
  if (width < 2 || height < 2) return false;
  return height / width >= 1.25;
}

/**
 * Foto ou vídeo na apresentação.
 * No celular, vídeos verticais (1080×1920) ocupam a tela toda.
 */
export function SlideMidia({
  src,
  alt = '',
  fileName,
  mimeType,
  mobile,
  tamanho = 'medium',
  redimensionar = 'cover',
  priority = false,
  className,
  wrapperClassName,
  audible = false,
  forceFillMobile = false,
}: SlideMidiaProps) {
  const { omitVideos } = useSlideLayoutContext();
  const isVideo = isOrcamentoMidiaVideo({
    file_url: src,
    file_name: fileName,
    mime_type: mimeType,
  });

  // PDF/imagens: nunca dispara download de vídeo (evita ERR_CACHE e timeout de rede).
  if (isVideo && omitVideos) {
    return (
      <div
        data-orcamento-video=""
        data-video-src={src}
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-stone-950 text-stone-400',
          wrapperClassName,
          className,
        )}
        aria-hidden
      >
        <Film className="h-10 w-10 opacity-50" />
      </div>
    );
  }

  if (isVideo) {
    return (
      <SlideVideoPlayer
        src={src}
        alt={alt}
        mobile={mobile}
        redimensionar={redimensionar}
        className={className}
        wrapperClassName={wrapperClassName}
        audible={audible}
        forceFillMobile={forceFillMobile}
      />
    );
  }

  return (
    <SlideImagemInterna
      src={src}
      alt={alt}
      mobile={mobile}
      tamanho={tamanho}
      redimensionar={redimensionar}
      priority={priority}
      className={className}
    />
  );
}

function SlideVideoPlayer({
  src,
  alt,
  mobile,
  redimensionar,
  className,
  wrapperClassName,
  audible,
  forceFillMobile,
}: {
  src: string;
  alt: string;
  mobile: boolean;
  redimensionar: SlideImagemRedimensionar;
  className?: string;
  wrapperClassName?: string;
  audible: boolean;
  forceFillMobile: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isVertical, setIsVertical] = useState(forceFillMobile);
  const [isPaused, setIsPaused] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [playbackSrc, setPlaybackSrc] = useState(src);
  const [liveAudible, setLiveAudible] = useState(
    () => audible || isApresentacaoMidiaAudible(),
  );

  useEffect(() => {
    setLiveAudible(audible || isApresentacaoMidiaAudible());
    return subscribeApresentacaoMidiaAudible((on) => {
      setLiveAudible(audible || on);
    });
  }, [audible]);

  const recordingMode = liveAudible;

  // Na gravação: versão em cache (blob local) — permite desenhar no canvas (CORS)
  // e evita o “vídeo preto” da aceleração de hardware na captura de aba.
  useEffect(() => {
    let cancelled = false;

    if (!recordingMode) {
      setPlaybackSrc(src);
      setIsPreparing(false);
      setLoadFailed(false);
      setNeedsGesture(false);
      return () => {
        cancelled = true;
      };
    }

    const ready = getCachedVideoUrlIfReady(src, { lite: true });
    if (ready) {
      setPlaybackSrc(ready);
      setIsPreparing(false);
      return () => {
        cancelled = true;
      };
    }

    setIsPreparing(true);
    void resolveCachedVideoUrl(src, { lite: true }).then((url) => {
      if (cancelled) return;
      setPlaybackSrc(url);
      setIsPreparing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [src, recordingMode]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const syncAspect = () => {
      setIsVertical(forceFillMobile || isVerticalVideoSize(el.videoWidth, el.videoHeight));
    };

    if (el.videoWidth > 0) syncAspect();
    else if (forceFillMobile) setIsVertical(true);
    el.addEventListener('loadedmetadata', syncAspect);
    return () => el.removeEventListener('loadedmetadata', syncAspect);
  }, [playbackSrc, forceFillMobile]);

  // Só pausa ao ENTRAR no modo gravação — não a cada troca de URL do cache
  // (senão o play do usuário era cancelado e a voz sumia).
  const wasLiveAudibleRef = useRef(liveAudible);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !liveAudible;

    const wasAudible = wasLiveAudibleRef.current;
    wasLiveAudibleRef.current = liveAudible;

    if (liveAudible && !wasAudible) {
      el.pause();
      setIsPaused(true);
    } else if (!liveAudible && wasAudible && el.paused) {
      void el.play().catch(() => undefined);
    }
  }, [liveAudible]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !liveAudible;
  }, [liveAudible, playbackSrc]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => {
      setIsPaused(false);
      setNeedsGesture(false);
      setLoadFailed(false);
      if (recordingMode) pauseOtherOrcamentoVideos(el);
    };
    const onPause = () => setIsPaused(true);
    const onError = () => {
      setLoadFailed(true);
      setIsPaused(true);
      setNeedsGesture(true);
    };
    const onWaiting = () => {
      if (!recordingMode || isOrcamentoVideoBlobUrl(playbackSrc)) return;
      void resolveCachedVideoUrl(src, { lite: true }).then((url) => {
        if (url !== playbackSrc) setPlaybackSrc(url);
      });
    };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);
    el.addEventListener('waiting', onWaiting);
    setIsPaused(el.paused);
    if (el.error) {
      setLoadFailed(true);
      setNeedsGesture(true);
    }
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
      el.removeEventListener('waiting', onWaiting);
    };
  }, [playbackSrc, recordingMode, src]);

  // Tablet/iPad/Safari: autoplay costuma falhar fora do viewport — tenta play ao entrar na tela.
  useEffect(() => {
    if (recordingMode) return;
    const el = videoRef.current;
    const wrap = wrapperRef.current;
    if (!el || !wrap) return;

    const tryPlay = () => {
      if (el.error) {
        setLoadFailed(true);
        setNeedsGesture(true);
        return;
      }
      el.muted = true;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        void playPromise
          .then(() => {
            setNeedsGesture(false);
            setIsPaused(false);
          })
          .catch(() => {
            setNeedsGesture(true);
            setIsPaused(true);
          });
      }
    };

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          tryPlay();
        } else if (!entry.isIntersecting && !el.paused) {
          el.pause();
        }
      },
      { threshold: [0, 0.35, 0.6] },
    );
    obs.observe(wrap);

    // Tentativa inicial (slide já visível no carregamento).
    if (el.paused) tryPlay();

    return () => obs.disconnect();
  }, [playbackSrc, recordingMode]);

  /**
   * Espelha o <video> num <canvas> durante a gravação.
   * getDisplayMedia no Chrome costuma capturar áudio mas deixar o vídeo preto
   * (overlay da GPU). O canvas entra na composição da página e aparece na filmagem.
   *
   * Importante: NÃO use opacity:0 no <video> — o Chrome para de decodificar frames
   * (áudio continua e a imagem congela no 1º quadro). Mantemos opacity mínima.
   */
  useEffect(() => {
    if (!recordingMode || isPaused || isPreparing) return;
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = 'high';
    } catch {
      /* ignore */
    }

    let running = true;
    let raf = 0;
    let timer = 0;
    let frameHandle = 0;

    const syncSize = (): boolean => {
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;
      if (vw < 2 || vh < 2) return false;
      // Limita custo na gravação (Full HD basta).
      const maxEdge = 1280;
      const scale = Math.min(1, maxEdge / Math.max(vw, vh));
      const w = Math.max(2, Math.round((vw * scale) / 2) * 2);
      const h = Math.max(2, Math.round((vh * scale) / 2) * 2);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return true;
    };

    const paint = () => {
      if (!running) return;
      if (!syncSize()) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.paused || video.ended) return;
      try {
        ctx.fillStyle = '#0a0706';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        /* CORS / decode — blob local deve funcionar */
      }
    };

    const tick = () => {
      paint();
      if (!running) return;
      raf = window.requestAnimationFrame(tick);
    };

    paint();
    raf = window.requestAnimationFrame(tick);
    // Intervalo de segurança: rAF pode pausar com a aba em segundo plano.
    timer = window.setInterval(paint, Math.round(1000 / 30));

    if (typeof video.requestVideoFrameCallback === 'function') {
      const onFrame = () => {
        if (!running) return;
        paint();
        frameHandle = video.requestVideoFrameCallback!(onFrame);
      };
      frameHandle = video.requestVideoFrameCallback(onFrame);
    }

    return () => {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      if (timer) window.clearInterval(timer);
      if (typeof video.cancelVideoFrameCallback === 'function' && frameHandle) {
        try {
          video.cancelVideoFrameCallback(frameHandle);
        } catch {
          /* ignore */
        }
      }
    };
  }, [recordingMode, isPaused, isPreparing, playbackSrc]);

  const handlePlayClick = () => {
    const el = videoRef.current;
    if (!el || isPreparing) return;

    void (async () => {
      try {
        if (recordingMode && !isOrcamentoVideoBlobUrl(playbackSrc)) {
          setIsPreparing(true);
          const cached = await resolveCachedVideoUrl(src, { lite: true });
          setPlaybackSrc(cached);
          setIsPreparing(false);
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve());
          });
        }

        const current = videoRef.current;
        if (!current) return;
        if (recordingMode) pauseOtherOrcamentoVideos(current);

        if (current.error) {
          setLoadFailed(true);
          current.load();
        }

        if (current.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          await new Promise<void>((resolve) => {
            const done = () => {
              current.removeEventListener('canplay', done);
              current.removeEventListener('canplaythrough', done);
              resolve();
            };
            current.addEventListener('canplay', done, { once: true });
            current.addEventListener('canplaythrough', done, { once: true });
            current.load();
            window.setTimeout(done, 2500);
          });
        }

        current.muted = !liveAudible;
        await current.play();
        setNeedsGesture(false);
        setLoadFailed(false);
      } catch {
        setIsPreparing(false);
        setNeedsGesture(true);
      }
    })();
  };

  const handleCaptureClick = () => {
    const el = videoRef.current;
    if (!el || isPreparing) return;
    if (el.paused) {
      handlePlayClick();
      return;
    }
    el.pause();
  };

  // Celular + vídeo retrato (1080×1920) ou fill forçado: tela cheia.
  const fillMobile = mobile && (forceFillMobile || isVertical);
  const videoObjectClass = fillMobile
    ? 'h-full w-full object-cover'
    : redimensionar === 'contain'
      ? 'max-h-full max-w-full object-contain'
      : 'h-full w-full object-cover';

  const showPlayOverlay =
    !recordingMode && (needsGesture || (isPaused && fillMobile) || loadFailed);

  return (
    <div
      ref={wrapperRef}
      data-orcamento-video=""
      data-video-src={src}
      data-video-vertical={fillMobile ? 'true' : undefined}
      data-video-capture-mirror={recordingMode ? 'canvas' : undefined}
      className={cn(
        'relative overflow-hidden bg-gradient-to-b from-stone-950 via-stone-900 to-black',
        fillMobile ? 'absolute inset-0 h-full w-full' : 'h-full w-full',
        // Camada própria na GPU — reduz conflito com a captura de tela.
        recordingMode && 'transform-gpu will-change-transform',
        wrapperClassName,
      )}
    >
      <video
        ref={videoRef}
        src={playbackSrc}
        className={cn(
          videoObjectClass,
          className,
          fillMobile && '!max-h-none !max-w-none h-full w-full object-cover',
          // Opacity mínima (não 0): Chrome para de gerar frames se o vídeo estiver invisível.
          // O canvas cobre por cima e é o que a filmagem captura.
          recordingMode &&
            'pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.02]',
        )}
        controls={!recordingMode && !fillMobile && !loadFailed}
        playsInline
        muted={!liveAudible}
        loop
        autoPlay={!recordingMode}
        preload={recordingMode ? 'auto' : 'metadata'}
        // CORS só na gravação (canvas). Na apresentação, crossOrigin quebra tablet/iPad
        // quando o storage não devolve Access-Control-Allow-Origin.
        crossOrigin={
          recordingMode && !isOrcamentoVideoBlobUrl(playbackSrc) ? 'anonymous' : undefined
        }
        disableRemotePlayback={true}
        aria-label={alt || 'Vídeo do orçamento'}
      />
      {recordingMode && (
        <canvas
          ref={captureCanvasRef}
          className={cn(
            'absolute inset-0 z-[1] h-full w-full',
            fillMobile || redimensionar === 'cover' ? 'object-cover' : 'object-contain',
          )}
          aria-hidden
        />
      )}
      {recordingMode && !isPaused && !isPreparing && (
        <button
          type="button"
          onClick={handleCaptureClick}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
          aria-label="Pausar vídeo"
        />
      )}
      {recordingMode && (isPaused || isPreparing) && (
        <button
          type="button"
          onClick={handlePlayClick}
          disabled={isPreparing}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/35 transition-colors hover:bg-black/45 disabled:cursor-wait"
          aria-label={isPreparing ? 'Preparando vídeo' : 'Reproduzir vídeo'}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-stone-950 shadow-xl shadow-black/50 ring-2 ring-amber-200/50">
            {isPreparing ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-950/30 border-t-stone-950" />
            ) : (
              <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />
            )}
          </span>
          {isPreparing && (
            <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-50/95">
              Carregando vídeo…
            </span>
          )}
        </button>
      )}
      {showPlayOverlay && (
        <button
          type="button"
          onClick={handlePlayClick}
          disabled={isPreparing}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/40 transition-colors hover:bg-black/50 disabled:cursor-wait"
          aria-label={loadFailed ? 'Tentar reproduzir vídeo novamente' : 'Reproduzir vídeo'}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-stone-950 shadow-xl shadow-black/50 ring-2 ring-amber-200/50">
            {isPreparing ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-950/30 border-t-stone-950" />
            ) : (
              <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />
            )}
          </span>
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-50/95">
            {loadFailed ? 'Toque para tentar de novo' : 'Toque para reproduzir'}
          </span>
        </button>
      )}
      {!fillMobile && !recordingMode && !showPlayOverlay && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-50/95 ring-1 ring-amber-200/20 sm:text-[11px]">
          <Film className="h-3 w-3 text-amber-300" aria-hidden />
          Vídeo
        </div>
      )}
    </div>
  );
}

function SlideImagemInterna({
  src,
  alt = '',
  mobile,
  tamanho = 'medium',
  redimensionar = 'cover',
  priority = false,
  className,
}: Omit<SlideMidiaProps, 'fileName' | 'mimeType' | 'wrapperClassName' | 'audible'>) {
  const optimizedSrc = urlImagemApresentacao(src, mobile, tamanho, redimensionar);
  const [srcAtual, setSrcAtual] = useState(optimizedSrc);

  useEffect(() => {
    setSrcAtual(optimizedSrc);
  }, [optimizedSrc]);

  return (
    <img
      data-orcamento-imagem=""
      src={srcAtual}
      alt={alt}
      className={cn(
        redimensionar === 'contain'
          ? 'max-h-full max-w-full object-contain'
          : 'h-full w-full object-cover',
        className,
      )}
      crossOrigin={srcAtual.startsWith('http') ? 'anonymous' : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...(priority ? { fetchpriority: 'high' as const } : {})}
      onError={() => {
        if (srcAtual !== src) setSrcAtual(src);
      }}
    />
  );
}

/** Miniatura de vídeo na grade do wizard (sem player completo). */
export function MidiaVideoThumb({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <div className={cn('relative h-full w-full bg-stone-950', className)}>
      <video
        src={src}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/55 via-black/25 to-transparent">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-stone-950 shadow-lg shadow-black/40 ring-1 ring-amber-200/40">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden />
        </div>
      </div>
    </div>
  );
}
