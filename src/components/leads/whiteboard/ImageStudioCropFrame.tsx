import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';
import {
  clampStudioCrop,
  studioHostPointToUv,
  studioUvToHostPercent,
  type ImageStudioCrop,
  type ImageStudioEdits,
  type StudioPreviewFit,
} from '@/lib/lead-image-studio';

type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface ImageStudioCropFrameProps {
  crop: ImageStudioCrop;
  fit: StudioPreviewFit;
  edits: Pick<ImageStudioEdits, 'rotation' | 'flipH' | 'flipV'>;
  host: HTMLElement | null;
  disabled?: boolean;
  pixelAspect?: number | null;
  imageWidth: number;
  imageHeight: number;
  onChange: (crop: ImageStudioCrop) => void;
}

interface DragMemory {
  handle: CropHandle;
  startX: number;
  startY: number;
  orig: ImageStudioCrop;
}

const HANDLE_CLASS =
  'absolute z-[2] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1a100c] bg-[#f2d892] shadow-[0_0_0_3px_rgba(242,216,146,0.28),0_2px_8px_rgba(0,0,0,0.45)]';

function cursorFor(handle: CropHandle): string {
  if (handle === 'move') return 'move';
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  return 'nesw-resize';
}

function applyHandle(
  handle: CropHandle,
  orig: ImageStudioCrop,
  nx: number,
  ny: number,
  pixelAspect: number | null | undefined,
  imageWidth: number,
  imageHeight: number,
): ImageStudioCrop {
  let next = { ...orig };
  if (handle === 'move') {
    next = { ...orig, x: orig.x + nx, y: orig.y + ny };
    return clampStudioCrop(next);
  }

  let left = orig.x;
  let top = orig.y;
  let right = orig.x + orig.w;
  let bottom = orig.y + orig.h;

  if (handle.includes('w')) left = orig.x + nx;
  if (handle.includes('e')) right = orig.x + orig.w + nx;
  if (handle.includes('n')) top = orig.y + ny;
  if (handle.includes('s')) bottom = orig.y + orig.h + ny;

  if (right - left < 0.08) {
    if (handle.includes('w')) left = right - 0.08;
    else right = left + 0.08;
  }
  if (bottom - top < 0.08) {
    if (handle.includes('n')) top = bottom - 0.08;
    else bottom = top + 0.08;
  }

  next = clampStudioCrop({
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    w: Math.abs(right - left),
    h: Math.abs(bottom - top),
  });

  if (pixelAspect && pixelAspect > 0) {
    const uvAspect = pixelAspect * (Math.max(1, imageHeight) / Math.max(1, imageWidth));
    let w = next.w;
    let h = w / Math.max(uvAspect, 1e-4);
    if (handle === 'n' || handle === 's') {
      h = next.h;
      w = h * uvAspect;
    }
    if (w > 1) {
      w = 1;
      h = w / uvAspect;
    }
    if (h > 1) {
      h = 1;
      w = h * uvAspect;
    }
    let x = next.x;
    let y = next.y;
    if (handle.includes('e')) x = orig.x;
    else if (handle.includes('w')) x = orig.x + orig.w - w;
    else x = orig.x + (orig.w - w) / 2;
    if (handle.includes('s')) y = orig.y;
    else if (handle.includes('n')) y = orig.y + orig.h - h;
    else y = orig.y + (orig.h - h) / 2;
    next = clampStudioCrop({ x, y, w, h });
  }

  return next;
}

/**
 * Moldura de recorte estilo ateliê — véu escuro fora, cantos em L dourado.
 */
export function ImageStudioCropFrame({
  crop,
  fit,
  edits,
  host,
  disabled = false,
  pixelAspect = null,
  imageWidth,
  imageHeight,
  onChange,
}: ImageStudioCropFrameProps) {
  const dragRef = useRef<DragMemory | null>(null);
  const cropRef = useRef(crop);
  cropRef.current = crop;

  const nw = studioUvToHostPercent({ u: crop.x, v: 1 - crop.y }, fit, edits);
  const se = studioUvToHostPercent({ u: crop.x + crop.w, v: 1 - (crop.y + crop.h) }, fit, edits);
  const left = Math.min(nw.left, se.left);
  const top = Math.min(nw.top, se.top);
  const width = Math.abs(se.left - nw.left);
  const height = Math.abs(se.top - nw.top);

  const pointToImage = (clientX: number, clientY: number) => {
    if (!host) return null;
    const seed = studioHostPointToUv(clientX, clientY, host, fit, edits);
    if (!seed) return null;
    return { x: seed.u, y: 1 - seed.v };
  };

  const begin = (handle: CropHandle, event: ReactPointerEvent<HTMLElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointToImage(event.clientX, event.clientY);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      handle,
      startX: point.x,
      startY: point.y,
      orig: { ...cropRef.current },
    };
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointToImage(event.clientX, event.clientY);
    if (!point) return;
    onChange(
      applyHandle(
        drag.handle,
        drag.orig,
        point.x - drag.startX,
        point.y - drag.startY,
        pixelAspect,
        imageWidth,
        imageHeight,
      ),
    );
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handles: Array<{ id: CropHandle; left: string; top: string }> = [
    { id: 'nw', left: '0%', top: '0%' },
    { id: 'n', left: '50%', top: '0%' },
    { id: 'ne', left: '100%', top: '0%' },
    { id: 'e', left: '100%', top: '50%' },
    { id: 'se', left: '100%', top: '100%' },
    { id: 's', left: '50%', top: '100%' },
    { id: 'sw', left: '0%', top: '100%' },
    { id: 'w', left: '0%', top: '50%' },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-[8]">
      <div
        className="absolute"
        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
      >
        <span className="pointer-events-none absolute -left-px -top-px h-7 w-7 border-l-2 border-t-2 border-[#f2d892]" />
        <span className="pointer-events-none absolute -right-px -top-px h-7 w-7 border-r-2 border-t-2 border-[#f2d892]" />
        <span className="pointer-events-none absolute -bottom-px -left-px h-7 w-7 border-b-2 border-l-2 border-[#f2d892]" />
        <span className="pointer-events-none absolute -bottom-px -right-px h-7 w-7 border-b-2 border-r-2 border-[#f2d892]" />
        <span className="pointer-events-none absolute inset-0 border border-[#f2d892]/55 shadow-[0_0_0_9999px_rgba(12,8,6,0.58)]" />

        <div
          role="presentation"
          className="pointer-events-auto absolute inset-[10px] cursor-move touch-none"
          onPointerDown={(event) => begin('move', event)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />

        {handles.map((handle) => (
          <button
            key={handle.id}
            type="button"
            disabled={disabled}
            aria-label={`Ajustar recorte ${handle.id}`}
            className={cn(HANDLE_CLASS, 'pointer-events-auto touch-none')}
            style={{ left: handle.left, top: handle.top, cursor: cursorFor(handle.id) }}
            onPointerDown={(event) => begin(handle.id, event)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        ))}
      </div>
    </div>
  );
}
