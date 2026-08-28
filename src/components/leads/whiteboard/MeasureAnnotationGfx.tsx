import { cn } from '@/lib/utils';
import type { WhiteboardMeasurePayload } from '@/lib/whiteboard-annotations';
import {
  measurePathD,
  midpoint,
  quadraticMidpoint,
  perpendicularOffset,
  measureZoneRect,
} from '@/lib/photo-measure-style';

interface MeasureAnnotationGfxProps {
  payload: WhiteboardMeasurePayload;
  strokeColor: string;
  strokeWidth?: number;
  selected?: boolean;
  preview?: boolean;
  markerId: string;
}

export function MeasureAnnotationGfx({
  payload,
  strokeColor,
  strokeWidth = 2.5,
  selected = false,
  preview = false,
  markerId,
}: MeasureAnnotationGfxProps) {
  const color = payload.colorHex ?? strokeColor;
  const { a, b, via } = payload;
  const pathD = measurePathD(a, b, via);
  const labelAnchor = via ? quadraticMidpoint(a, via, b) : midpoint(a, b);
  const offset = perpendicularOffset(a, b, via ? 0 : 22);
  const labelX = labelAnchor.x + offset.x;
  const labelY = labelAnchor.y + offset.y;
  const zone = payload.showZone ? measureZoneRect(a, b) : null;
  const startMarker = payload.bidirectional ? `url(#${markerId}-start)` : undefined;
  const endMarker = `url(#${markerId}-end)`;

  return (
    <g className={cn(preview && 'opacity-85 transition-opacity duration-150')}>
      {zone && (
        <rect
          x={zone.x}
          y={zone.y}
          width={zone.w}
          height={zone.h}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={0.85}
          vectorEffect="non-scaling-stroke"
          rx={2}
        />
      )}

      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + (selected ? 0.5 : 0)}
        strokeLinecap="round"
        strokeDasharray={preview ? '6 4' : undefined}
        markerStart={startMarker}
        markerEnd={endMarker}
        vectorEffect="non-scaling-stroke"
        filter={selected ? 'drop-shadow(0 0 4px rgba(0,0,0,0.25))' : undefined}
      />

      {[a, b].map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={preview ? 5 : selected ? 6 : 5}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className={preview ? 'opacity-90' : undefined}
        />
      ))}

      {via && (
        <circle
          cx={via.x}
          cy={via.y}
          r={4}
          fill="#fff"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Etiqueta renderizada no layer HTML; aqui só o conector opcional */}
      <line
        x1={labelAnchor.x}
        y1={labelAnchor.y}
        x2={labelX}
        y2={labelY}
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.35}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

interface MeasureLabelProps {
  payload: WhiteboardMeasurePayload;
  strokeColor: string;
  selected?: boolean;
  editable?: boolean;
  value?: string;
  onChange?: (label: string) => void;
  onBlur?: () => void;
}

/** Halo branco + preto: separa o número dos traços da lousa. */
const MEASURE_LABEL_BOX_SHADOW = [
  '0 0 0 2px rgba(255,255,255,0.98)',
  '0 0 0 5px rgba(0,0,0,0.55)',
  '0 3px 8px rgba(0,0,0,0.65)',
  '0 10px 22px rgba(0,0,0,0.45)',
].join(', ');

const MEASURE_LABEL_TEXT_SHADOW = [
  '0 0 3px rgba(0,0,0,1)',
  '0 1px 3px rgba(0,0,0,0.95)',
  '0 0 10px rgba(0,0,0,0.7)',
  '1px 1px 0 rgba(0,0,0,0.85)',
  '-1px -1px 0 rgba(0,0,0,0.85)',
].join(', ');

export function MeasureLabel({
  payload,
  strokeColor,
  selected = false,
  editable = false,
  value,
  onChange,
  onBlur,
}: MeasureLabelProps) {
  const color = payload.colorHex ?? strokeColor;
  const { a, b, via } = payload;
  const labelAnchor = via ? quadraticMidpoint(a, via, b) : midpoint(a, b);
  const offset = perpendicularOffset(a, b, via ? 0 : 22);
  const labelX = labelAnchor.x + offset.x;
  const labelY = labelAnchor.y + offset.y;
  const display = value ?? payload.label;

  return (
    <div
      data-whiteboard-measure-label
      className={cn(
        'absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2',
        'rounded-md border-[2.5px] px-3 py-1.5',
        'font-extrabold tabular-nums tracking-tight text-white',
        'transition-transform duration-150',
        selected && 'scale-105',
        editable ? 'cursor-text' : 'cursor-default',
      )}
      style={{
        left: labelX,
        top: labelY,
        // Placa escura opaca: não deixa traços “furarem” o número
        backgroundColor: 'rgba(18, 14, 10, 0.94)',
        borderColor: color,
        outline: '2px solid rgba(255,255,255,0.95)',
        outlineOffset: 1,
        boxShadow: MEASURE_LABEL_BOX_SHADOW,
        textShadow: MEASURE_LABEL_TEXT_SHADOW,
        fontSize: Math.max(15, Math.min(20, 14 + display.length * 0.3)),
        letterSpacing: '0.02em',
        minWidth: 44,
        textAlign: 'center',
        zIndex: 9350,
        isolation: 'isolate',
      }}
      onPointerDown={(e) => editable && e.stopPropagation()}
    >
      {/* Faixa da cor da régua — liga o número à medição sem perder contraste */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-[4px]"
        style={{ backgroundColor: color }}
      />
      {editable && selected ? (
        <input
          type="text"
          inputMode="decimal"
          className="relative z-[1] w-full min-w-[2.75rem] bg-transparent text-center font-extrabold text-white outline-none placeholder:text-white/70"
          style={{ textShadow: MEASURE_LABEL_TEXT_SHADOW }}
          value={display}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          autoFocus
        />
      ) : (
        <span className="relative z-[1]">{display}</span>
      )}
    </div>
  );
}

export function MeasureArrowMarkers({ idPrefix, color }: { idPrefix: string; color: string }) {
  return (
    <defs>
      <marker
        id={`${idPrefix}-end`}
        markerWidth="10"
        markerHeight="10"
        refX="8"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
      </marker>
      <marker
        id={`${idPrefix}-start`}
        markerWidth="10"
        markerHeight="10"
        refX="2"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M 10 0 L 0 5 L 10 10 z" fill={color} />
      </marker>
    </defs>
  );
}
