import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LeadAIRenderEditPonto,
  MAX_EDIT_PONTOS,
  editRegionDiameterPx,
  findPontoAtPosition,
  loadImageForMarkers,
  nextPontoId,
  normalizedToContainerPosition,
  pointerToNormalizedPoint,
} from '@/lib/lead-ai-render-edit-markers';
import { cn } from '@/lib/utils';
import { MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeadAIRenderPointPickerProps {
  imageUrl: string;
  points: LeadAIRenderEditPonto[];
  onPointsChange: (points: LeadAIRenderEditPonto[]) => void;
  className?: string;
}

export function LeadAIRenderPointPicker({
  imageUrl,
  points,
  onPointsChange,
  className,
}: LeadAIRenderPointPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [loadError, setLoadError] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    loadImageForMarkers(imageUrl)
      .then((img) => {
        if (cancelled) return;
        setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const imageEl = imageRef.current;
      if (!imageEl || !imageSize.w) return;

      const rect = imageEl.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      const hit = findPontoAtPosition(
        points,
        localX,
        localY,
        rect,
        imageSize.w,
        imageSize.h,
      );

      if (hit) {
        onPointsChange(points.filter((p) => p.id !== hit.id));
        return;
      }

      if (points.length >= MAX_EDIT_PONTOS) return;

      const normalized = pointerToNormalizedPoint(
        e.clientX,
        e.clientY,
        rect,
        imageSize.w,
        imageSize.h,
      );
      if (!normalized) return;

      onPointsChange([
        ...points,
        { id: nextPontoId(points), x: normalized.x, y: normalized.y },
      ]);
    },
    [imageSize.h, imageSize.w, onPointsChange, points],
  );

  const imageRect = imageRef.current?.getBoundingClientRect();
  const containerRect = imageRect ?? containerRef.current?.getBoundingClientRect();
  const regionDiameterPx =
    containerRect && imageSize.w
      ? editRegionDiameterPx(containerRect, imageSize.w, imageSize.h)
      : 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && points.length > 0) {
            onPointsChange(points.slice(0, -1));
          }
        }}
        className={cn(
          'relative aspect-[4/3] w-full overflow-hidden rounded-xl',
          'border border-gold-border-subtle/30 bg-mahogany-base cursor-crosshair',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
        )}
        aria-label="Clique no objeto que deseja alterar para selecionar a região de edição"
      >
        {loadError ? (
          <div className="flex h-full items-center justify-center text-sm text-cream-muted">
            Não foi possível carregar a imagem
          </div>
        ) : (
          <>
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Render para editar"
              className="h-full w-full select-none object-contain pointer-events-none"
              draggable={false}
            />
            {containerRect &&
              points.map((point) => {
                const pos = normalizedToContainerPosition(
                  point.x,
                  point.y,
                  containerRect,
                  imageSize.w,
                  imageSize.h,
                );
                if (!pos) return null;
                return (
                  <span key={point.id} className="contents">
                    {regionDiameterPx > 0 && (
                      <span
                        className="pointer-events-none absolute z-[5] rounded-full border-2 border-dashed border-gold/70 bg-gold/12 shadow-[inset_0_0_12px_rgba(201,160,123,0.15)]"
                        style={{
                          left: pos.left,
                          top: pos.top,
                          width: regionDiameterPx,
                          height: regionDiameterPx,
                          transform: 'translate(-50%, -50%)',
                        }}
                        aria-hidden
                      />
                    )}
                    <span
                      className="pointer-events-none absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-in zoom-in-95 fade-in duration-200 items-center justify-center rounded-full border-2 border-gold bg-mahogany-panel text-xs font-bold text-gold shadow-lg shadow-black/50 ring-2 ring-gold/25"
                      style={{ left: pos.left, top: pos.top }}
                    >
                      {point.id}
                    </span>
                  </span>
                );
              })}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-cream-muted">
          <MapPin className="mr-1 inline h-3 w-3 text-gold" />
          Clique exatamente sobre o objeto (ex.: geladeira) · círculo tracejado = área que a IA pode alterar
        </p>
        {points.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onPointsChange([])}
            className="h-7 text-xs text-cream-muted hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Limpar pontos
          </Button>
        )}
      </div>

      {points.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {points.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-gold"
            >
              Ponto {p.id} — região selecionada
            </li>
          ))}
        </ul>
      )}

      {/* força recalcular posições dos pins ao redimensionar */}
      <span className="sr-only" aria-hidden>{layoutTick}</span>
    </div>
  );
}
