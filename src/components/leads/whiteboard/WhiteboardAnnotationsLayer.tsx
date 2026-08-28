import { useRef, useEffect, useCallback, useState } from 'react';
import { GripHorizontal, Check, RotateCcw, RotateCw, Minus, Plus, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  type DecodedWhiteboardAnnotation,
  type WhiteboardAnnotationPayload,
  type WhiteboardTextPayload,
  type WhiteboardMeasurePayload,
  type WhiteboardFurnitureModulePayload,
  type WhiteboardPoint,
  type FurnitureModuleType,
  polylineToPath,
  lineToPath,
  rectCorners,
  annotationBounds,
  WHITEBOARD_TEXT_MIN_W,
  WHITEBOARD_TEXT_MIN_H,
  WHITEBOARD_TEXT_MAX_W,
  WHITEBOARD_TEXT_MAX_H,
} from '@/lib/whiteboard-annotations';
import {
  MeasureAnnotationGfx,
  MeasureArrowMarkers,
  MeasureLabel,
} from '@/components/leads/whiteboard/MeasureAnnotationGfx';
import { FurnitureModuleGfx } from '@/components/leads/whiteboard/FurnitureModuleGfx';
import { formatMeasureValue, measureDistance } from '@/lib/photo-measure-style';
import {
  furnitureFrame,
  furnitureRotationDeg,
  FURNITURE_MIN_HEIGHT,
  FURNITURE_MIN_WIDTH,
  getFamilyForModuleType,
  getFurnitureVariants,
  resolveFurnitureHeight,
  rotateFurniturePayload,
  scaleFurniturePayload,
  scaleFurnitureWidth,
} from '@/lib/furniture-modules';

type TextResizeCorner = 'se' | 'e' | 's';
type FurnitureEditHandle = 'a' | 'b' | 'height' | 'tr' | 'tl' | 'width_left';

type WhiteboardTool =
  | 'select'
  | 'pencil'
  | 'eraser'
  | 'pan'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'points'
  | 'measure'
  | 'measure_arc'
  | 'furniture';

interface WhiteboardAnnotationsLayerProps {
  annotations: DecodedWhiteboardAnnotation[];
  tool: WhiteboardTool;
  color: string;
  strokeWidth: number;
  textFontFamily: string;
  textColorHex: string;
  disabled: boolean;
  /** Lousa bloqueada: sem mover/apagar formas; texto ainda editável e redimensionável. */
  contentLocked?: boolean;
  worldWidth: number;
  worldHeight: number;
  selectedAnnotationId: string | null;
  /** Quando definido, tenta focar a textarea deste texto. */
  autoFocusTextId?: string | null;
  /** Chamado quando o auto-focus já foi aplicado (para limpar estado no pai). */
  onAutoFocusDone?: () => void;
  /** Quando o id temporário vira id real após salvar, migra o texto digitado. */
  remapTextPayloadIds?: { from: string; to: string } | null;
  onRemapTextPayloadIdsDone?: () => void;
  onTextPayloadLiveChange?: (id: string, payload: WhiteboardTextPayload) => void;
  pendingPolyline: WhiteboardPoint[] | null;
  polylinePreview: WhiteboardPoint | null;
  shapePreview: WhiteboardAnnotationPayload | null;
  measurePreview?: WhiteboardMeasurePayload | null;
  furniturePreview?: WhiteboardFurnitureModulePayload | null;
  onSelectAnnotation: (id: string | null) => void;
  onCommitAnnotation: (id: string, payload?: WhiteboardAnnotationPayload) => void | Promise<boolean>;
  onDeleteAnnotation: (id: string) => void;
  screenToWorld: (clientX: number, clientY: number) => WhiteboardPoint;
}

