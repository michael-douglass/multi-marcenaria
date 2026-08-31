import { cn } from '@/lib/utils';
import type { WhiteboardFurnitureModulePayload } from '@/lib/whiteboard-annotations';
import {
  furnitureFrame,
  furnitureLinesPath,
  getFurnitureModuleMeta,
} from '@/lib/furniture-modules';

interface FurnitureModuleGfxProps {
  payload: WhiteboardFurnitureModulePayload;
  strokeColor: string;
  strokeWidth?: number;
  selected?: boolean;
  preview?: boolean;
  showLabel?: boolean;
  editableLines?: boolean;
  onLineClick?: (lineIndex: number) => void;
  /** Textura de madeira nas faces (banco realista). */
  fillTextureUrl?: string;
  patternId?: string;
}

export function FurnitureModuleGfx({
  payload,
  strokeColor,
  strokeWidth = 2,
  selected = false,
  preview = false,
  showLabel = true,
  fillTextureUrl,
  patternId = 'furniture-wood',
}: FurnitureModuleGfxProps) {
  const color = payload.colorHex ?? strokeColor;
  const frame = furnitureFrame(
    payload.a,
    payload.b,
    payload.moduleType,
    payload.heightOverride,
    payload.widthOverride,
    payload.topDown === true,
    payload.flatFront === true,
  );
  const hidden = new Set(payload.hiddenLineIndices ?? []);
  const visibleLines = frame.lines
    .map((line, index) => ({ line, index }))
    .filter(({ index }) => !hidden.has(index));
  const pathD = furnitureLinesPath(visibleLines.map(({ line }) => line));
  const meta = getFurnitureModuleMeta(payload.moduleType);
  const labelAnchor = {
    x: (frame.tl.x + frame.tr.x) / 2,
    y: (frame.tl.y + frame.tr.y) / 2 - 12,
  };
  const sw = strokeWidth + (selected ? 0.6 : 0);
  const isDraft = !payload.locked;

  const facePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <g
      className={cn(preview && 'opacity-85', selected && 'drop-shadow-sm')}
      data-whiteboard-furniture={payload.moduleType}
      data-furniture-locked={payload.locked ? 'true' : 'false'}
    >
      {fillTextureUrl && (
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={Math.max(24, frame.width)}
            height={Math.max(24, frame.height)}
          >
            <image
              href={fillTextureUrl}
              width={Math.max(24, frame.width)}
              height={Math.max(24, frame.height)}
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        </defs>
      )}

      {/* Faces 3D (preenchimento suave — nitidez no traço) */}
      {frame.fillFaces.map((face, i) => (
        <path
          key={`face-${i}`}
          d={facePath(face)}
          fill={fillTextureUrl ? `url(#${patternId})` : color}
          fillOpacity={
            fillTextureUrl
              ? i === 2
                ? 0.92
                : i === 0
                  ? 0.78
                  : 0.7
              : preview
                ? 0.04
                : i === 2
                  ? 0.06
                  : i === 0
                    ? 0.12
                    : 0.09
          }
          stroke="none"
          style={{ pointerEvents: 'none' }}
        />
      ))}

      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={preview ? '5 4' : undefined}
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: 'none' }}
      />

      {/* Âncoras topo/base (colocação cima→baixo) */}
      {[payload.a, payload.b].map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={preview ? 4 : selected ? 5.5 : 4}
          fill={color}
          stroke="#fff"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {showLabel && (
        <text
          x={labelAnchor.x}
          y={labelAnchor.y}
          textAnchor="middle"
          dominantBaseline="auto"
          fill={color}
          className="pointer-events-none select-none"
          style={{
            fontSize: Math.max(10, Math.min(14, frame.width * 0.09)),
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontWeight: 700,
            opacity: preview ? 0.75 : 0.92,
            paintOrder: 'stroke',
            stroke: 'rgba(0,0,0,0.35)',
            strokeWidth: 2.5,
          }}
        >
          {meta.label}
          {isDraft && selected ? ' · rascunho' : ''}
        </text>
      )}
    </g>
  );
}

/** Miniatura SVG para o seletor da toolbar. */
export function FurnitureModuleThumb({
  moduleType,
  className,
  flatFront = false,
}: {
  moduleType: WhiteboardFurnitureModulePayload['moduleType'];
  className?: string;
  /** Banco retos: só o frontal. */
  flatFront?: boolean;
}) {
  const a = { x: 24, y: 6 };
  const b = { x: 24, y: 52 };
  const frame = furnitureFrame(a, b, moduleType, undefined, undefined, true, flatFront);
  const pathD = furnitureLinesPath(frame.lines);
  const facePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg viewBox="0 0 48 56" className={cn('h-10 w-9', className)} aria-hidden>
      {frame.fillFaces.slice(0, flatFront ? 1 : 2).map((face, i) => (
        <path
          key={i}
          d={facePath(face)}
          fill="currentColor"
          fillOpacity={flatFront ? 0.08 : i === 0 ? 0.14 : 0.08}
        />
      ))}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
