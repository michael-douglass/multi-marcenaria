import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { GARBO_APRESENTACAO_CUBO_DESTAQUES } from './garbo-apresentacao-content';

/** Mesmos tempos do cubo mágico do banner */
const COL_STAGGER_MS = 420;
const ROW_STAGGER_MS = 90;
const SPIN_MS = 3200;
const HOLD_OPEN_MS = 400;
const WAVE_PAUSE_MS = 2200;
const FLIP_MS = 800;

interface GarboProjetosFlipCubeProps {
  className?: string;
  active?: boolean;
}

interface CubeCell {
  id: string;
  row: number;
  col: number;
  imageIndex: number;
}

/**
 * Efeito de cubos na página inteira (como o banner):
 * camada transparente → onda levanta os cubinhos → viram e mostram as fotos,
 * por cima da imagem de fundo da seção.
 */
export function GarboProjetosFlipCube({ className, active = true }: GarboProjetosFlipCubeProps) {
  const items = GARBO_APRESENTACAO_CUBO_DESTAQUES;
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(6);
  const [waveKey, setWaveKey] = useState(0);
  const [waveActive, setWaveActive] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [reducedMotion, setReducedMotion] = useState(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqMobile = window.matchMedia('(max-width: 639px)');

    const sync = () => {
      setReducedMotion(mqMotion.matches);
      if (mqMobile.matches) {
        setRows(5);
        setCols(3);
      } else {
        setRows(4);
        setCols(6);
      }
    };

    sync();
    mqMotion.addEventListener('change', sync);
    mqMobile.addEventListener('change', sync);
    return () => {
      mqMotion.removeEventListener('change', sync);
      mqMobile.removeEventListener('change', sync);
    };
  }, []);

  const cells = useMemo<CubeCell[]>(() => {
    const list: CubeCell[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        list.push({
          id: `proposta-cube-${row}-${col}`,
          row,
          col,
          imageIndex: (row * cols + col) % items.length,
        });
      }
    }
    return list;
  }, [rows, cols, items.length]);

  useEffect(() => {
    if (!active || reducedMotion || cols === 0) {
      if (reducedMotion) {
        const all: Record<string, boolean> = {};
        cells.forEach((c) => {
          all[c.id] = true;
        });
        setOpenMap(all);
        setWaveActive(true);
      }
      return;
    }

    let cancelled = false;

    const runWave = () => {
      if (cancelled) return;
      clearTimers();
      setWaveActive(true);
      setWaveKey((k) => k + 1);

      const closed: Record<string, boolean> = {};
      cells.forEach((c) => {
        closed[c.id] = false;
      });
      setOpenMap(closed);

      cells.forEach((cell) => {
        const delayMs = cell.col * COL_STAGGER_MS + cell.row * ROW_STAGGER_MS;
        timersRef.current.push(
          window.setTimeout(() => {
            if (!cancelled) setOpenMap((prev) => ({ ...prev, [cell.id]: true }));
          }, delayMs + SPIN_MS * 0.28),
        );
      });

      const waveDuration =
        SPIN_MS + (cols - 1) * COL_STAGGER_MS + (rows - 1) * ROW_STAGGER_MS;

      timersRef.current.push(
        window.setTimeout(() => {
          if (cancelled) return;
          cells.forEach((cell) => {
            const reverseDelay =
              (cols - 1 - cell.col) * (COL_STAGGER_MS * 0.4) +
              cell.row * (ROW_STAGGER_MS * 0.35);
            timersRef.current.push(
              window.setTimeout(() => {
                if (!cancelled) setOpenMap((prev) => ({ ...prev, [cell.id]: false }));
              }, reverseDelay),
            );
          });
        }, waveDuration + HOLD_OPEN_MS),
      );

      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelled) setWaveActive(false);
        }, waveDuration + HOLD_OPEN_MS + FLIP_MS + 300),
      );

      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelled) runWave();
        }, waveDuration + HOLD_OPEN_MS + FLIP_MS + WAVE_PAUSE_MS),
      );
    };

    timersRef.current.push(window.setTimeout(runWave, 400));

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [active, reducedMotion, cols, rows, cells, clearTimers]);

  return (
    <div
      className={cn(
        'garbo-proposta-magic pointer-events-none absolute inset-0 z-[2]',
        className,
      )}
      aria-hidden
      style={{ perspective: '1400px', perspectiveOrigin: '50% 40%' }}
    >
      {/* Camada 100% transparente — só os cubos aparecem por cima da foto */}
      <div
        className="absolute inset-[2.5%] grid gap-[2px] sm:inset-[3.5%] sm:gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          transformStyle: 'preserve-3d',
          background: 'transparent',
        }}
      >
        {cells.map((cell) => {
          const item = items[cell.imageIndex];
          const delayMs = cell.col * COL_STAGGER_MS + cell.row * ROW_STAGGER_MS;
          const isOpen = Boolean(openMap[cell.id]);

          return (
            <div
              key={cell.id}
              className="garbo-magic-cell relative min-h-0 min-w-0"
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: 'center center',
                background: 'transparent',
              }}
            >
              {waveActive && (
                <div
                  key={`${cell.id}-${waveKey}`}
                  className={cn('absolute inset-0', !reducedMotion && 'garbo-proposta-lift')}
                  style={{
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center bottom',
                    animationDelay: reducedMotion ? undefined : `${delayMs}ms`,
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: isOpen ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      transition: reducedMotion
                        ? 'none'
                        : `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                    }}
                  >
                    {/* Face fechada — vidro dourado (como o banner) */}
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[2px]"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        border: '1px solid rgba(242,216,146,0.45)',
                        background: `
                          radial-gradient(circle at 35% 30%, rgba(255,250,244,0.22), transparent 45%),
                          linear-gradient(145deg, rgba(242,216,146,0.2), rgba(26,18,12,0.28) 55%, rgba(8,6,4,0.18))
                        `,
                        boxShadow:
                          'inset 0 0 0 1px rgba(242,216,146,0.35), 0 0 18px rgba(242,216,146,0.14)',
                        backdropFilter: 'blur(1px)',
                      }}
                    >
                      <div
                        className="absolute inset-y-0 right-0 w-[5px] origin-right sm:w-[6px]"
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(28,20,14,0.7), rgba(8,6,4,0.45))',
                          transform: 'rotateY(90deg)',
                          backfaceVisibility: 'hidden',
                        }}
                      />
                      <div
                        className="absolute inset-x-0 bottom-0 h-[5px] origin-bottom sm:h-[6px]"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(26,18,12,0.65), rgba(6,5,4,0.4))',
                          transform: 'rotateX(-90deg)',
                          backfaceVisibility: 'hidden',
                        }}
                      />
                    </div>

                    {/* Face aberta — foto da obra */}
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[2px]"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        border: '1px solid rgba(242,216,146,0.4)',
                        boxShadow:
                          'inset 0 0 0 1px rgba(242,216,146,0.28), 0 0 22px rgba(242,216,146,0.16)',
                      }}
                    >
                      <img
                        src={item.src}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
