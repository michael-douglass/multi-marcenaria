import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getRealisticFurnitureDataUrl } from '@/lib/lead-ai-ambiente-realistic-mesh';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';

interface RealisticFurnitureObjectProps {
  moduleType: FurnitureModuleType;
  selected?: boolean;
  className?: string;
}

/**
 * Foto da peça 3D (um WebGL compartilhado). Vários móveis na lousa não abrem palcos extras.
 */
export function RealisticFurnitureObject({
  moduleType,
  selected = false,
  className,
}: RealisticFurnitureObjectProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getRealisticFurnitureDataUrl(moduleType).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleType]);

  if (!src) {
    return (
      <div
        className={cn('h-full w-full rounded-md bg-[#2a1812]/80', className)}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn(
        'pointer-events-none h-full w-full object-contain',
        selected && 'drop-shadow-[0_8px_18px_rgba(242,216,146,0.28)]',
        className,
      )}
    />
  );
}
