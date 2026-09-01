import type { PointerEvent as ReactPointerEvent } from 'react';
import { RotateCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AMBIENTE_INK,
  inkFillFromStroke,
  shapeCenter,
  trianglePoints,
  unrotatedBounds,
} from '@/lib/lead-ai-ambiente-draw';
import type { AmbienteDrawTool, AmbienteGeoShape } from '@/lib/lead-ai-ambiente-types';

interface AmbienteDrawLayerProps {
  shapes: AmbienteGeoShape[];
  preview: AmbienteGeoShape | null;
  selectedId: string | null;
  tool: AmbienteDrawTool;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onMovePointerDown: (id: string, x: number, y: number, event: ReactPointerEvent) => void;
  onResizePointerDown: (
    id: string,
    x: number,
    y: number,
    size: { width: number; height: number },
    event: ReactPointerEvent,
  ) => void;
  onRotatePointerDown: (
    id: string,
    cx: number,
    cy: number,
    rotation: number,
    event: ReactPointerEvent,
  ) => void;
  onRemove: (id: string) => void;
}

function pct(value: number): string {
  return `${value * 100}%`;
}

function shapeRotateTransform(shape: AmbienteGeoShape): string | undefined {
  const rotation = shape.rotation ?? 0;
  if (!rotation) return undefined;
  const center = shapeCenter(shape);
  return `rotate(${rotation} ${center.x * 100} ${center.y * 100})`;
}

function ShapePath({
  shape,
  dashed,
  hit = false,
}: {
  shape: AmbienteGeoShape;
  dashed?: boolean;
  hit?: boolean;
}) {
  const stroke = hit ? 'transparent' : shape.stroke || AMBIENTE_INK;
  const fill = hit ? 'transparent' : shape.fill ? inkFillFromStroke(stroke) : 'none';
  const dash = dashed && !hit ? '6 5' : undefined;
  const strokeWidth = hit ? 14 : 2.4;

  if (shape.kind === 'line') {
    return (
      <line
        x1={pct(shape.x)}
        y1={pct(shape.y)}
        x2={pct(shape.x2 ?? shape.x)}
        y2={pct(shape.y2 ?? shape.y)}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dash}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (shape.kind === 'pencil') {
    const points = shape.points ?? [];
    if (points.length < 2) return null;
    const d = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * 100} ${point.y * 100}`)
      .join(' ');
    return (
      <path
        d={d}
        stroke={stroke}
        strokeWidth={hit ? 14 : 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (shape.kind === 'ellipse') {
    return (
      <ellipse
        cx={pct(shape.x + shape.width / 2)}
        cy={pct(shape.y + shape.height / 2)}
        rx={pct(Math.max(shape.width / 2, 0.001))}
        ry={pct(Math.max(shape.height / 2, 0.001))}
        stroke={stroke}
        strokeWidth={hit ? 14 : 2.2}
        strokeDasharray={dash}
        fill={fill}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (shape.kind === 'triangle') {
    const points = trianglePoints(shape)
      .map((point) => `${point.x * 100},${point.y * 100}`)
      .join(' ');
    return (
      <polygon
        points={points}
        stroke={stroke}
        strokeWidth={hit ? 14 : 2.2}
        strokeLinejoin="round"
        strokeDasharray={dash}
        fill={fill}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  return (
    <rect
      x={pct(shape.x)}
      y={pct(shape.y)}
      width={pct(shape.width)}
      height={pct(shape.height)}
      rx="1"
      stroke={stroke}
      strokeWidth={hit ? 14 : 2.2}
      strokeDasharray={dash}
      fill={fill}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function AmbienteDrawLayer({
  shapes,
  preview,
  selectedId,
  tool,
  disabled = false,
  onSelect,
  onMovePointerDown,
  onResizePointerDown,
  onRotatePointerDown,
  onRemove,
}: AmbienteDrawLayerProps) {
  const canSelect = tool === 'select' && !disabled;
  const selected = shapes.find((shape) => shape.id === selectedId) ?? null;
  const selectedBox = selected ? unrotatedBounds(selected) : null;
  const selectedCenter = selected ? shapeCenter(selected) : null;
  const selectedRotation = selected?.rotation ?? 0;
  const canResize = selected && selected.kind !== 'line' && selected.kind !== 'pencil';

  return (
    <div className="pointer-events-none absolute inset-0 z-[18]">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {shapes.map((shape) => (
          <g
            key={shape.id}
            transform={shapeRotateTransform(shape)}
            className={cn(canSelect && 'pointer-events-auto cursor-grab')}
            onPointerDown={(event) => {
              if (!canSelect) return;
              event.stopPropagation();
              onSelect(shape.id);
              onMovePointerDown(shape.id, shape.x, shape.y, event);
            }}
          >
            <ShapePath shape={shape} hit />
            <ShapePath shape={shape} />
            {selectedId === shape.id && (
              <ShapePath shape={{ ...shape, stroke: '#fff6ea', fill: false }} dashed />
            )}
          </g>
        ))}
        {preview && (
          <g className="pointer-events-none" transform={shapeRotateTransform(preview)}>
            <ShapePath shape={preview} dashed />
          </g>
        )}
      </svg>

      {canSelect && selected && selectedBox && selectedCenter && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: pct(selectedBox.x),
            top: pct(selectedBox.y),
            width: pct(Math.max(selectedBox.width, 0.02)),
            height: pct(Math.max(selectedBox.height, 0.02)),
            transform: selectedRotation ? `rotate(${selectedRotation}deg)` : undefined,
            transformOrigin: 'center center',
          }}
        >
          <span
            className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-full bg-[#f2d892]/70"
            aria-hidden
          />
          <button
            type="button"
            aria-label="Girar desenho"
            title="Arraste para girar o desenho"
            className="pointer-events-auto absolute left-1/2 -top-8 z-20 flex h-7 w-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-[#f2d892]/60 bg-[#1c100c] text-[#f2d892] shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-[#3a2218] active:cursor-grabbing"
            onPointerDown={(event) => {
              event.stopPropagation();
              onRotatePointerDown(selected.id, selectedCenter.x, selectedCenter.y, selected.rotation ?? 0, event);
            }}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Apagar forma"
            className="pointer-events-auto absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#f2d892]/60 bg-[#1c100c] text-[#f2d892] shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-[#3a2218]"
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(selected.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          {canResize && (
            <button
              type="button"
              aria-label="Redimensionar forma"
              className="pointer-events-auto absolute -bottom-1.5 -right-1.5 z-10 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-background bg-gold shadow ring-2 ring-gold/35"
              onPointerDown={(event) => {
                event.stopPropagation();
                onResizePointerDown(selected.id, selected.x, selected.y, {
                  width: selected.width,
                  height: selected.height,
                }, event);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