export function WhiteboardAnnotationsLayer({
  annotations,
  tool,
  color,
  strokeWidth,
  textFontFamily,
  textColorHex,
  disabled,
  contentLocked = false,
  worldWidth,
  worldHeight,
  selectedAnnotationId,
  autoFocusTextId = null,
  onAutoFocusDone,
  remapTextPayloadIds = null,
  onRemapTextPayloadIdsDone,
  onTextPayloadLiveChange,
  pendingPolyline,
  polylinePreview,
  shapePreview,
  measurePreview = null,
  furniturePreview = null,
  onSelectAnnotation,
  onCommitAnnotation,
  onDeleteAnnotation,
  screenToWorld,
}: WhiteboardAnnotationsLayerProps) {
  const isMobile = useIsMobile();
  const allowsShapeInteraction = tool === 'select' || tool === 'eraser';
  const [livePayloads, setLivePayloads] = useState<Record<string, WhiteboardAnnotationPayload>>({});
  const livePayloadsRef = useRef(livePayloads);
  const [isDragging, setIsDragging] = useState(false);
  const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const textPointerPendingRef = useRef<{
    ann: DecodedWhiteboardAnnotation;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const screenToWorldRef = useRef(screenToWorld);
  const dragRef = useRef<{
    id: string;
    kind: 'move' | 'rotate' | 'resize' | 'adjust_via' | 'furniture_edit' | 'furniture_rotate';
    startWorld: WhiteboardPoint;
    origPayload: WhiteboardAnnotationPayload;
    startAngleDeg?: number;
    origRotation?: number;
    resizeCorner?: TextResizeCorner;
    furnitureHandle?: FurnitureEditHandle;
  } | null>(null);

  const clampTextSize = (w: number, h: number) => ({
    w: Math.min(WHITEBOARD_TEXT_MAX_W, Math.max(WHITEBOARD_TEXT_MIN_W, w)),
    h: Math.min(WHITEBOARD_TEXT_MAX_H, Math.max(WHITEBOARD_TEXT_MIN_H, h)),
  });

  const payloadFor = (ann: DecodedWhiteboardAnnotation) => livePayloads[ann.id] ?? ann.payload;

  /** Lê o texto direto da textarea — evita perder o que foi digitado se o estado React atrasar. */
  const resolveTextPayload = useCallback((ann: DecodedWhiteboardAnnotation): WhiteboardTextPayload | null => {
    if (ann.payload.kind !== 'text') return null;
    const live = livePayloadsRef.current[ann.id];
    const merged: WhiteboardTextPayload = live?.kind === 'text' ? live : ann.payload;
    const textarea = textAreaRefs.current[ann.id];
    const text = textarea?.value ?? merged.text;
    return text === merged.text ? merged : { ...merged, text };
  }, []);

  const syncTextPayload = useCallback(
    (ann: DecodedWhiteboardAnnotation, payload: WhiteboardTextPayload) => {
      setLivePayloads((prev) => ({ ...prev, [ann.id]: payload }));
      onTextPayloadLiveChange?.(ann.id, payload);
    },
    [onTextPayloadLiveChange],
  );

  const commitTextAnnotation = useCallback(
    async (ann: DecodedWhiteboardAnnotation, notify = false) => {
      const payload = resolveTextPayload(ann);
      if (!payload) return false;
      syncTextPayload(ann, payload);
      const saved = await onCommitAnnotation(ann.id, payload);
      if (notify) {
        if (saved) {
          toast.success(
            ann.id.startsWith('tmp-') ? 'Texto registrado — sincronizando…' : 'Texto salvo na lousa',
          );
        }
      }
      return saved ?? false;
    },
    [resolveTextPayload, syncTextPayload, onCommitAnnotation],
  );

  useEffect(() => {
    livePayloadsRef.current = livePayloads;
  }, [livePayloads]);

  useEffect(() => {
    const ids = new Set(annotations.map((a) => a.id));
    setLivePayloads((prev) => {
      let changed = false;
      const next: Record<string, WhiteboardAnnotationPayload> = {};
      for (const [id, payload] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = payload;
        else changed = true;
      }
      return changed ? next : prev;
    });
    livePayloadsRef.current = Object.fromEntries(
      Object.entries(livePayloadsRef.current).filter(([id]) => ids.has(id)),
    );
  }, [annotations]);

  useEffect(() => {
    screenToWorldRef.current = screenToWorld;
  }, [screenToWorld]);

  const canMoveAnnotation = useCallback(
    (ann: DecodedWhiteboardAnnotation) => {
      if (disabled) return false;
      if (ann.id.startsWith('tmp-')) return false;
      if (ann.payload.kind === 'text' && contentLocked) return true;
      return tool === 'select' && !contentLocked;
    },
    [disabled, contentLocked, tool],
  );

  const activateTextMove = useCallback(
    (
      ann: DecodedWhiteboardAnnotation,
      clientX: number,
      clientY: number,
      pointerId: number,
      captureTarget?: HTMLElement | null,
    ) => {
      if (!canMoveAnnotation(ann)) return;
      textAreaRefs.current[ann.id]?.blur();
      const world = screenToWorldRef.current(clientX, clientY);
      const stored = livePayloadsRef.current[ann.id];
      const orig = stored ?? ann.payload;
      dragRef.current = {
        id: ann.id,
        kind: 'move',
        startWorld: world,
        origPayload: JSON.parse(JSON.stringify(orig)) as WhiteboardAnnotationPayload,
      };
      setIsDragging(true);
      textPointerPendingRef.current = null;
      if (captureTarget) {
        try {
          captureTarget.setPointerCapture(pointerId);
        } catch {
          /* no-op */
        }
      }
    },
    [canMoveAnnotation],
  );

  const startAnnotationMove = (e: React.PointerEvent, ann: DecodedWhiteboardAnnotation) => {
    if (!canMoveAnnotation(ann)) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectAnnotation(ann.id);
    activateTextMove(ann, e.clientX, e.clientY, e.pointerId, e.currentTarget as HTMLElement);
  };

  const handleTextPointerDown = (e: React.PointerEvent, ann: DecodedWhiteboardAnnotation) => {
    if (!canMoveAnnotation(ann) || e.button !== 0) return;
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    textPointerPendingRef.current = {
      ann,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  useEffect(() => {
    if (!autoFocusTextId) return;
    if (disabled) return;
    const el = textAreaRefs.current[autoFocusTextId];
    if (!el) return;
    const canEdit = contentLocked || tool === 'select';
    if (!canEdit) return;
    requestAnimationFrame(() => {
      try {
        el.focus({ preventScroll: true });
        el.setSelectionRange(el.value.length, el.value.length);
      } catch {
        /* no-op */
      }
      onAutoFocusDone?.();
    });
  }, [autoFocusTextId, disabled, contentLocked, tool, onAutoFocusDone]);

  useEffect(() => {
    if (!remapTextPayloadIds) return;
    const { from, to } = remapTextPayloadIds;
    setLivePayloads((prev) => {
      const live = prev[from];
      if (!live) return prev;
      const { [from]: _removed, ...rest } = prev;
      return { ...rest, [to]: live };
    });
    onRemapTextPayloadIdsDone?.();
  }, [remapTextPayloadIds, onRemapTextPayloadIdsDone]);

  const handlePointerDown = (e: React.PointerEvent, ann: DecodedWhiteboardAnnotation) => {
    if (disabled) return;
    // Com ferramentas de desenho ativas, deixa o clique passar para a lousa (ex.: linha dentro de um retângulo).
    if (!allowsShapeInteraction) return;

    e.stopPropagation();

    if (tool === 'eraser' && !contentLocked) {
      const live = payloadFor(ann);
      // Rascunho de móvel: borracha apaga o traço mais perto (não o módulo inteiro).
      if (live.kind === 'furniture_module' && !live.locked) {
        const world = screenToWorld(e.clientX, e.clientY);
        const frame = furnitureFrame(
          live.a,
          live.b,
          live.moduleType,
          live.heightOverride,
          live.widthOverride,
          live.topDown === true,
        );
        const hidden = new Set(live.hiddenLineIndices ?? []);
        let bestIdx: number | null = null;
        let bestDist = 18;
        frame.lines.forEach((line, idx) => {
          if (hidden.has(idx)) return;
          const [p0, p1] = line;
          const dx = p1.x - p0.x;
          const dy = p1.y - p0.y;
          const len2 = dx * dx + dy * dy || 1;
          let t = ((world.x - p0.x) * dx + (world.y - p0.y) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
          const px = p0.x + t * dx;
          const py = p0.y + t * dy;
          const dist = Math.hypot(world.x - px, world.y - py);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
          }
        });
        if (bestIdx != null) {
          hideFurnitureLine(ann, bestIdx);
          return;
        }
      }
      void onDeleteAnnotation(ann.id);
      return;
    }

    if (ann.payload.kind === 'text') {
      onSelectAnnotation(ann.id);
      if (canMoveAnnotation(ann) && e.target === e.currentTarget) {
        startAnnotationMove(e, ann);
      }
      return;
    }

    if (ann.payload.kind === 'measure' || ann.payload.kind === 'furniture_module') {
      onSelectAnnotation(ann.id);
      if (tool !== 'select' || contentLocked) return;
      const world = screenToWorld(e.clientX, e.clientY);
      const orig = payloadFor(ann);
      dragRef.current = {
        id: ann.id,
        kind: 'move',
        startWorld: world,
        origPayload: JSON.parse(JSON.stringify(orig)) as WhiteboardAnnotationPayload,
      };
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (tool !== 'select' || contentLocked) return;

    onSelectAnnotation(ann.id);

    const world = screenToWorld(e.clientX, e.clientY);
    const orig = payloadFor(ann);
    dragRef.current = {
      id: ann.id,
      kind: 'move',
      startWorld: world,
      origPayload: JSON.parse(JSON.stringify(orig)) as WhiteboardAnnotationPayload,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const applyMove = useCallback(
    (world: WhiteboardPoint, orig: WhiteboardAnnotationPayload): WhiteboardAnnotationPayload => {
      const dx = world.x - (dragRef.current?.startWorld.x ?? world.x);
      const dy = world.y - (dragRef.current?.startWorld.y ?? world.y);
      switch (orig.kind) {
        case 'text':
        case 'rect':
          return { ...orig, x: orig.x + dx, y: orig.y + dy };
        case 'ellipse':
          return { ...orig, cx: orig.cx + dx, cy: orig.cy + dy };
        case 'polyline':
          return {
            ...orig,
            points: orig.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          };
        case 'line':
          return {
            ...orig,
            a: { x: orig.a.x + dx, y: orig.a.y + dy },
            b: { x: orig.b.x + dx, y: orig.b.y + dy },
          };
        case 'measure':
          return {
            ...orig,
            a: { x: orig.a.x + dx, y: orig.a.y + dy },
            b: { x: orig.b.x + dx, y: orig.b.y + dy },
            via: orig.via ? { x: orig.via.x + dx, y: orig.via.y + dy } : undefined,
          };
        case 'furniture_module':
          return {
            ...orig,
            a: { x: orig.a.x + dx, y: orig.a.y + dy },
            b: { x: orig.b.x + dx, y: orig.b.y + dy },
          };
        default:
          return orig;
      }
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (drag) {
      const payload = livePayloadsRef.current[drag.id];
      if (payload) {
        // Ao soltar o móvel (mover / girar / largura), fixa no ponto solto.
        // Rotação e largura continuam disponíveis depois.
        let toCommit = payload;
        if (
          payload.kind === 'furniture_module' &&
          (drag.kind === 'move' || drag.kind === 'furniture_edit' || drag.kind === 'furniture_rotate')
        ) {
          toCommit = { ...payload, locked: true };
          setLivePayloads((prev) => ({ ...prev, [drag.id]: toCommit }));
          livePayloadsRef.current[drag.id] = toCommit;
        }
        void onCommitAnnotation(drag.id, toCommit);
      }
    }
    dragRef.current = null;
    setIsDragging(false);
  }, [onCommitAnnotation]);

  const startResize = (
    e: React.PointerEvent,
    ann: DecodedWhiteboardAnnotation,
    corner: TextResizeCorner,
  ) => {
    if (disabled) return;
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    const p = payloadFor(ann);
    if (p.kind !== 'text') return;
    const world = screenToWorld(e.clientX, e.clientY);
    dragRef.current = {
      id: ann.id,
      kind: 'resize',
      startWorld: world,
      origPayload: JSON.parse(JSON.stringify(p)) as WhiteboardAnnotationPayload,
      resizeCorner: corner,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const applyResize = (
    world: WhiteboardPoint,
    orig: WhiteboardTextPayload,
    corner: TextResizeCorner,
  ): WhiteboardTextPayload => {
    const dx = world.x - (dragRef.current?.startWorld.x ?? world.x);
    const dy = world.y - (dragRef.current?.startWorld.y ?? world.y);
    let w = orig.w;
    let h = orig.h;
    if (corner === 'se' || corner === 'e') w = orig.w + dx;
    if (corner === 'se' || corner === 's') h = orig.h + dy;
    const clamped = clampTextSize(w, h);
    return { ...orig, w: clamped.w, h: clamped.h };
  };

  const startRotate = (e: React.PointerEvent, ann: DecodedWhiteboardAnnotation) => {
    if (
      disabled ||
      contentLocked ||
      tool !== 'select' ||
      ann.payload.kind === 'polyline' ||
      ann.payload.kind === 'line' ||
      ann.payload.kind === 'measure' ||
      ann.payload.kind === 'furniture_module'
    )
      return;
    e.stopPropagation();
    onSelectAnnotation(ann.id);
    const world = screenToWorld(e.clientX, e.clientY);
    const p = payloadFor(ann);
    if (
      p.kind === 'polyline' ||
      p.kind === 'line' ||
      p.kind === 'measure' ||
      p.kind === 'furniture_module'
    )
      return;
    const center =
      p.kind === 'ellipse' ? { x: p.cx, y: p.cy } : { x: p.x + p.w / 2, y: p.y + p.h / 2 };
    dragRef.current = {
      id: ann.id,
      kind: 'rotate',
      startWorld: world,
      origPayload: JSON.parse(JSON.stringify(p)) as WhiteboardAnnotationPayload,
      startAngleDeg: (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI,
      origRotation: p.rotation,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startAdjustVia = (e: React.PointerEvent, ann: DecodedWhiteboardAnnotation) => {
    if (disabled || contentLocked || tool !== 'select') return;
    e.stopPropagation();
    const p = payloadFor(ann);
    if (p.kind !== 'measure' || !p.via) return;
    onSelectAnnotation(ann.id);
    dragRef.current = {
      id: ann.id,
      kind: 'adjust_via',
      startWorld: screenToWorld(e.clientX, e.clientY),
      origPayload: JSON.parse(JSON.stringify(p)) as WhiteboardAnnotationPayload,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startFurnitureEdit = (
    e: React.PointerEvent,
    ann: DecodedWhiteboardAnnotation,
    handle: FurnitureEditHandle,
  ) => {
    if (disabled || contentLocked || tool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();
    const p = payloadFor(ann);
    if (p.kind !== 'furniture_module') return;
    // Altura (a/b) só no rascunho; largura e rotação liberadas mesmo fixado.
    const isWidthHandle = handle === 'height' || handle === 'tr' || handle === 'tl' || handle === 'width_left';
    if (p.locked && !isWidthHandle) return;
    onSelectAnnotation(ann.id);
    dragRef.current = {
      id: ann.id,
      kind: 'furniture_edit',
      startWorld: screenToWorld(e.clientX, e.clientY),
      origPayload: JSON.parse(JSON.stringify(p)) as WhiteboardAnnotationPayload,
      furnitureHandle: handle,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startFurnitureRotate = (e: React.PointerEvent, ann: DecodedWhiteboardAnnotation) => {
    if (disabled || contentLocked || tool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();
    const p = payloadFor(ann);
    if (p.kind !== 'furniture_module') return;
    onSelectAnnotation(ann.id);
    const world = screenToWorld(e.clientX, e.clientY);
    const frame = furnitureFrame(
      p.a,
      p.b,
      p.moduleType,
      p.heightOverride,
      p.widthOverride,
      p.topDown === true,
    );
    const cx = (frame.tl.x + frame.tr.x + frame.bl.x + frame.br.x) / 4;
    const cy = (frame.tl.y + frame.tr.y + frame.bl.y + frame.br.y) / 4;
    dragRef.current = {
      id: ann.id,
      kind: 'furniture_rotate',
      startWorld: world,
      origPayload: JSON.parse(JSON.stringify(p)) as WhiteboardAnnotationPayload,
      startAngleDeg: (Math.atan2(world.y - cy, world.x - cx) * 180) / Math.PI,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const applyFurnitureEdit = useCallback(
    (
      world: WhiteboardPoint,
      orig: WhiteboardFurnitureModulePayload,
      handle: FurnitureEditHandle,
    ): WhiteboardFurnitureModulePayload => {
      // a = topo, b = base (eixo altura cima→baixo)
      if (handle === 'a') {
        if (Math.hypot(world.x - orig.b.x, world.y - orig.b.y) < FURNITURE_MIN_HEIGHT) return orig;
        return { ...orig, a: { x: world.x, y: world.y }, topDown: true };
      }
      if (handle === 'b') {
        if (Math.hypot(world.x - orig.a.x, world.y - orig.a.y) < FURNITURE_MIN_HEIGHT) return orig;
        return { ...orig, b: { x: world.x, y: world.y }, topDown: true };
      }

      const frame = furnitureFrame(
        orig.a,
        orig.b,
        orig.moduleType,
        orig.heightOverride,
        orig.widthOverride,
        orig.topDown === true,
      );
      const mid = {
        x: (orig.a.x + orig.b.x) / 2,
        y: (orig.a.y + orig.b.y) / 2,
      };
      const along = (world.x - mid.x) * frame.ux + (world.y - mid.y) * frame.uy;
      return {
        ...orig,
        widthOverride: Math.max(FURNITURE_MIN_WIDTH, Math.abs(along) * 2),
        topDown: true,
      };
    },
    [],
  );

  const changeFurnitureModuleType = useCallback(
    (ann: DecodedWhiteboardAnnotation, moduleType: FurnitureModuleType) => {
      if (contentLocked || tool !== 'select') return;
      const live = livePayloadsRef.current[ann.id];
      const p =
        live?.kind === 'furniture_module'
          ? live
          : ann.payload.kind === 'furniture_module'
            ? ann.payload
            : null;
      if (!p) return;
      const heightOverride =
        p.heightOverride ?? resolveFurnitureHeight(p.a, p.b, p.moduleType, p.heightOverride);
      const next: WhiteboardFurnitureModulePayload = {
        ...p,
        moduleType,
        heightOverride,
        topDown: true,
        // Ao trocar o tipo, limpa traços apagados (geometria diferente)
        hiddenLineIndices: [],
        locked: true,
        widthOverride: p.widthOverride,
      };
      setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
      livePayloadsRef.current[ann.id] = next;
      void onCommitAnnotation(ann.id, next);
    },
    [contentLocked, tool, onCommitAnnotation],
  );

  const rotateFurnitureModule = useCallback(
    (ann: DecodedWhiteboardAnnotation, deltaDeg: number) => {
      if (contentLocked || tool !== 'select') return;
      const live = livePayloadsRef.current[ann.id];
      const p =
        live?.kind === 'furniture_module'
          ? live
          : ann.payload.kind === 'furniture_module'
            ? ann.payload
            : null;
      // Rotação liberada mesmo com móvel fixado
      if (!p) return;
      const next = rotateFurniturePayload(p, deltaDeg);
      setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
      livePayloadsRef.current[ann.id] = next;
      void onCommitAnnotation(ann.id, next);
    },
    [contentLocked, tool, onCommitAnnotation],
  );

  const nudgeFurnitureWidth = useCallback(
    (ann: DecodedWhiteboardAnnotation, factor: number) => {
      if (contentLocked || tool !== 'select') return;
      const live = livePayloadsRef.current[ann.id];
      const p =
        live?.kind === 'furniture_module'
          ? live
          : ann.payload.kind === 'furniture_module'
            ? ann.payload
            : null;
      if (!p) return;
      const next = scaleFurnitureWidth(p, factor);
      if (next === p) {
        toast.message(factor < 1 ? 'Largura mínima atingida' : 'Não foi possível alterar a largura');
        return;
      }
      setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
      livePayloadsRef.current[ann.id] = next;
      void onCommitAnnotation(ann.id, next);
    },
    [contentLocked, tool, onCommitAnnotation],
  );

  const scaleFurnitureModule = useCallback(
    (ann: DecodedWhiteboardAnnotation, factor: number) => {
      if (contentLocked || tool !== 'select') return;
      const live = livePayloadsRef.current[ann.id];
      const p =
        live?.kind === 'furniture_module'
          ? live
          : ann.payload.kind === 'furniture_module'
            ? ann.payload
            : null;
      if (!p) return;
      const next = scaleFurniturePayload(p, factor);
      if (next === p) {
        toast.message(factor < 1 ? 'Tamanho mínimo atingido' : 'Não foi possível alterar o tamanho');
        return;
      }
      setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
      livePayloadsRef.current[ann.id] = next;
      void onCommitAnnotation(ann.id, next);
    },
    [contentLocked, tool, onCommitAnnotation],
  );

  const hideFurnitureLine = useCallback(
    (ann: DecodedWhiteboardAnnotation, lineIndex: number) => {
      if (contentLocked || tool !== 'select') return;
      const live = livePayloadsRef.current[ann.id];
      const p =
        live?.kind === 'furniture_module'
          ? live
          : ann.payload.kind === 'furniture_module'
            ? ann.payload
            : null;
      if (!p || p.locked) return;
      const hidden = new Set(p.hiddenLineIndices ?? []);
      if (hidden.has(lineIndex)) return;
      hidden.add(lineIndex);
      const next: WhiteboardFurnitureModulePayload = {
        ...p,
        hiddenLineIndices: [...hidden].sort((a, b) => a - b),
        locked: false,
      };
      setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
      livePayloadsRef.current[ann.id] = next;
      void onCommitAnnotation(ann.id, next);
    },
    [contentLocked, tool, onCommitAnnotation],
  );

  const lockFurnitureModule = useCallback(
    (ann: DecodedWhiteboardAnnotation) => {
      if (contentLocked || tool !== 'select') return;
      const live = livePayloadsRef.current[ann.id];
      const p =
        live?.kind === 'furniture_module'
          ? live
          : ann.payload.kind === 'furniture_module'
            ? ann.payload
            : null;
      if (!p) return;
      const next: WhiteboardFurnitureModulePayload = { ...p, locked: true };
      setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
      livePayloadsRef.current[ann.id] = next;
      void onCommitAnnotation(ann.id, next);
      toast.success('Móvel fixado na lousa');
    },
    [contentLocked, tool, onCommitAnnotation],
  );

  const unlockFurnitureModule = useCallback(
    (ann: DecodedWhiteboardAnnotation) => {
      if (contentLocked || tool !== 'select') return;
      const live = livePayloadsRef.current[ann.id];
      const p =
        live?.kind === 'furniture_module'
          ? live
          : ann.payload.kind === 'furniture_module'
            ? ann.payload
            : null;
      if (!p) return;
      const next: WhiteboardFurnitureModulePayload = { ...p, locked: false };
      setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
      livePayloadsRef.current[ann.id] = next;
      void onCommitAnnotation(ann.id, next);
    },
    [contentLocked, tool, onCommitAnnotation],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const isTextMoveWhileLocked =
        drag.kind === 'move' && drag.origPayload.kind === 'text' && contentLocked;
      const isShapeMoveWhileEditing =
        drag.kind === 'move' && tool === 'select' && !contentLocked;
      const canMove =
        drag.kind === 'resize' ||
        drag.kind === 'furniture_edit' ||
        drag.kind === 'furniture_rotate' ||
        isTextMoveWhileLocked ||
        isShapeMoveWhileEditing;
      const canRotate = drag.kind === 'rotate' && tool === 'select' && !contentLocked;
      const canAdjustVia = drag.kind === 'adjust_via' && tool === 'select' && !contentLocked;

      if (!canMove && !canRotate && !canAdjustVia) return;

      const world = screenToWorld(e.clientX, e.clientY);

      if (drag.kind === 'move') {
        const next = applyMove(world, drag.origPayload);
        setLivePayloads((prev) => ({
          ...prev,
          [drag.id]: next,
        }));
        livePayloadsRef.current[drag.id] = next;
        if (next.kind === 'text') {
          onTextPayloadLiveChange?.(drag.id, next);
        }
      } else if (
        drag.kind === 'furniture_edit' &&
        drag.origPayload.kind === 'furniture_module' &&
        drag.furnitureHandle
      ) {
        const next = applyFurnitureEdit(world, drag.origPayload, drag.furnitureHandle);
        setLivePayloads((prev) => ({ ...prev, [drag.id]: next }));
        livePayloadsRef.current[drag.id] = next;
      } else if (
        drag.kind === 'furniture_rotate' &&
        drag.origPayload.kind === 'furniture_module'
      ) {
        const orig = drag.origPayload;
        const frame = furnitureFrame(
          orig.a,
          orig.b,
          orig.moduleType,
          orig.heightOverride,
          orig.widthOverride,
          orig.topDown === true,
        );
        const cx = (frame.tl.x + frame.tr.x + frame.bl.x + frame.br.x) / 4;
        const cy = (frame.tl.y + frame.tr.y + frame.bl.y + frame.br.y) / 4;
        const angleDeg = (Math.atan2(world.y - cy, world.x - cx) * 180) / Math.PI;
        const delta = angleDeg - (drag.startAngleDeg ?? angleDeg);
        const next = rotateFurniturePayload(orig, delta);
        setLivePayloads((prev) => ({ ...prev, [drag.id]: next }));
        livePayloadsRef.current[drag.id] = next;
      } else if (
        drag.kind === 'resize' &&
        drag.origPayload.kind === 'text' &&
        drag.resizeCorner
      ) {
        const next = applyResize(world, drag.origPayload as WhiteboardTextPayload, drag.resizeCorner!);
        setLivePayloads((prev) => ({
          ...prev,
          [drag.id]: next,
        }));
        livePayloadsRef.current[drag.id] = next;
        onTextPayloadLiveChange?.(drag.id, next);
      } else if (
        drag.kind === 'rotate' &&
        drag.origPayload.kind !== 'polyline' &&
        drag.origPayload.kind !== 'line' &&
        drag.origPayload.kind !== 'measure' &&
        drag.origPayload.kind !== 'furniture_module'
      ) {
        const p = drag.origPayload;
        const center =
          p.kind === 'ellipse'
            ? { x: p.cx, y: p.cy }
            : { x: p.x + p.w / 2, y: p.y + p.h / 2 };
        const angleDeg = (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI;
        const delta = angleDeg - (drag.startAngleDeg ?? angleDeg);
        const rotation = (drag.origRotation ?? 0) + delta;
        if (p.kind === 'text' || p.kind === 'rect' || p.kind === 'ellipse') {
          const next = { ...p, rotation } as WhiteboardAnnotationPayload;
          setLivePayloads((prev) => ({ ...prev, [drag.id]: next }));
          livePayloadsRef.current[drag.id] = next;
          if (next.kind === 'text') {
            onTextPayloadLiveChange?.(drag.id, next);
          }
        }
      } else if (drag.kind === 'adjust_via' && drag.origPayload.kind === 'measure') {
        const orig = drag.origPayload;
        const via = world;
        const next: WhiteboardMeasurePayload = {
          ...orig,
          via,
          label: formatMeasureValue(measureDistance(orig.a, orig.b, via)),
        };
        setLivePayloads((prev) => ({ ...prev, [drag.id]: next }));
        livePayloadsRef.current[drag.id] = next;
      }
    },
    [
      tool,
      contentLocked,
      screenToWorld,
      applyMove,
      applyResize,
      applyFurnitureEdit,
      onTextPayloadLiveChange,
    ],
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (ev: PointerEvent) => {
      handlePointerMove({ clientX: ev.clientX, clientY: ev.clientY } as React.PointerEvent);
    };
    const onUp = () => handlePointerUp();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  /** Arrastar segurando na caixa: pequeno movimento = arraste; toque sem mover = editar texto. */
  useEffect(() => {
    const DRAG_THRESHOLD_PX = 6;

    const onMove = (ev: PointerEvent) => {
      const pending = textPointerPendingRef.current;
      if (!pending || pending.pointerId !== ev.pointerId) return;
      if (dragRef.current) return;

      const dx = ev.clientX - pending.startX;
      const dy = ev.clientY - pending.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;

      activateTextMove(pending.ann, ev.clientX, ev.clientY, ev.pointerId);
    };

    const onUp = (ev: PointerEvent) => {
      const pending = textPointerPendingRef.current;
      if (!pending || pending.pointerId !== ev.pointerId) return;

      if (!dragRef.current) {
        const el = textAreaRefs.current[pending.ann.id];
        if (el && !disabled) {
          try {
            el.focus({ preventScroll: true });
          } catch {
            /* no-op */
          }
        }
      }
      textPointerPendingRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [activateTextMove, disabled]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (
        ev.key === 'Delete' &&
        selectedAnnotationId &&
        tool === 'select' &&
        !contentLocked
      ) {
        void onDeleteAnnotation(selectedAnnotationId);
        onSelectAnnotation(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedAnnotationId, tool, contentLocked, onDeleteAnnotation, onSelectAnnotation]);

  const renderShape = (payload: WhiteboardAnnotationPayload, stroke: string, sw: number, key?: string) => {
    if (payload.kind === 'rect') {
      const corners = rectCorners(payload.x, payload.y, payload.w, payload.h, payload.rotation);
      const d = corners.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
      return (
        <path
          key={key}
          d={d}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (payload.kind === 'ellipse') {
      return (
        <ellipse
          key={key}
          cx={payload.cx}
          cy={payload.cy}
          rx={Math.max(payload.rx, 2)}
          ry={Math.max(payload.ry, 2)}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          transform={`rotate(${payload.rotation} ${payload.cx} ${payload.cy})`}
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (payload.kind === 'polyline' && payload.points.length >= 2) {
      return (
        <path
          key={key}
          d={polylineToPath(payload.points)}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (payload.kind === 'line') {
      return (
        <path
          key={key}
          d={lineToPath(payload.a, payload.b)}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    return null;
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 9100, width: worldWidth, height: worldHeight }}
    >
      <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        {annotations.map((ann) => {
          const payload = payloadFor(ann);
          if (payload.kind === 'measure') {
            const stroke = payload.colorHex ?? ann.cor;
            return <MeasureArrowMarkers key={`m-${ann.id}`} idPrefix={`wb-m-${ann.id}`} color={stroke} />;
          }
          return null;
        })}
        {measurePreview && (
          <MeasureArrowMarkers idPrefix="wb-m-preview" color={measurePreview.colorHex ?? color} />
        )}
        <MeasureArrowMarkers idPrefix="wb-measure" color={color} />
        {annotations.map((ann) => {
          const payload = payloadFor(ann);
          if (payload.kind === 'measure') {
            const m = payload;
            const stroke = m.colorHex ?? ann.cor;
            return (
              <g key={ann.id} data-whiteboard-measure>
                <MeasureAnnotationGfx
                  payload={m}
                  strokeColor={stroke}
                  strokeWidth={ann.stroke_width}
                  selected={selectedAnnotationId === ann.id}
                  markerId={`wb-m-${ann.id}`}
                />
              </g>
            );
          }
          if (payload.kind === 'furniture_module') {
            const selected = selectedAnnotationId === ann.id;
            return (
              <g key={ann.id} data-whiteboard-furniture>
                <FurnitureModuleGfx
                  payload={payload}
                  strokeColor={payload.colorHex ?? ann.cor}
                  strokeWidth={ann.stroke_width}
                  selected={selected}
                />
              </g>
            );
          }
          return (
          <g key={ann.id}>
            {renderShape(payload, ann.cor, ann.stroke_width, ann.id)}
            {payload.kind === 'polyline' &&
              payload.points.length > 2 &&
              payload.points.map((p, idx) => (
                <circle
                  key={`${ann.id}-pt-${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={ann.cor}
                  stroke="#fff"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </g>
        );
        })}

        {pendingPolyline && pendingPolyline.length > 0 && (
          <g>
            {pendingPolyline.length >= 2 && (
              <path
                d={polylineToPath(pendingPolyline)}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {pendingPolyline.map((p, idx) => (
              <circle
                key={`pending-${idx}`}
                cx={p.x}
                cy={p.y}
                r={6}
                fill={color}
                stroke="#fff"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {polylinePreview && pendingPolyline.length > 0 && (
              <line
                x1={pendingPolyline[pendingPolyline.length - 1].x}
                y1={pendingPolyline[pendingPolyline.length - 1].y}
                x2={polylinePreview.x}
                y2={polylinePreview.y}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        )}

        {shapePreview && renderShape(shapePreview, color, strokeWidth, 'preview')}

        {shapePreview && (shapePreview.kind === 'rect' || shapePreview.kind === 'ellipse') && (
          <text
            x={
              shapePreview.kind === 'rect'
                ? shapePreview.x + shapePreview.w / 2
                : shapePreview.cx
            }
            y={
              shapePreview.kind === 'rect'
                ? shapePreview.y + shapePreview.h / 2
                : shapePreview.cy
            }
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground/80 font-mono text-[11px] tabular-nums pointer-events-none"
            style={{ fontSize: 11 }}
          >
            {shapePreview.kind === 'rect'
              ? `${Math.round(shapePreview.w)} × ${Math.round(shapePreview.h)}`
              : `${Math.round(shapePreview.rx * 2)} × ${Math.round(shapePreview.ry * 2)}`}
          </text>
        )}

        {measurePreview && (
          <MeasureAnnotationGfx
            payload={measurePreview}
            strokeColor={measurePreview.colorHex ?? color}
            preview
            markerId="wb-m-preview"
          />
        )}

        {furniturePreview && (
          <FurnitureModuleGfx
            payload={furniturePreview}
            strokeColor={furniturePreview.colorHex ?? color}
            strokeWidth={strokeWidth}
            preview
          />
        )}
      </svg>

      {annotations.map((ann) => {
        const payload = payloadFor(ann);
        if (payload.kind !== 'text') return null;
        const p = payload;
        const selected = selectedAnnotationId === ann.id;
        const canEditText = !disabled && (contentLocked || tool === 'select');
        const showTextChrome = selected && (contentLocked || tool === 'select');
        const canDragText = canMoveAnnotation(ann);
        return (
          <div
            key={`text-${ann.id}`}
            data-whiteboard-text
            className={cn(
              'absolute p-1 touch-none',
              allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
              canDragText && 'cursor-grab active:cursor-grabbing',
              !contentLocked && tool === 'eraser' && 'cursor-cell',
              selected && 'ring-2 ring-primary ring-offset-1',
            )}
            style={{
              left: p.x,
              top: p.y,
              width: Math.max(p.w, WHITEBOARD_TEXT_MIN_W),
              height: Math.max(p.h, WHITEBOARD_TEXT_MIN_H),
              transform: `rotate(${p.rotation}deg)`,
              transformOrigin: 'center center',
              zIndex: 9200 + (selected ? 10 : 0),
            }}
            onPointerDown={(e) => handlePointerDown(e, ann)}
          >
            {showTextChrome && (
              <div 
                className="absolute -top-11 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 pointer-events-auto"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {canDragText && (
                  <div
                    role="button"
                    tabIndex={-1}
                    className="flex h-8 items-center justify-center rounded-md border border-primary/20 bg-background/95 px-2 text-muted-foreground shadow-sm cursor-grab active:cursor-grabbing touch-none"
                    onPointerDown={(e) => startAnnotationMove(e, ann)}
                  >
                    <GripHorizontal className="h-4 w-4" />
                  </div>
                )}
                <button
                  type="button"
                  className="flex h-8 items-center gap-1.5 rounded-md bg-green-600 px-3 text-[10px] font-bold text-white shadow-md hover:bg-green-700 active:scale-95 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    void (async () => {
                      await commitTextAnnotation(ann, true);
                      textAreaRefs.current[ann.id]?.blur();
                    })();
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  SALVAR
                </button>
              </div>
            )}
            <textarea
              ref={(node) => {
                textAreaRefs.current[ann.id] = node;
              }}
              className={cn(
                'block h-[calc(100%-2px)] w-[calc(100%-2px)] resize-none rounded-md border border-border/80 bg-white/95 px-2 py-1 text-foreground shadow-sm outline-none focus:ring-2 focus:ring-primary/40',
                canDragText && 'cursor-grab active:cursor-grabbing',
              )}
              style={{
                fontFamily: textFontFamily,
                fontSize: isMobile ? Math.max(p.fontSize, 16) : p.fontSize,
                color: textColorHex,
              }}
              value={p.text}
              readOnly={!canEditText || isDragging}
              onPointerDown={(e) => handleTextPointerDown(e, ann)}
              onChange={(e) => {
                if (!canEditText) return;
                const next: WhiteboardTextPayload = { ...p, text: e.target.value };
                setLivePayloads((prev) => ({ ...prev, [ann.id]: next }));
                onTextPayloadLiveChange?.(ann.id, next);
              }}
              onBlur={() => {
                void commitTextAnnotation(ann, false);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (contentLocked) onSelectAnnotation(ann.id);
              }}
            />
            {showTextChrome && !contentLocked && (
              <button
                type="button"
                aria-label="Girar texto"
                className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center text-[10px]"
                onPointerDown={(e) => startRotate(e, ann)}
              >
                ↻
              </button>
            )}
            {showTextChrome && (
              <>
                <div
                  role="separator"
                  aria-label="Redimensionar largura"
                  className="absolute top-1/2 -right-1.5 h-8 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm bg-primary/90 shadow"
                  onPointerDown={(e) => startResize(e, ann, 'e')}
                />
                <div
                  role="separator"
                  aria-label="Redimensionar altura"
                  className="absolute -bottom-1.5 left-1/2 h-3 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm bg-primary/90 shadow"
                  onPointerDown={(e) => startResize(e, ann, 's')}
                />
                <div
                  role="separator"
                  aria-label="Redimensionar caixa"
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-background bg-primary shadow"
                  onPointerDown={(e) => startResize(e, ann, 'se')}
                />
              </>
            )}
          </div>
        );
      })}

      {annotations.map((ann) => {
        const payload = payloadFor(ann);
        if (payload.kind !== 'measure') return null;
        const selected = selectedAnnotationId === ann.id;
        const live = livePayloads[ann.id];
        const label = live?.kind === 'measure' ? live.label : payload.label;
        return (
          <MeasureLabel
            key={`measure-label-${ann.id}`}
            payload={payload}
            strokeColor={ann.cor}
            selected={selected}
            editable={selected && tool === 'select' && !contentLocked}
            value={label}
            onChange={(next) => {
              const updated: WhiteboardMeasurePayload = { ...payload, label: next };
              setLivePayloads((prev) => ({ ...prev, [ann.id]: updated }));
              livePayloadsRef.current[ann.id] = updated;
            }}
            onBlur={() => {
              const current = livePayloadsRef.current[ann.id];
              if (current?.kind === 'measure') {
                void onCommitAnnotation(ann.id, current);
              }
            }}
          />
        );
      })}

      {measurePreview && (
        <MeasureLabel
          key="measure-label-preview"
          payload={measurePreview}
          strokeColor={measurePreview.colorHex ?? color}
          selected={false}
          editable={false}
          value={measurePreview.label}
        />
      )}

      {annotations.map((ann) => {
        const payload = payloadFor(ann);
        if (payload.kind !== 'measure' || !payload.via) return null;
        const selected = selectedAnnotationId === ann.id;
        if (!selected || tool !== 'select' || contentLocked) return null;
        return (
          <div
            key={`via-handle-${ann.id}`}
            role="button"
            tabIndex={-1}
            aria-label="Ajustar curvatura do arco"
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2',
              allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
              'h-5 w-5 rounded-full border-2 border-background bg-primary shadow-md cursor-grab active:cursor-grabbing',
              'ring-2 ring-primary/30 transition-transform hover:scale-110',
            )}
            style={{
              left: payload.via.x,
              top: payload.via.y,
              zIndex: 9260,
            }}
            onPointerDown={(e) => startAdjustVia(e, ann)}
          />
        );
      })}

      {annotations.map((ann) => {
        const payload = payloadFor(ann);
        if (payload.kind !== 'furniture_module') return null;
        const selected = selectedAnnotationId === ann.id;
        if (!selected || tool !== 'select' || contentLocked) return null;
        const isDraft = !payload.locked;
        const frame = furnitureFrame(
          payload.a,
          payload.b,
          payload.moduleType,
          payload.heightOverride,
          payload.widthOverride,
          payload.topDown === true,
        );
        const hidden = new Set(payload.hiddenLineIndices ?? []);
        const topMid = {
          x: (frame.tl.x + frame.tr.x) / 2,
          y: (frame.tl.y + frame.tr.y) / 2,
        };
        const bottomMid = {
          x: (frame.bl.x + frame.br.x) / 2,
          y: (frame.bl.y + frame.br.y) / 2,
        };
        const leftMid = {
          x: (frame.tl.x + frame.bl.x) / 2,
          y: (frame.tl.y + frame.bl.y) / 2,
        };
        const rightMid = {
          x: (frame.tr.x + frame.br.x) / 2,
          y: (frame.tr.y + frame.br.y) / 2,
        };
        const rotDeg = Math.round(furnitureRotationDeg(payload.a, payload.b));
        const handleClass = cn(
          'absolute -translate-x-1/2 -translate-y-1/2',
          allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
          'h-5 w-5 rounded-full border-2 border-background bg-sky-600 shadow-md',
          'cursor-ew-resize ring-2 ring-sky-400/35 transition-transform hover:scale-110 active:scale-95',
        );
        const endpointClass = cn(
          'absolute -translate-x-1/2 -translate-y-1/2',
          allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
          'h-5 w-5 rounded-full border-2 border-background bg-amber-600 shadow-md',
          'cursor-grab active:cursor-grabbing ring-2 ring-amber-400/40 transition-transform hover:scale-110',
        );
        const dockBtn = cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          'bg-zinc-800/90 text-amber-50 shadow-sm transition',
          'hover:bg-zinc-700 active:scale-95',
        );

        return (
          <div key={`furniture-edit-${ann.id}`} className="contents">
            {/* Barra superior: tamanho + variantes + editar traços */}
            <div
              role="toolbar"
              aria-label={isDraft ? 'Editar móvel (rascunho)' : 'Ajustes do móvel'}
              className={cn(
                'absolute z-[9270] flex -translate-x-1/2 items-center gap-1 rounded-xl border border-amber-900/40',
                'bg-zinc-950/92 p-1.5 shadow-lg backdrop-blur-md',
                'max-w-[min(92vw,28rem)] overflow-x-auto',
                allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
              )}
              style={{
                left: topMid.x,
                top: topMid.y - 48,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="Diminuir tamanho"
                aria-label="Diminuir tamanho"
                className={dockBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  scaleFurnitureModule(ann, 0.85);
                }}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Aumentar tamanho"
                aria-label="Aumentar tamanho"
                className={dockBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  scaleFurnitureModule(ann, 1.15);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <div className="mx-0.5 h-5 w-px shrink-0 bg-amber-700/40" />
              <button
                type="button"
                title="Estreitar móvel"
                aria-label="Estreitar móvel"
                className={cn(dockBtn, 'w-auto gap-1 px-2 text-[10px] font-bold tracking-wide')}
                onClick={(e) => {
                  e.stopPropagation();
                  nudgeFurnitureWidth(ann, 0.82);
                }}
              >
                <ArrowLeftRight className="h-3 w-3 rotate-90 opacity-70" />
                −
              </button>
              <button
                type="button"
                title="Alargar móvel"
                aria-label="Alargar móvel"
                className={cn(dockBtn, 'w-auto gap-1 px-2 text-[10px] font-bold tracking-wide')}
                onClick={(e) => {
                  e.stopPropagation();
                  nudgeFurnitureWidth(ann, 1.22);
                }}
              >
                <ArrowLeftRight className="h-3 w-3 opacity-70" />
                +
              </button>
              <div className="mx-0.5 h-5 w-px shrink-0 bg-amber-700/40" />
              {getFurnitureVariants(getFamilyForModuleType(payload.moduleType)).map((mod) => (
                <button
                  key={mod.type}
                  type="button"
                  title={`${mod.label} — ${mod.description}`}
                  className={cn(
                    'shrink-0 rounded-md px-1.5 py-1.5 text-[9px] font-semibold leading-none transition-colors',
                    payload.moduleType === mod.type
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-800/80 text-amber-100/80 hover:bg-zinc-700',
                  )}
                  onClick={() => changeFurnitureModuleType(ann, mod.type)}
                >
                  {mod.label}
                </button>
              ))}
              {isDraft ? (
                <button
                  type="button"
                  title="Salvar e fixar o móvel"
                  className="ml-0.5 flex h-8 shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-500 active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    lockFurnitureModule(ann);
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Fixar
                </button>
              ) : (
                <button
                  type="button"
                  title="Editar traços do móvel"
                  className="ml-0.5 flex h-8 shrink-0 items-center rounded-md bg-zinc-700 px-2.5 text-[10px] font-semibold text-amber-50 hover:bg-zinc-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    unlockFurnitureModule(ann);
                  }}
                >
                  Traços
                </button>
              )}
            </div>

            {/* Barra inferior: rotação em tempo real */}
            <div
              role="toolbar"
              aria-label="Rotação do móvel"
              className={cn(
                'absolute z-[9270] flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-amber-500/35',
                'bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 px-2 py-1.5 shadow-xl backdrop-blur-md',
                allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
              )}
              style={{
                left: bottomMid.x,
                top: bottomMid.y + 18,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="Girar 15° à esquerda"
                aria-label="Girar para a esquerda"
                className={dockBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  rotateFurnitureModule(ann, -15);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Alça de giro contínuo — arraste ao redor do móvel */}
              <button
                type="button"
                title="Arraste para girar em tempo real"
                aria-label="Girar em tempo real"
                className={cn(
                  'relative flex h-10 min-w-[4.5rem] shrink-0 items-center justify-center gap-1.5 rounded-xl',
                  'border border-amber-400/50 bg-amber-500/15 text-amber-100',
                  'cursor-grab active:cursor-grabbing hover:bg-amber-500/25 active:scale-[0.98]',
                  'shadow-inner transition',
                )}
                onPointerDown={(e) => startFurnitureRotate(e, ann)}
              >
                <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-300/20" />
                <RotateCw className="h-3.5 w-3.5 opacity-80" />
                <span className="font-mono text-[11px] font-bold tabular-nums tracking-tight">
                  {rotDeg > 0 ? `+${rotDeg}` : rotDeg}°
                </span>
              </button>

              <button
                type="button"
                title="Girar 15° à direita"
                aria-label="Girar para a direita"
                className={dockBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  rotateFurnitureModule(ann, 15);
                }}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Girar 90°"
                className={cn(dockBtn, 'w-auto px-2 text-[10px] font-bold')}
                onClick={(e) => {
                  e.stopPropagation();
                  rotateFurnitureModule(ann, 90);
                }}
              >
                90°
              </button>
            </div>

            {/* Clique em cada traço para apagar (só no rascunho) */}
            {isDraft &&
              frame.lines.map((line, lineIndex) => {
                if (hidden.has(lineIndex)) return null;
                const [p0, p1] = line;
                const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
                if (len < 2) return null;
                const midX = (p0.x + p1.x) / 2;
                const midY = (p0.y + p1.y) / 2;
                const angleDeg = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
                return (
                  <button
                    key={`furniture-edge-${ann.id}-${lineIndex}`}
                    type="button"
                    title="Apagar este traço"
                    aria-label={`Apagar traço ${lineIndex + 1}`}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent',
                      'bg-transparent hover:bg-destructive/25 hover:border-destructive/50',
                      'cursor-pointer transition-colors',
                      allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
                    )}
                    style={{
                      left: midX,
                      top: midY,
                      width: Math.max(len, 12),
                      height: 14,
                      transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
                      zIndex: 9275,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      hideFurnitureLine(ann, lineIndex);
                    }}
                  />
                );
              })}

            {/* Alças laterais de largura — sempre disponíveis quando selecionado */}
            <div
              role="button"
              tabIndex={-1}
              aria-label="Estreitar ou alargar pela esquerda"
              className={handleClass}
              style={{ left: leftMid.x, top: leftMid.y, zIndex: 9265 }}
              onPointerDown={(e) => startFurnitureEdit(e, ann, 'width_left')}
            />
            <div
              role="button"
              tabIndex={-1}
              aria-label="Estreitar ou alargar pela direita"
              className={handleClass}
              style={{ left: rightMid.x, top: rightMid.y, zIndex: 9265 }}
              onPointerDown={(e) => startFurnitureEdit(e, ann, 'height')}
            />

            {isDraft && (
              <>
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Mover topo do móvel"
                  className={endpointClass}
                  style={{ left: payload.a.x, top: payload.a.y, zIndex: 9265 }}
                  onPointerDown={(e) => startFurnitureEdit(e, ann, 'a')}
                />
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Mover base do móvel"
                  className={endpointClass}
                  style={{ left: payload.b.x, top: payload.b.y, zIndex: 9265 }}
                  onPointerDown={(e) => startFurnitureEdit(e, ann, 'b')}
                />
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Largura pelo canto superior esquerdo"
                  className={cn(handleClass, 'h-4 w-4 rounded-sm')}
                  style={{ left: frame.tl.x, top: frame.tl.y, zIndex: 9265 }}
                  onPointerDown={(e) => startFurnitureEdit(e, ann, 'tl')}
                />
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Largura pelo canto superior direito"
                  className={cn(handleClass, 'h-4 w-4 rounded-sm')}
                  style={{ left: frame.tr.x, top: frame.tr.y, zIndex: 9265 }}
                  onPointerDown={(e) => startFurnitureEdit(e, ann, 'tr')}
                />
              </>
            )}
          </div>
        );
      })}

      {annotations.map((ann) => {
        const payload = payloadFor(ann);
        if (payload.kind === 'text') return null;
        const selected = selectedAnnotationId === ann.id;
        const bounds = annotationBounds(payload);

        if (!Number.isFinite(bounds.minX)) return null;

        const canRotate =
          selected &&
          tool === 'select' &&
          !contentLocked &&
          payload.kind !== 'polyline' &&
          payload.kind !== 'line' &&
          payload.kind !== 'measure' &&
          payload.kind !== 'furniture_module';

        return (
          <div
            key={`hit-${ann.id}`}
            data-whiteboard-measure={payload.kind === 'measure' ? true : undefined}
            data-whiteboard-furniture={payload.kind === 'furniture_module' ? true : undefined}
            className={cn(
              'absolute',
              allowsShapeInteraction ? 'pointer-events-auto' : 'pointer-events-none',
              !contentLocked && tool === 'select' && 'cursor-move',
              !contentLocked && tool === 'eraser' && 'cursor-cell',
              selected &&
                payload.kind === 'furniture_module' &&
                tool === 'select' &&
                'ring-1 ring-primary/40 rounded-sm',
            )}
            style={{
              left: bounds.minX - 8,
              top: bounds.minY - 8,
              width: Math.max(bounds.maxX - bounds.minX + 16, 24),
              height: Math.max(bounds.maxY - bounds.minY + 16, 24),
              zIndex: 9150,
            }}
            onPointerDown={(e) => handlePointerDown(e, ann)}
          >
            {canRotate && (
              <button
                type="button"
                aria-label="Girar forma"
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md cursor-grab"
                onPointerDown={(e) => startRotate(e, ann)}
              >
                ↻
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
