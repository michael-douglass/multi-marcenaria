import { useEffect, useMemo, useState } from 'react';

const SLIDE_INTERVAL_MS = 5500;
const SLIDE_DURATION_MS = 1100;

const trackCss = `
  .prestador-banner-track {
    display: flex;
    height: 100%;
    will-change: transform;
    transition: transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.77, 0, 0.175, 1);
  }
  .prestador-banner-slide {
    flex: 0 0 100%;
    min-width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  @media (prefers-reduced-motion: reduce) {
    .prestador-banner-track {
      transition-duration: 0.01ms;
    }
  }
`;

interface PrestadorBannerSlideshowProps {
  slides: string[];
  className?: string;
  style?: React.CSSProperties;
}

export function PrestadorBannerSlideshow({ slides, className = '', style }: PrestadorBannerSlideshowProps) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  const safeIndex = count > 0 ? index % count : 0;

  useEffect(() => {
    setIndex(0);
  }, [slides.join('|')]);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count, slides.join('|')]);

  const dots = useMemo(() => slides.map((_, i) => i), [slides]);

  if (count === 0) return null;

  return (
    <>
      <style>{trackCss}</style>
      <div className={`absolute inset-0 overflow-hidden ${className}`} style={style}>
        <div
          className="prestador-banner-track"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
          aria-hidden
        >
          {slides.map((url, i) => (
            <div
              key={`banner-slide-${i}`}
              className="prestador-banner-slide"
              style={{ backgroundImage: `url(${JSON.stringify(url)})` }}
              role="img"
              aria-label={`Banner ${i + 1} de ${count}`}
            />
          ))}
        </div>

        {count > 1 && (
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-10 pointer-events-none">
            {dots.map((i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-500"
                style={{
                  width: i === safeIndex ? 20 : 6,
                  height: 6,
                  background: i === safeIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)',
                  boxShadow: i === safeIndex ? '0 0 12px rgba(255,255,255,0.35)' : undefined,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
