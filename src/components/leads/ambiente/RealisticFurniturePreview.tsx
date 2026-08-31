import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getFurnitureModuleMeta } from '@/lib/furniture-modules';
import { getRealisticFurnitureDataUrl } from '@/lib/lead-ai-ambiente-realistic-mesh';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';

interface RealisticFurniturePreviewProps {
  moduleType: FurnitureModuleType;
  className?: string;
}

/** Prévia do catálogo — a mesma foto 3D da lousa, sem abrir outro WebGL. */
export function RealisticFurniturePreview({ moduleType, className }: RealisticFurniturePreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const meta = getFurnitureModuleMeta(moduleType);

  useEffect(() => {
    let cancelled = false;
    void getRealisticFurnitureDataUrl(moduleType).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleType]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[rgba(240,210,140,0.28)]',
        'bg-[radial-gradient(80%_70%_at_20%_0%,rgba(242,216,146,0.16),transparent_55%),#1a100c]',
        className,
      )}
    >
      <div className="flex h-[5.5rem] w-full items-center justify-center">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <div className="h-8 w-16 animate-pulse rounded-md bg-[#f2d892]/15" />
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#120c0a] to-transparent px-2.5 pb-1.5 pt-6">
        <p
          className="text-[10px] uppercase tracking-[0.18em] text-[#f2d892]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {meta.label} · tamanho na foto
        </p>
      </div>
    </div>
  );
}
