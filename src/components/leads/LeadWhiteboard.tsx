import {
  useRef,
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Pencil,
  Eraser,
  Camera,
  ImagePlus,
  Trash2,
  Maximize2,
  Minimize2,
  MousePointer,
  Loader2,
  ImageIcon,
  ZoomIn,
  ZoomOut,
  Scan,
  Type,
  Square,
  Circle,
  Waypoints,
  Check,
  Undo2,
  Redo2,
  ArrowLeftToLine,
  CloudOff,
  Cloud,
  Ruler,
  Spline,
  Minus,
  Save,
  FolderOpen,
  Box,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { setWhiteboardFullscreenOpenFlag } from '@/lib/dialog-outside-guard';
import { leadFullscreenContentClass, leadFullscreenOverlayClass } from '@/lib/overlay-z-index';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadWhiteboard, type LeadWhiteboardImage, type LeadWhiteboardDrawing } from '@/hooks/useLeadWhiteboard';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { useWhiteboardHistory } from '@/hooks/useWhiteboardHistory';
import { useWhiteboardTextConfig } from '@/hooks/useWhiteboardTextConfig';
import { usePermissions } from '@/hooks/usePermissions';
import { buildWhiteboardAttachmentFile } from '@/lib/lead-whiteboard-save';
import { WhiteboardProjectImagePicker } from '@/components/leads/whiteboard/WhiteboardProjectImagePicker';
import { WhiteboardCameraCapture, type WhiteboardCameraCaptureHandle } from '@/components/leads/whiteboard/WhiteboardCameraCapture';
import { isLikelyImageFile } from '@/lib/whiteboard-image-upload';
import type { LeadMidiaDisponivel } from '@/lib/orcamento-slide-types';
import {
  WHITEBOARD_FONT_SIZE_MIN,
  WHITEBOARD_FONT_SIZE_MAX,
} from '@/lib/whiteboard-text-config';
import { useWhiteboardTouchLock } from '@/hooks/useWhiteboardTouchLock';
import { useWhiteboardViewport } from '@/hooks/useWhiteboardViewport';
import { WhiteboardAnnotationsLayer } from '@/components/leads/whiteboard/WhiteboardAnnotationsLayer';
import { FurnitureModuleThumb } from '@/components/leads/whiteboard/FurnitureModuleGfx';
import {
  FURNITURE_FAMILIES,
  FURNITURE_MIN_HEIGHT,
  getFamilyForModuleType,
  getFurnitureVariants,
} from '@/lib/furniture-modules';
import {
  splitWhiteboardDrawings,
  mergeDecodedAnnotations,
  encodeAnnotationPayload,
  decodeAnnotationDrawing,
  bindDrawingToImage,
  filterDrawingsByImage,
  getDrawingPathData,
  type WhiteboardAnnotationPayload,
  type WhiteboardTextPayload,
  type WhiteboardMeasurePayload,
  type WhiteboardFurnitureModulePayload,
  type FurnitureModuleType,
  type WhiteboardPoint,
  type DecodedWhiteboardAnnotation,
} from '@/lib/whiteboard-annotations';
import {
  MEASURE_COLOR_PRESETS,
  arcViaPoint,
  formatMeasureValue,
  isNearlyHorizontal,
  measureDistance,
} from '@/lib/photo-measure-style';

type Tool =
  | 'select'
  | 'pencil'
  | 'eraser'
  | 'text'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'points'
  | 'measure'
  | 'measure_arc'
  | 'furniture';

const ANNOTATION_TOOLS: Tool[] = [
  'text',
  'line',
  'rect',
  'ellipse',
  'points',
  'measure',
  'measure_arc',
  'furniture',
];

type PendingMeasure =
  | { phase: 'pick_b'; a: WhiteboardPoint }
  | { phase: 'adjust_arc'; a: WhiteboardPoint; b: WhiteboardPoint; via: WhiteboardPoint };

type PendingFurniture = { a: WhiteboardPoint };

interface LeadWhiteboardProps {
  leadId: number | null | undefined;
  disabled?: boolean;
}

interface BoardInnerProps extends LeadWhiteboardProps {
  className?: string;
  minHeight?: number;
  variant?: 'inline' | 'fullscreen';
  onClose?: () => void;
  onSaveStateChange?: (state: {
    canSave: boolean;
    isSaving: boolean;
    disabledReason?: string;
  }) => void;
}

export interface BoardInnerHandle {
  saveToAttachments: () => Promise<void>;
}

const WORLD_MIN_W = 640;
const WORLD_MIN_H = 480;

function computePhotoWorldSize(image: LeadWhiteboardImage | null | undefined) {
  if (!image) return { width: WORLD_MIN_W, height: WORLD_MIN_H };
  return {
    width: Math.max(Number(image.width) || WORLD_MIN_W, 200),
    height: Math.max(Number(image.height) || WORLD_MIN_H, 150),
  };
}

function screenPointsToWorldPath(
  points: Array<{ x: number; y: number }>,
  view: { x: number; y: number; scale: number },
) {
  if (!points.length) return '';
  return points
    .map((p, i) => {
      const wx = (p.x - view.x) / view.scale;
      const wy = (p.y - view.y) / view.scale;
      return `${i === 0 ? 'M' : 'L'} ${wx} ${wy}`;
    })
    .join(' ');
}

const BoardInner = forwardRef<BoardInnerHandle, BoardInnerProps>(function BoardInner(
  { leadId, disabled, className, minHeight = 360, variant = 'inline', onClose, onSaveStateChange },
  ref,
) {
  const boardAreaRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boardAreaEl, setBoardAreaEl] = useState<HTMLDivElement | null>(null);
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const bindBoardAreaRef = useCallback((node: HTMLDivElement | null) => {
    boardAreaRef.current = node;
    setBoardAreaEl(node);
  }, []);
  const bindViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    setViewportEl(node);
  }, []);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraCaptureRef = useRef<WhiteboardCameraCaptureHandle>(null);
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const [cameraCaptureOpen, setCameraCaptureOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [isImportingFromProject, setIsImportingFromProject] = useState(false);
  const [isSavingAttachment, setIsSavingAttachment] = useState(false);
  const isMobile = useIsMobile();
  const isFullscreenLayout = variant === 'fullscreen';

  const {
    images,
    drawings,
    isLoading,
    addDrawing: addDrawingRaw,
    updateDrawing: updateDrawingRaw,
    deleteDrawing: deleteDrawingRaw,
    restoreDrawing,
    clearDrawings: clearDrawingsRaw,
    clearWhiteboard,
    deleteImage,
    uploadImage,
    importImageFromUrl,
    isOnline,
    isSaving,
  } = useLeadWhiteboard(leadId);

  const { uploadPDF } = useLeadPDFs(leadId);
  const { isSuperAdmin } = useAuth();
  const { userRole, hasPermission } = usePermissions();
  const canUploadAttachment =
    !disabled &&
    (isSuperAdmin ||
      userRole === 'admin' ||
      userRole === 'vendedor' ||
      hasPermission('leads', 'edit'));
  const isAdmin = userRole === 'admin';
  const { config: textConfig, saveConfig } = useWhiteboardTextConfig();
  const [textFontSizePx, setTextFontSizePx] = useState(textConfig.fontSizePx);
  const [textColorHex, setTextColorHex] = useState(textConfig.textColorHex);

  useEffect(() => {
    setTextFontSizePx(textConfig.fontSizePx);
  }, [textConfig.fontSizePx]);

  useEffect(() => {
    setTextColorHex(textConfig.textColorHex);
  }, [textConfig.textColorHex]);

  const {
    push: pushHistory,
    undo: undoHistory,
    redo: redoHistory,
    reset: resetHistory,
    canUndo,
    canRedo,
    isApplying: historyApplying,
    isRecording: isHistoryRecording,
  } = useWhiteboardHistory({
    deleteDrawing: deleteDrawingRaw,
    restoreDrawing,
    updateDrawing: updateDrawingRaw,
    clearAllDrawings: clearDrawingsRaw,
  });

  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const legacyFallbackImageId = images[0]?.id ?? null;
  const activeImage = images.find((img) => img.id === activeImageId) ?? null;
  const imageDrawings = useMemo(
    () =>
      activeImageId
        ? filterDrawingsByImage(drawings, activeImageId, legacyFallbackImageId)
        : [],
    [drawings, activeImageId, legacyFallbackImageId],
  );

  const addDrawing = useCallback(
    async (payload: { path_data: string; cor: string; stroke_width: number }) => {
      if (!activeImageId) return null as unknown as LeadWhiteboardDrawing;
      const bound = {
        ...payload,
        path_data: bindDrawingToImage(activeImageId, payload.path_data),
      };
      const created = await addDrawingRaw(bound);
      if (isHistoryRecording()) {
        pushHistory({ type: 'add', drawing: created });
      }
      return created;
    },
    [activeImageId, addDrawingRaw, pushHistory, isHistoryRecording],
  );

  const updateDrawing = useCallback(
    async (payload: {
      id: string;
      path_data?: string;
      cor?: string;
      stroke_width?: number;
    }) => {
      const current = imageDrawings.find((d) => d.id === payload.id);
      if (!current) {
        await updateDrawingRaw(payload);
        return;
      }
      const before = {
        path_data: current.path_data,
        cor: current.cor,
        stroke_width: current.stroke_width,
      };
      const after = {
        path_data: payload.path_data
          ? activeImageId
            ? bindDrawingToImage(activeImageId, payload.path_data)
            : payload.path_data
          : before.path_data,
        cor: payload.cor ?? before.cor,
        stroke_width: payload.stroke_width ?? before.stroke_width,
      };
      await updateDrawingRaw({
        id: payload.id,
        path_data: after.path_data !== before.path_data ? after.path_data : undefined,
        cor: after.cor !== before.cor ? after.cor : undefined,
        stroke_width: after.stroke_width !== before.stroke_width ? after.stroke_width : undefined,
      });
      if (
        isHistoryRecording() &&
        (before.path_data !== after.path_data ||
          before.cor !== after.cor ||
          before.stroke_width !== after.stroke_width)
      ) {
        pushHistory({ type: 'update', id: payload.id, before, after });
      }
    },
    [imageDrawings, activeImageId, updateDrawingRaw, pushHistory, isHistoryRecording],
  );

  const { strokes, annotations } = useMemo(
    () => splitWhiteboardDrawings(imageDrawings),
    [imageDrawings],
  );

  const [optimisticAnnotations, setOptimisticAnnotations] = useState<DecodedWhiteboardAnnotation[]>([]);
  const [autoFocusTextId, setAutoFocusTextId] = useState<string | null>(null);
  const [remapTextPayloadIds, setRemapTextPayloadIds] = useState<{ from: string; to: string } | null>(
    null,
  );
  const textLivePayloadsRef = useRef<Record<string, WhiteboardTextPayload>>({});

  const annotationsWithOptimistic = useMemo(() => {
    if (optimisticAnnotations.length === 0) return annotations;
    const byId = new Map(annotations.map((a) => [a.id, a]));
    for (const opt of optimisticAnnotations) {
      const existing = byId.get(opt.id);
      byId.set(opt.id, existing ? mergeDecodedAnnotations(existing, opt) : opt);
    }
    return Array.from(byId.values());
  }, [annotations, optimisticAnnotations]);

  const worldSize = useMemo(
    () => computePhotoWorldSize(activeImage),
    [activeImage],
  );

  const {
    view,
    screenToWorld,
    fitContent,
    zoomIn,
    zoomOut,
    endPan,
    handlePinch,
    pinchRef,
  } = useWhiteboardViewport({
    viewportRef,
    viewportEl,
    contentWidth: worldSize.width,
    contentHeight: worldSize.height,
    maxFitScale: isMobile ? 1 : undefined,
  });

  const toolsDisabled = disabled || !activeImageId;
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#e85d04');
  const [strokeWidth, setStrokeWidth] = useState(3);
  /** Recolhe a barra para liberar a área de desenho (especialmente no celular). */
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const isDrawingRef = useRef(false);
  const strokeScreenPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const viewRef = useRef(view);
  const toolRef = useRef<Tool>(tool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const [uploadingCount, setUploadingCount] = useState(0);
  const activePointerIdRef = useRef<number | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const selectedAnnotationIdRef = useRef<string | null>(null);
  const pendingTextCommitRef = useRef<Record<string, WhiteboardTextPayload>>({});
  const deleteDrawing = useCallback(
    async (id: string) => {
      if (id.startsWith('tmp-')) {
        setOptimisticAnnotations((prev) => prev.filter((a) => a.id !== id));
        delete textLivePayloadsRef.current[id];
        delete pendingTextCommitRef.current[id];
        setSelectedAnnotationId((curr) => (curr === id ? null : curr));
        return;
      }
      const drawing = drawings.find((d) => d.id === id);
      if (!drawing) {
        await deleteDrawingRaw(id);
        setOptimisticAnnotations((prev) => prev.filter((a) => a.id !== id));
        return;
      }
      await deleteDrawingRaw(id);
      setOptimisticAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (isHistoryRecording()) {
        pushHistory({ type: 'delete', drawing });
      }
    },
    [drawings, deleteDrawingRaw, pushHistory, isHistoryRecording],
  );

  const deleteLastDrawing = useCallback(async () => {
    if (!imageDrawings.length) return;
    const sorted = [...imageDrawings].sort(
      (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
    );
    const last = sorted[sorted.length - 1];
    await deleteDrawing(last.id);
  }, [imageDrawings, deleteDrawing]);

  const [pendingPolyline, setPendingPolyline] = useState<WhiteboardPoint[] | null>(null);
  const [polylinePreview, setPolylinePreview] = useState<WhiteboardPoint | null>(null);
  const [shapePreview, setShapePreview] = useState<WhiteboardAnnotationPayload | null>(null);
  const shapeDragStartRef = useRef<WhiteboardPoint | null>(null);
  /** Texto só é criado no próximo clique na lousa (não ao escolher a ferramenta). */
  const [textPlacementPending, setTextPlacementPending] = useState(false);
  const [textPlacementPreview, setTextPlacementPreview] = useState<WhiteboardPoint | null>(null);
  const [measureColor, setMeasureColor] = useState(MEASURE_COLOR_PRESETS[0].hex);
  const measureColorIndexRef = useRef(0);
  const [pendingMeasure, setPendingMeasure] = useState<PendingMeasure | null>(null);
  const [measurePreviewPoint, setMeasurePreviewPoint] = useState<WhiteboardPoint | null>(null);
  const [furnitureModuleType, setFurnitureModuleType] =
    useState<FurnitureModuleType>('armario_vazio');
  const [furnitureFamilyOpen, setFurnitureFamilyOpen] = useState<string | null>(null);
  const [pendingFurniture, setPendingFurniture] = useState<PendingFurniture | null>(null);
  const [furniturePreviewPoint, setFurniturePreviewPoint] = useState<WhiteboardPoint | null>(null);
  const suppressCanvasPointerRef = useRef(false);
  /** true enquanto o usuário segura o dedo/mouse para desenhar o móvel (soltar = fixar). */
  const furnitureDragActiveRef = useRef(false);
  const textPlaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arcAdjustDragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  useEffect(() => {
    selectedAnnotationIdRef.current = selectedAnnotationId;
  }, [selectedAnnotationId]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    colorRef.current = color;
    strokeWidthRef.current = strokeWidth;
  }, [color, strokeWidth]);

  useWhiteboardTouchLock(boardAreaEl);

  useEffect(() => {
    if (!leadId) return;
    setTool('pencil');
    setActiveImageId(null);
    setTextPlacementPending(false);
    setTextPlacementPreview(null);
    resetHistory();
  }, [leadId, resetHistory]);

  useEffect(() => {
    if (images.length === 0) {
      setActiveImageId(null);
      return;
    }
    if (!activeImageId || !images.some((img) => img.id === activeImageId)) {
      setActiveImageId(images[images.length - 1].id);
    }
  }, [images, activeImageId]);

  useEffect(() => {
    if (!activeImageId) {
      setTextPlacementPending(false);
      setTextPlacementPreview(null);
      setPendingPolyline(null);
      setPolylinePreview(null);
      setShapePreview(null);
      setPendingMeasure(null);
      setMeasurePreviewPoint(null);
      setPendingFurniture(null);
      setFurniturePreviewPoint(null);
    }
  }, [activeImageId]);

  useEffect(() => {
    return () => {
      if (textPlaceTimerRef.current) clearTimeout(textPlaceTimerRef.current);
    };
  }, []);

  const nextMeasureColor = useCallback(() => {
    measureColorIndexRef.current =
      (measureColorIndexRef.current + 1) % MEASURE_COLOR_PRESETS.length;
    const hex = MEASURE_COLOR_PRESETS[measureColorIndexRef.current].hex;
    setMeasureColor(hex);
    return hex;
  }, []);

  const finalizePendingPolyline = useCallback(async () => {
    if (!pendingPolyline || pendingPolyline.length < 2) {
      setPendingPolyline(null);
      setPolylinePreview(null);
      return;
    }
    const epochAtStart = clearEpochRef.current;
    const pointsSnapshot = [...pendingPolyline];
    setPendingPolyline(null);
    setPolylinePreview(null);
    try {
      const created = await addDrawing({
        path_data: encodeAnnotationPayload({ kind: 'polyline', points: pointsSnapshot }),
        cor: color,
        stroke_width: strokeWidth,
      });
      if (
        created?.id &&
        (clearEpochRef.current !== epochAtStart || deletedIdsRef.current.has(created.id))
      ) {
        deletedIdsRef.current.add(created.id);
        void deleteDrawingRaw(created.id);
      }
    } catch {
      /* toast no hook */
    }
  }, [pendingPolyline, color, strokeWidth, addDrawing, deleteDrawingRaw]);

  useEffect(() => {
    if (tool !== 'points') void finalizePendingPolyline();
  }, [tool, finalizePendingPolyline]);

  const selectTool = useCallback((next: Tool) => {
    if (toolsDisabled) return;
    setTool(next);
    setTextPlacementPending(next === 'text');
    setTextPlacementPreview(null);
    setPendingMeasure(null);
    setMeasurePreviewPoint(null);
    setPendingFurniture(null);
    setFurniturePreviewPoint(null);
    if (next === 'text') {
      suppressCanvasPointerRef.current = true;
      window.setTimeout(() => {
        suppressCanvasPointerRef.current = false;
      }, 400);
    }
  }, [toolsDisabled]);

  const selectFurnitureModule = useCallback(
    (moduleType: FurnitureModuleType) => {
      if (toolsDisabled) return;
      setFurnitureModuleType(moduleType);
      setPendingFurniture(null);
      setFurniturePreviewPoint(null);
      setTool('furniture');
      setFurnitureFamilyOpen(null);
    },
    [toolsDisabled],
  );

  const saveAnnotation = useCallback(
    async (payload: WhiteboardAnnotationPayload) => {
      const epochAtStart = clearEpochRef.current;
      const created = await addDrawing({
        path_data: encodeAnnotationPayload(payload),
        cor:
          payload.kind === 'measure' || payload.kind === 'furniture_module'
            ? (payload.colorHex ?? color)
            : color,
        stroke_width: strokeWidth,
      });
      if (
        created?.id &&
        (clearEpochRef.current !== epochAtStart || deletedIdsRef.current.has(created.id))
      ) {
        deletedIdsRef.current.add(created.id);
        void deleteDrawingRaw(created.id);
        return null as unknown as LeadWhiteboardDrawing;
      }
      return created;
    },
    [addDrawing, color, strokeWidth, deleteDrawingRaw],
  );

  const createMeasure = useCallback(
    async (a: WhiteboardPoint, b: WhiteboardPoint, via?: WhiteboardPoint) => {
      const dist = measureDistance(a, b, via);
      const horizontal = isNearlyHorizontal(a, b) && !via;
      const colorHex = measureColor;
      const payload: WhiteboardMeasurePayload = {
        kind: 'measure',
        a,
        b,
        via,
        label: formatMeasureValue(dist),
        colorHex,
        bidirectional: horizontal,
        showZone: horizontal,
      };
      try {
        const created = await saveAnnotation(payload);
        if (created?.id) setSelectedAnnotationId(created.id);
        nextMeasureColor();
        setTool('select');
      } catch {
        /* toast no hook */
      }
    },
    [measureColor, saveAnnotation, nextMeasureColor],
  );

  const createFurnitureModule = useCallback(
    async (a: WhiteboardPoint, b: WhiteboardPoint) => {
      const height = Math.hypot(b.x - a.x, b.y - a.y);
      if (height < FURNITURE_MIN_HEIGHT) {
        toast.message('Puxe um pouco mais para baixo para criar o móvel');
        return;
      }
      const payload: WhiteboardFurnitureModulePayload = {
        kind: 'furniture_module',
        moduleType: furnitureModuleType,
        a,
        b,
        colorHex: color,
        topDown: true,
        // Já nasce fixo no ponto onde soltou; rotação/largura seguem editáveis.
        locked: true,
        hiddenLineIndices: [],
      };
      try {
        const created = await saveAnnotation(payload);
        if (created?.id) setSelectedAnnotationId(created.id);
        setTool('select');
        toast.success('Móvel fixado — gire embaixo ou ajuste a largura pelas laterais.');
      } catch {
        /* toast no hook */
      }
    },
    [furnitureModuleType, color, saveAnnotation],
  );

  const measurePreviewPayload = useMemo((): WhiteboardMeasurePayload | null => {
    if (!pendingMeasure) return null;

    if (pendingMeasure.phase === 'pick_b') {
      if (!measurePreviewPoint) return null;
      const a = pendingMeasure.a;
      const b = measurePreviewPoint;
      const horizontal = isNearlyHorizontal(a, b) && tool === 'measure';
      return {
        kind: 'measure',
        a,
        b,
        label: formatMeasureValue(measureDistance(a, b)),
        colorHex: measureColor,
        bidirectional: horizontal,
        showZone: horizontal,
      };
    }

    if (pendingMeasure.phase === 'adjust_arc') {
      const { a, b, via } = pendingMeasure;
      return {
        kind: 'measure',
        a,
        b,
        via,
        label: formatMeasureValue(measureDistance(a, b, via)),
        colorHex: measureColor,
        bidirectional: false,
        showZone: false,
      };
    }

    return null;
  }, [pendingMeasure, measurePreviewPoint, measureColor, tool]);

  const furniturePreviewPayload = useMemo((): WhiteboardFurnitureModulePayload | null => {
    if (tool !== 'furniture' || !pendingFurniture || !furniturePreviewPoint) return null;
    return {
      kind: 'furniture_module',
      moduleType: furnitureModuleType,
      a: pendingFurniture.a,
      b: furniturePreviewPoint,
      colorHex: color,
      topDown: true,
    };
  }, [tool, pendingFurniture, furniturePreviewPoint, furnitureModuleType, color]);

  const toolStepHint = useMemo((): string | null => {
    if (tool === 'measure') {
      if (!pendingMeasure) return '1/2 — Primeira ponta';
      return '2/2 — Segunda ponta';
    }
    if (tool === 'measure_arc') {
      if (!pendingMeasure) return '1/3 — Primeira ponta';
      if (pendingMeasure.phase === 'pick_b') return '2/3 — Segunda ponta';
      return '3/3 — Ajuste a curvatura e clique para fixar';
    }
    if (tool === 'furniture') {
      if (!pendingFurniture) return '1/2 — Segure no TOPO do móvel';
      return '2/2 — Arraste para BAIXO e solte para fixar';
    }
    if (tool === 'points' && (pendingPolyline?.length ?? 0) > 0) {
      const count = pendingPolyline?.length ?? 0;
      return `${count} ponto${count === 1 ? '' : 's'} — duplo clique para finalizar`;
    }
    return null;
  }, [tool, pendingMeasure, pendingFurniture, pendingPolyline]);

  const lastCommitTimestampRef = useRef<Record<string, number>>({});
  const deletedIdsRef = useRef<Set<string>>(new Set());
  /** Incrementado em cada “Limpar desenhos” — cancela salvamentos atrasados de pontos/formas. */
  const clearEpochRef = useRef(0);

  const commitAnnotation = useCallback(
    async (
      id: string,
      payload?: WhiteboardAnnotationPayload,
      baseDrawing?: LeadWhiteboardDrawing,
    ): Promise<boolean> => {
      const resolved =
        payload ??
        textLivePayloadsRef.current[id] ??
        (() => {
          const ann = annotationsWithOptimistic.find((a) => a.id === id);
          return ann?.payload.kind === 'text' ? ann.payload : null;
        })();
      if (!resolved) return false;

      if (id.startsWith('tmp-')) {
        if (resolved.kind === 'text') {
          pendingTextCommitRef.current[id] = resolved;
          textLivePayloadsRef.current[id] = resolved;
          setOptimisticAnnotations((prev) =>
            prev.map((a) => (a.id === id ? { ...a, payload: resolved } : a)),
          );
        }
        return true;
      }

      const commitTimestamp = Date.now();
      lastCommitTimestampRef.current[id] = commitTimestamp;

      setOptimisticAnnotations((prev) => {
        const exists = prev.some((a) => a.id === id);
        if (exists) {
          return prev.map((a) => (a.id === id ? { ...a, payload: resolved } : a));
        }
        const drawing = baseDrawing ?? drawings.find((d) => d.id === id);
        if (!drawing) return prev;
        const decoded = decodeAnnotationDrawing(drawing);
        if (!decoded) return prev;
        return [...prev, { ...decoded, payload: resolved }];
      });

      try {
        await updateDrawing({ id, path_data: encodeAnnotationPayload(resolved) });
        if (resolved.kind === 'text') {
          textLivePayloadsRef.current[id] = resolved;
        }
        setTimeout(() => {
          if (lastCommitTimestampRef.current[id] === commitTimestamp) {
            setOptimisticAnnotations((prev) => prev.filter((a) => a.id !== id));
          }
        }, 1000);
        return true;
      } catch {
        return false;
      }
    },
    [annotationsWithOptimistic, updateDrawing, drawings],
  );

  const commitActiveText = useCallback(async () => {
    const id = selectedAnnotationIdRef.current;
    if (!id) return;
    await commitAnnotation(id);
    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur();
    }
  }, [commitAnnotation]);

  const handleSelectAnnotation = useCallback(
    (nextId: string | null) => {
      const prev = selectedAnnotationIdRef.current;
      if (prev && prev !== nextId) {
        void commitAnnotation(prev);
      }
      setSelectedAnnotationId(nextId);
    },
    [commitAnnotation],
  );

  const pencilTouchHelpersRef = useRef({
    beginStroke: (_cx: number, _cy: number) => {},
    extendStroke: (_cx: number, _cy: number) => {},
    finishStroke: async () => {},
  });

  const clientToViewport = (clientX: number, clientY: number) => {
    const rect = boardAreaRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const resizeDrawCanvas = useCallback(() => {
    const area = boardAreaRef.current;
    const canvas = drawCanvasRef.current;
    if (!area || !canvas) return;
    const w = area.clientWidth;
    const h = area.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const redrawDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pts = strokeScreenPointsRef.current;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    if (!pts.length) return;
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = strokeWidthRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (pts.length === 1) {
      ctx.lineTo(pts[0].x + 0.01, pts[0].y);
    }
    ctx.stroke();
  }, []);

  const clearStrokePreview = useCallback(() => {
    strokeScreenPointsRef.current = [];
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }, []);

  const clearDrawings = useCallback(async () => {
    const snapshot = [...imageDrawings];
    const hasEphemeral =
      optimisticAnnotations.length > 0 ||
      pendingPolyline !== null ||
      shapePreview !== null ||
      pendingMeasure !== null ||
      pendingFurniture !== null ||
      isDrawingRef.current;

    if (snapshot.length === 0 && !hasEphemeral) return;

    // Cancela qualquer salvamento de pontos/formas ainda em andamento.
    clearEpochRef.current += 1;

    // Marca tudo como “já apagado” para salvamentos atrasados não recolocarem os pontos.
    for (const d of snapshot) {
      deletedIdsRef.current.add(d.id);
    }
    for (const opt of optimisticAnnotations) {
      deletedIdsRef.current.add(opt.id);
    }

    // Limpa a tela na hora (pontos pendentes, prévias, textos locais).
    setOptimisticAnnotations([]);
    setSelectedAnnotationId(null);
    setAutoFocusTextId(null);
    setRemapTextPayloadIds(null);
    setPendingPolyline(null);
    setPolylinePreview(null);
    setShapePreview(null);
    shapeDragStartRef.current = null;
    setPendingMeasure(null);
    setMeasurePreviewPoint(null);
    setPendingFurniture(null);
    setFurniturePreviewPoint(null);
    setTextPlacementPending(false);
    setTextPlacementPreview(null);
    textLivePayloadsRef.current = {};
    pendingTextCommitRef.current = {};
    isDrawingRef.current = false;
    clearStrokePreview();

    if (isHistoryRecording() && snapshot.length > 0) {
      pushHistory({ type: 'clear', drawings: snapshot });
    }

    if (snapshot.length > 0) {
      await clearDrawingsRaw(snapshot.map((d) => d.id));
    }
  }, [
    imageDrawings,
    optimisticAnnotations,
    pendingPolyline,
    shapePreview,
    pendingMeasure,
    pendingFurniture,
    clearDrawingsRaw,
    pushHistory,
    isHistoryRecording,
    clearStrokePreview,
  ]);

  const discardEphemeralWork = useCallback(() => {
    setPendingPolyline(null);
    setPolylinePreview(null);
    setShapePreview(null);
    shapeDragStartRef.current = null;
    setPendingMeasure(null);
    setMeasurePreviewPoint(null);
    setPendingFurniture(null);
    setFurniturePreviewPoint(null);
    setTextPlacementPending(false);
    setTextPlacementPreview(null);
    isDrawingRef.current = false;
    clearStrokePreview();
  }, [clearStrokePreview]);

  const saveDisabledReason = useMemo(() => {
    if (!leadId) return 'Salve o lead antes';
    if (disabled) return 'Edição desabilitada';
    if (!canUploadAttachment) return 'Sem permissão para anexar arquivos';
    if (!isOnline) return 'Conecte-se à internet para salvar nos anexos';
    if (!activeImage) return 'Insira uma foto na lousa antes de salvar';
    if (isSavingAttachment) return 'Salvando…';
    return undefined;
  }, [
    leadId,
    disabled,
    canUploadAttachment,
    isOnline,
    activeImage,
    isSavingAttachment,
  ]);

  const canSaveToAttachments = !saveDisabledReason;

  useEffect(() => {
    onSaveStateChange?.({
      canSave: canSaveToAttachments,
      isSaving: isSavingAttachment,
      disabledReason: saveDisabledReason,
    });
  }, [canSaveToAttachments, isSavingAttachment, saveDisabledReason, onSaveStateChange]);

  const saveToAttachments = useCallback(async () => {
    if (!leadId || !activeImage || !canSaveToAttachments) return;

    setIsSavingAttachment(true);
    try {
      // Descarta só rascunhos incompletos (ainda não gravados).
      discardEphemeralWork();

      // Monta a lista final da foto ativa, aplicando edições otimistas (ex.: móvel girado).
      const drawingsById = new Map(
        filterDrawingsByImage(drawings, activeImage.id, legacyFallbackImageId).map((d) => [d.id, d]),
      );
      for (const opt of optimisticAnnotations) {
        if (opt.id.startsWith('tmp-')) continue;
        const existing = drawingsById.get(opt.id);
        if (!existing) continue;
        drawingsById.set(opt.id, {
          ...existing,
          path_data: bindDrawingToImage(activeImage.id, encodeAnnotationPayload(opt.payload)),
          cor: opt.cor || existing.cor,
          stroke_width: opt.stroke_width || existing.stroke_width,
        });
      }
      const drawingsToExport = Array.from(drawingsById.values());

      const file = await buildWhiteboardAttachmentFile({
        image: activeImage,
        drawings: drawingsToExport,
        leadId,
        // Já filtramos pela foto ativa; unbound legados ficam vinculados a ela.
        legacyFallbackImageId: activeImage.id,
      });

      await uploadPDF(file);
      await clearWhiteboard();

      setActiveImageId(null);
      setOptimisticAnnotations([]);
      setSelectedAnnotationId(null);
      setAutoFocusTextId(null);
      setRemapTextPayloadIds(null);
      textLivePayloadsRef.current = {};
      pendingTextCommitRef.current = {};
      resetHistory();

      toast.success('Foto com desenhos salva nos anexos. A lousa foi limpa para um novo trabalho.');
    } catch (error) {
      toast.error('Não foi possível salvar a lousa', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSavingAttachment(false);
    }
  }, [
    leadId,
    activeImage,
    canSaveToAttachments,
    discardEphemeralWork,
    drawings,
    optimisticAnnotations,
    legacyFallbackImageId,
    uploadPDF,
    clearWhiteboard,
    resetHistory,
  ]);

  useImperativeHandle(ref, () => ({ saveToAttachments }), [saveToAttachments]);

  const handleImportFromProject = useCallback(
    async (midia: LeadMidiaDisponivel) => {
      if (!leadId || disabled) return;
      setIsImportingFromProject(true);
      try {
        const boardWidth = boardAreaRef.current?.clientWidth ?? 800;
        const created = await importImageFromUrl({
          fileUrl: midia.file_url,
          fileName: midia.file_name,
          boardWidth,
        });
        if (created) {
          setActiveImageId(created.id);
          setProjectPickerOpen(false);
        }
      } finally {
        setIsImportingFromProject(false);
      }
    },
    [leadId, disabled, importImageFromUrl],
  );

  const undoEphemeralStep = useCallback((): boolean => {
    if (toolRef.current === 'points' && pendingPolyline && pendingPolyline.length > 0) {
      const next = pendingPolyline.slice(0, -1);
      setPendingPolyline(next.length > 0 ? next : null);
      if (next.length === 0) setPolylinePreview(null);
      return true;
    }

    if (toolRef.current === 'measure_arc' && pendingMeasure) {
      if (pendingMeasure.phase === 'adjust_arc') {
        setPendingMeasure({ phase: 'pick_b', a: pendingMeasure.a });
        setMeasurePreviewPoint(pendingMeasure.b);
        return true;
      }
      setPendingMeasure(null);
      setMeasurePreviewPoint(null);
      return true;
    }

    if (toolRef.current === 'measure' && pendingMeasure?.phase === 'pick_b') {
      setPendingMeasure(null);
      setMeasurePreviewPoint(null);
      return true;
    }

    if (toolRef.current === 'furniture' && pendingFurniture) {
      furnitureDragActiveRef.current = false;
      setPendingFurniture(null);
      setFurniturePreviewPoint(null);
      return true;
    }

    if (
      (toolRef.current === 'rect' ||
        toolRef.current === 'ellipse' ||
        toolRef.current === 'line') &&
      (shapePreview || shapeDragStartRef.current)
    ) {
      setShapePreview(null);
      shapeDragStartRef.current = null;
      return true;
    }

    if (toolRef.current === 'pencil' && isDrawingRef.current) {
      isDrawingRef.current = false;
      clearStrokePreview();
      return true;
    }

    return false;
  }, [pendingPolyline, pendingMeasure, pendingFurniture, shapePreview, clearStrokePreview]);

  const handleUndo = useCallback(async () => {
    if (undoEphemeralStep()) return;
    await undoHistory();
  }, [undoEphemeralStep, undoHistory]);

  const handleDeleteLast = useCallback(async () => {
    if (undoEphemeralStep()) return;
    await deleteLastDrawing();
  }, [undoEphemeralStep, deleteLastDrawing]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) {
          void redoHistory();
        } else {
          void handleUndo();
        }
        return;
      }
      if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        void redoHistory();
        return;
      }
      if (ev.key === 'Escape') {
        setPendingPolyline(null);
        setPolylinePreview(null);
        setShapePreview(null);
        setPendingMeasure(null);
        setMeasurePreviewPoint(null);
        setPendingFurniture(null);
        setFurniturePreviewPoint(null);
        furnitureDragActiveRef.current = false;
        shapeDragStartRef.current = null;
        if (textPlacementPending) {
          setTextPlacementPending(false);
          setTextPlacementPreview(null);
          setTool('select');
        }
        if (tool === 'furniture') {
          setTool('select');
        }
      }
      if (ev.key === 'Enter' && tool === 'points') void finalizePendingPolyline();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, finalizePendingPolyline, textPlacementPending, handleUndo, redoHistory]);

  /** Prévia em coordenadas da tela (cobre todo o viewport); ao salvar converte para o mundo. */
  const beginStroke = (clientX: number, clientY: number) => {
    const p = clientToViewport(clientX, clientY);
    if (!p) return;
    isDrawingRef.current = true;
    strokeScreenPointsRef.current = [p];
    setToolbarCollapsed(true);
    redrawDrawCanvas();
  };

  const extendStroke = (clientX: number, clientY: number) => {
    if (!isDrawingRef.current || toolRef.current !== 'pencil') return;
    const p = clientToViewport(clientX, clientY);
    if (!p) return;
    const pts = strokeScreenPointsRef.current;
    const last = pts[pts.length - 1];
    if (last && last.x === p.x && last.y === p.y) return;
    pts.push(p);
    redrawDrawCanvas();
  };

  const finishStroke = async () => {
    if (!isDrawingRef.current || toolRef.current !== 'pencil') {
      isDrawingRef.current = false;
      clearStrokePreview();
      return;
    }
    const pts = [...strokeScreenPointsRef.current];
    isDrawingRef.current = false;
    clearStrokePreview();
    if (pts.length < 2) return;
    const path = screenPointsToWorldPath(pts, viewRef.current);
    if (!path || path.length < 4) return;
    const epochAtStart = clearEpochRef.current;
    try {
      const created = await addDrawing({ path_data: path, cor: color, stroke_width: strokeWidth });
      if (
        created?.id &&
        (clearEpochRef.current !== epochAtStart || deletedIdsRef.current.has(created.id))
      ) {
        deletedIdsRef.current.add(created.id);
        void deleteDrawingRaw(created.id);
      }
    } catch {
      /* toast no hook */
    }
  };

  pencilTouchHelpersRef.current = { beginStroke, extendStroke, finishStroke };

  /** Pinça com 2 dedos: zoom (e pan leve) em qualquer ferramenta, inclusive lápis no celular. */
  useEffect(() => {
    const area = boardAreaEl;
    if (!area) return;

    const getRect = () =>
      viewportRef.current?.getBoundingClientRect() ?? area.getBoundingClientRect();

    const abortStrokeForPinch = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      clearStrokePreview();
    };

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length < 2) return;
      ev.preventDefault();
      ev.stopPropagation();
      abortStrokeForPinch();
      handlePinch(ev.touches, getRect());
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length < 2 && !pinchRef.current) return;
      if (ev.touches.length < 2) return;
      ev.preventDefault();
      ev.stopPropagation();
      abortStrokeForPinch();
      handlePinch(ev.touches, getRect());
    };

    const onTouchEnd = (ev: TouchEvent) => {
      if (!pinchRef.current) return;
      if (ev.touches.length < 2) endPan();
    };

    area.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    area.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    area.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
    area.addEventListener('touchcancel', onTouchEnd, { passive: false, capture: true });

    return () => {
      area.removeEventListener('touchstart', onTouchStart, true);
      area.removeEventListener('touchmove', onTouchMove, true);
      area.removeEventListener('touchend', onTouchEnd, true);
      area.removeEventListener('touchcancel', onTouchEnd, true);
    };
  }, [boardAreaEl, handlePinch, endPan, clearStrokePreview, pinchRef]);

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const onTouchStart = (ev: TouchEvent) => {
      if (toolsDisabled || !leadId || toolRef.current !== 'pencil') return;
      if (ev.touches.length !== 1) return;
      if (pinchRef.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      const t = ev.touches[0];
      pencilTouchHelpersRef.current.beginStroke(t.clientX, t.clientY);
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (toolRef.current !== 'pencil' || !isDrawingRef.current) return;
      if (ev.touches.length !== 1) return;
      if (pinchRef.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      const t = ev.touches[0];
      pencilTouchHelpersRef.current.extendStroke(t.clientX, t.clientY);
    };

    const onTouchDone = async (ev: TouchEvent) => {
      if (!isDrawingRef.current) return;
      // Se ainda há outro dedo (fim de pinça), não grava o traço abortado.
      if (ev.touches.length > 0 || pinchRef.current) {
        isDrawingRef.current = false;
        clearStrokePreview();
        return;
      }
      ev.stopPropagation();
      await pencilTouchHelpersRef.current.finishStroke();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchDone, { passive: false });
    canvas.addEventListener('touchcancel', onTouchDone, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchDone);
      canvas.removeEventListener('touchcancel', onTouchDone);
    };
  }, [boardAreaEl, toolsDisabled, leadId, clearStrokePreview, pinchRef]);

  useEffect(() => {
    const area = boardAreaEl;
    if (!area) return;
    resizeDrawCanvas();
    const ro = new ResizeObserver(() => {
      resizeDrawCanvas();
      if (isDrawingRef.current) redrawDrawCanvas();
    });
    ro.observe(area);
    return () => ro.disconnect();
  }, [boardAreaEl, resizeDrawCanvas, redrawDrawCanvas]);

  useLayoutEffect(() => {
    if (!isFullscreenLayout) return;
    resizeDrawCanvas();
  }, [isFullscreenLayout, boardAreaEl, resizeDrawCanvas]);

  const zoomPercent = Math.round(view.scale * 100);

  useEffect(() => {
    if (activeImage) {
      const t = requestAnimationFrame(() => fitContent(16));
      return () => cancelAnimationFrame(t);
    }
  }, [activeImage?.id, worldSize.width, worldSize.height, fitContent, activeImage]);

  useEffect(() => {
    if (!isFullscreenLayout || !viewportEl) return;

    if (isMobile) {
      // iOS muda a altura da tela ao abrir (barra do Safari) — evita vários reajustes de zoom.
      const raf = requestAnimationFrame(() => fitContent(16));
      const timer = window.setTimeout(() => fitContent(16), 400);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitContent(16));
    });
    ro.observe(viewportEl);
    requestAnimationFrame(() => fitContent(16));
    return () => ro.disconnect();
  }, [isFullscreenLayout, viewportEl, fitContent, activeImage?.id, isMobile]);

  const handleUploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => isLikelyImageFile(f));
    if (!list.length) {
      toast.error('Nenhuma imagem válida selecionada', {
        description: 'No tablet, use JPG/PNG ou tire a foto pela câmera do aparelho.',
      });
      return;
    }
    const boardWidth = viewportRef.current?.clientWidth ?? 800;
    setUploadingCount(list.length);
    try {
      for (let i = 0; i < list.length; i++) {
        await uploadImage(list[i], boardWidth, i);
      }
      if (list.length > 1) {
        requestAnimationFrame(() => fitContent(24));
      }
    } finally {
      setUploadingCount(0);
    }
  };

  const openGalleryPicker = () => {
    const input = galleryInputRef.current;
    if (!input || disabled || uploadingCount > 0) return;
    input.value = '';
    const picker = input as HTMLInputElement & { showPicker?: () => void };
    try {
      if (typeof picker.showPicker === 'function') {
        picker.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  };

  const capturePointer = (e: React.PointerEvent) => {
    activePointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const releasePointer = (e: React.PointerEvent) => {
    if (activePointerIdRef.current === e.pointerId) {
      activePointerIdRef.current = null;
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* já liberado */
    }
  };

  const handleDrawPointerDown = (e: React.PointerEvent) => {
    if (toolsDisabled || !leadId || tool !== 'pencil') return;
    e.stopPropagation();
    if (e.pointerType === 'touch') return;
    capturePointer(e);
    beginStroke(e.clientX, e.clientY);
  };

  const handleDrawPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    if (!isDrawingRef.current || tool !== 'pencil') return;
    appendStrokePoints(e);
  };

  const handleDrawPointerUp = async (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    releasePointer(e);
    if (isDrawingRef.current && tool === 'pencil') {
      await finishStroke();
    }
  };

  const placeTextAt = useCallback(
    async (world: WhiteboardPoint) => {
      const tempId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `tmp-${crypto.randomUUID()}`
          : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const payload: WhiteboardAnnotationPayload = {
        kind: 'text',
        x: world.x - 80,
        y: world.y - 20,
        w: 160,
        h: 48,
        rotation: 0,
        text: '',
        fontSize: textFontSizePx,
      };

      // Mostra imediatamente (sem esperar rede).
      const nowIso = new Date().toISOString();
      setOptimisticAnnotations((prev) => [
        ...prev,
        {
          id: tempId,
          lead_id: leadId as number,
          cor: colorRef.current,
          stroke_width: strokeWidthRef.current,
          criado_em: nowIso,
          payload,
        },
      ]);
      setSelectedAnnotationId(tempId);
      setAutoFocusTextId(tempId);
      setTextPlacementPending(false);
      setTextPlacementPreview(null);
      setTool('select');

      // Salva em segundo plano; mantém a caixa visível e migra o texto digitado para o id real.
      void (async () => {
        try {
          const created = await saveAnnotation(payload);
          
          if (deletedIdsRef.current.has(tempId)) {
            deletedIdsRef.current.add(created.id);
            void deleteDrawingRaw(created.id);
            return;
          }

          const pending = pendingTextCommitRef.current[tempId];
          delete pendingTextCommitRef.current[tempId];
          const live = textLivePayloadsRef.current[tempId];
          const mergedPayload: WhiteboardTextPayload =
            pending ?? (live?.kind === 'text' ? live : (payload as WhiteboardTextPayload));
          const decoded = decodeAnnotationDrawing(created);

          if (decoded) {
            delete textLivePayloadsRef.current[tempId];
            textLivePayloadsRef.current[created.id] = mergedPayload;
            
            setOptimisticAnnotations((prev) =>
              prev.map((a) =>
                a.id === tempId
                  ? { ...decoded, id: created.id, payload: mergedPayload }
                  : a,
              ),
            );
          }

          setRemapTextPayloadIds({ from: tempId, to: created.id });
          setSelectedAnnotationId((curr) => (curr === tempId ? created.id : curr));
          setAutoFocusTextId((curr) => (curr === tempId ? created.id : curr));

          // Importante: Passamos o "created" (desenho real) para que o commitAnnotation
          // não dependa de um refetch do cache que pode ainda não ter acontecido nesta closure.
          await commitAnnotation(created.id, mergedPayload, created);
        } catch {
          setOptimisticAnnotations((prev) => prev.filter((a) => a.id !== tempId));
          delete textLivePayloadsRef.current[tempId];
          setSelectedAnnotationId((curr) => (curr === tempId ? null : curr));
          setAutoFocusTextId((curr) => (curr === tempId ? null : curr));
        }
      })();
    },
    [saveAnnotation, textFontSizePx, leadId, commitAnnotation, deleteDrawingRaw],
  );

  const commitTextFontSize = useCallback(
    (size: number) => {
      const clamped = Math.min(
        WHITEBOARD_FONT_SIZE_MAX,
        Math.max(WHITEBOARD_FONT_SIZE_MIN, Math.round(size)),
      );
      setTextFontSizePx(clamped);
      if (isAdmin) {
        void saveConfig.mutateAsync({
          fontFamily: textConfig.fontFamily,
          fontSizePx: clamped,
          textColorHex,
        });
      }
    },
    [isAdmin, saveConfig, textConfig.fontFamily, textColorHex],
  );

  const commitTextColorHex = useCallback(
    (hex: string) => {
      setTextColorHex(hex);
      if (isAdmin) {
        void saveConfig.mutateAsync({
          fontFamily: textConfig.fontFamily,
          fontSizePx: textFontSizePx,
          textColorHex: hex,
        });
      }
    },
    [isAdmin, saveConfig, textConfig.fontFamily, textFontSizePx],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || !leadId || !activeImageId) return;
    if ((e.target as HTMLElement).closest('[data-whiteboard-toolbar]')) return;
    if (suppressCanvasPointerRef.current) return;

    const clickedText = (e.target as HTMLElement).closest('[data-whiteboard-text]');
    const clickedMeasure = (e.target as HTMLElement).closest('[data-whiteboard-measure]');
    const clickedFurniture = (e.target as HTMLElement).closest('[data-whiteboard-furniture]');
    if (!clickedText && !clickedMeasure && !clickedFurniture && tool === 'select') {
      void commitActiveText();
      if (selectedAnnotationIdRef.current) setSelectedAnnotationId(null);
    }

    if (toolsDisabled) return;
    e.stopPropagation();
    if (tool === 'pencil') return;

    if (tool === 'select' || tool === 'eraser') return;

    if (tool === 'furniture') {
      const world = screenToWorld(e.clientX, e.clientY);
      if (!pendingFurniture) {
        setPendingFurniture({ a: world });
        setFurniturePreviewPoint(world);
        furnitureDragActiveRef.current = true;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* no-op */
        }
        return;
      }
      // Fallback: 2º clique (quando o 1º foi só um toque curto)
      furnitureDragActiveRef.current = false;
      void createFurnitureModule(pendingFurniture.a, world);
      setPendingFurniture(null);
      setFurniturePreviewPoint(null);
      return;
    }

    if (tool === 'measure' || tool === 'measure_arc') {
      const world = screenToWorld(e.clientX, e.clientY);
      if (!pendingMeasure) {
        setPendingMeasure({ phase: 'pick_b', a: world });
        setMeasurePreviewPoint(world);
        return;
      }
      if (tool === 'measure' && pendingMeasure.phase === 'pick_b') {
        void createMeasure(pendingMeasure.a, world);
        setPendingMeasure(null);
        setMeasurePreviewPoint(null);
        return;
      }
      if (tool === 'measure_arc' && pendingMeasure.phase === 'pick_b') {
        const via = arcViaPoint(pendingMeasure.a, world);
        setPendingMeasure({
          phase: 'adjust_arc',
          a: pendingMeasure.a,
          b: world,
          via,
        });
        setMeasurePreviewPoint(via);
        return;
      }
      if (tool === 'measure_arc' && pendingMeasure.phase === 'adjust_arc') {
        void createMeasure(pendingMeasure.a, pendingMeasure.b, pendingMeasure.via);
        setPendingMeasure(null);
        setMeasurePreviewPoint(null);
        return;
      }
      return;
    }

    if (tool === 'points') {
      const world = screenToWorld(e.clientX, e.clientY);
      setPendingPolyline((prev) => (prev ? [...prev, world] : [world]));
      return;
    }

    if (tool === 'text' && textPlacementPending) {
      const world = screenToWorld(e.clientX, e.clientY);
      if (textPlaceTimerRef.current) {
        clearTimeout(textPlaceTimerRef.current);
        textPlaceTimerRef.current = null;
      }
      void placeTextAt(world);
      return;
    }

    if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
      capturePointer(e);
      shapeDragStartRef.current = screenToWorld(e.clientX, e.clientY);
      return;
    }
  };

  const appendStrokePoints = (e: React.PointerEvent) => {
    const events =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [e.nativeEvent];
    for (const ev of events) {
      extendStroke(ev.clientX, ev.clientY);
    }
  };

  const handleViewportDoubleClick = (e: React.MouseEvent) => {
    if (disabled || !leadId) return;
    if ((e.target as HTMLElement).closest('[data-whiteboard-toolbar]')) return;
    e.stopPropagation();
    if (textPlaceTimerRef.current) {
      clearTimeout(textPlaceTimerRef.current);
      textPlaceTimerRef.current = null;
    }
    if (tool === 'points') {
      e.preventDefault();
      if ((pendingPolyline?.length ?? 0) >= 2) void finalizePendingPolyline();
      else {
        setPendingPolyline(null);
        setPolylinePreview(null);
      }
      setTool('select');
      return;
    }
    if (!isMobile) fitContent(24);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    if (tool === 'pencil') return;

    if (tool === 'text' && textPlacementPending) {
      setTextPlacementPreview(screenToWorld(e.clientX, e.clientY));
      return;
    }

    if (tool === 'points' && pendingPolyline?.length) {
      setPolylinePreview(screenToWorld(e.clientX, e.clientY));
      return;
    }

    if ((tool === 'measure' || tool === 'measure_arc') && pendingMeasure) {
      const world = screenToWorld(e.clientX, e.clientY);
      setMeasurePreviewPoint(world);
      if (tool === 'measure_arc' && pendingMeasure.phase === 'adjust_arc') {
        setPendingMeasure({ ...pendingMeasure, via: world });
      }
      return;
    }

    if (tool === 'furniture' && pendingFurniture) {
      setFurniturePreviewPoint(screenToWorld(e.clientX, e.clientY));
      return;
    }

    const shapeStart = shapeDragStartRef.current;
    if (shapeStart && (tool === 'rect' || tool === 'ellipse' || tool === 'line')) {
      const world = screenToWorld(e.clientX, e.clientY);
      if (tool === 'line') {
        setShapePreview({
          kind: 'line',
          a: shapeStart,
          b: world,
        });
        return;
      }
      const x = Math.min(shapeStart.x, world.x);
      const y = Math.min(shapeStart.y, world.y);
      const w = Math.abs(world.x - shapeStart.x);
      const h = Math.abs(world.y - shapeStart.y);
      if (tool === 'rect') {
        setShapePreview({ kind: 'rect', x, y, w, h, rotation: 0 });
      } else {
        setShapePreview({
          kind: 'ellipse',
          cx: (shapeStart.x + world.x) / 2,
          cy: (shapeStart.y + world.y) / 2,
          rx: Math.max(w / 2, 2),
          ry: Math.max(h / 2, 2),
          rotation: 0,
        });
      }
      return;
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    releasePointer(e);

    // Móvel 3D: soltar o dedo/mouse fixa o desenho onde soltou
    if (tool === 'furniture' && pendingFurniture && furnitureDragActiveRef.current) {
      furnitureDragActiveRef.current = false;
      const b = furniturePreviewPoint ?? screenToWorld(e.clientX, e.clientY);
      const height = Math.hypot(b.x - pendingFurniture.a.x, b.y - pendingFurniture.a.y);
      if (height >= FURNITURE_MIN_HEIGHT) {
        void createFurnitureModule(pendingFurniture.a, b);
        setPendingFurniture(null);
        setFurniturePreviewPoint(null);
        return;
      }
      // Toque curto: mantém o 1º ponto e espera o 2º clique/arraste
      return;
    }

    if (tool === 'pencil') return;

    const shapeStart = shapeDragStartRef.current;
    if (shapeStart && (tool === 'rect' || tool === 'ellipse' || tool === 'line') && shapePreview) {
      const valid =
        (shapePreview.kind === 'rect' && shapePreview.w > 6 && shapePreview.h > 6) ||
        (shapePreview.kind === 'ellipse' && shapePreview.rx > 4 && shapePreview.ry > 4) ||
        (shapePreview.kind === 'line' &&
          Math.hypot(shapePreview.b.x - shapePreview.a.x, shapePreview.b.y - shapePreview.a.y) > 6);
      if (valid) {
        try {
          await saveAnnotation(shapePreview);
        } catch {
          /* hook */
        }
      }
      shapeDragStartRef.current = null;
      setShapePreview(null);
      return;
    }

    if (pinchRef.current) {
      endPan();
      return;
    }

    isDrawingRef.current = false;
    clearStrokePreview();
  };

  const handleEraserClick = async (drawingId: string) => {
    if (tool !== 'eraser') return;
    try {
      await deleteDrawing(drawingId);
    } catch {
      /* handled in hook */
    }
  };

  if (!leadId) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-primary/25 bg-gradient-to-br from-muted/40 to-background p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        Salve o lead primeiro para inserir e editar fotos.
      </div>
    );
  }

  const toolBtnClass = isMobile ? 'h-11 w-11' : 'h-8 w-8';

  return (
    <div
      className={cn(
        'min-h-0 w-full',
        isFullscreenLayout
          ? cn('relative flex-1 min-h-0 overflow-hidden', className)
          : cn('flex flex-col space-y-2', className),
      )}
    >
      {/* Área da foto */}
      <div
        ref={bindBoardAreaRef}
        data-whiteboard-viewport
        className={cn(
          'min-w-0 select-none overscroll-none',
          isFullscreenLayout ? 'absolute inset-0' : 'relative w-full max-h-[min(52vh,420px)] order-1',
        )}
        style={isFullscreenLayout ? undefined : { minHeight: Math.min(minHeight, 320) }}
      >
        <div
          ref={bindViewportRef}
          role="application"
          aria-label="Área de edição da foto"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleViewportDoubleClick}
          className={cn(
            'absolute inset-0 overflow-hidden bg-muted/20',
            isFullscreenLayout ? '' : 'rounded-xl border border-border/60 shadow-inner',
            tool === 'eraser' && 'cursor-cell',
            tool === 'text' && textPlacementPending && 'cursor-crosshair',
            (tool === 'rect' || tool === 'ellipse' || tool === 'line') && 'cursor-crosshair',
            tool === 'points' && 'cursor-crosshair',
            (tool === 'measure' || tool === 'measure_arc' || tool === 'furniture') && 'cursor-crosshair',
          )}
          style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => void handlePointerUp(e)}
          onPointerLeave={(e) => void handlePointerUp(e)}
          onPointerCancel={(e) => void handlePointerUp(e)}
        >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-30 pointer-events-none">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {textPlacementPending && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-3">
            <div className="rounded-full border border-amber-500/40 bg-amber-50/95 px-4 py-1.5 text-xs font-medium text-amber-900 shadow-sm backdrop-blur-sm dark:bg-amber-950/90 dark:text-amber-100">
              Clique na foto para posicionar a caixa de texto
            </div>
          </div>
        )}

        {canUploadAttachment && isFullscreenLayout && (
          <div className="absolute z-[9600] pointer-events-auto top-3 right-3">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className={cn(
                      'shadow-md border border-border/80 bg-background/95 backdrop-blur-sm',
                      isMobile ? 'h-11 w-11' : 'h-9 w-9',
                    )}
                    disabled={!canSaveToAttachments}
                    aria-label="Salvar nos anexos"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      void saveToAttachments();
                    }}
                  >
                    {isSavingAttachment ? (
                      <Loader2 className={cn('animate-spin', isMobile ? 'h-5 w-5' : 'h-4 w-4')} />
                    ) : (
                      <Save className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {saveDisabledReason ?? 'Salvar nos anexos'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {pendingMeasure && (tool === 'measure' || tool === 'measure_arc') && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-3">
            <div
              className="rounded-full border px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
              style={{ borderColor: measureColor, backgroundColor: `${measureColor}E6` }}
            >
              {tool === 'measure'
                ? 'Clique o 2º ponto para finalizar a medição'
                : !pendingMeasure.b
                  ? 'Arco: clique o 2º ponto (final)'
                  : 'Arco: clique onde a linha deve curvar'}
            </div>
          </div>
        )}

        {tool === 'furniture' && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-3">
            <div className="rounded-full border border-amber-700/40 bg-amber-950/85 px-4 py-1.5 text-xs font-semibold text-amber-50 shadow-lg backdrop-blur-sm">
              {pendingFurniture
                ? 'Arraste até a base e solte para fixar o móvel'
                : 'Segure no topo do móvel e puxe para baixo'}
            </div>
          </div>
        )}

        {textPlacementPending && textPlacementPreview && (
          <div
            className="pointer-events-none absolute z-[9050] rounded-md border-2 border-dashed border-amber-500/70 bg-white/80 shadow-sm dark:bg-card/80"
            style={{
              left: view.x + textPlacementPreview.x * view.scale - 80 * view.scale,
              top: view.y + textPlacementPreview.y * view.scale - 20 * view.scale,
              width: 160 * view.scale,
              height: 48 * view.scale,
              minWidth: 48,
              minHeight: 24,
            }}
          />
        )}

        {activeImage && (
        <div
          className="absolute left-0 top-0 will-change-transform pointer-events-none"
          style={{
            width: worldSize.width,
            height: worldSize.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <img
            key={activeImage.id}
            src={activeImage.file_url}
            alt={activeImage.file_name}
            draggable={false}
            decoding="async"
            className="absolute left-0 top-0 h-full w-full object-contain pointer-events-none"
            style={{
              width: worldSize.width,
              height: worldSize.height,
              zIndex: 1,
            }}
          />

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            width={worldSize.width}
            height={worldSize.height}
            overflow="visible"
            style={{ zIndex: 9000 }}
          >
            <g style={{ pointerEvents: tool === 'eraser' && !toolsDisabled ? 'auto' : 'none' }}>
              {strokes.map((d) => (
                <path
                  key={d.id}
                  d={getDrawingPathData(d.path_data)}
                  stroke={d.cor}
                  strokeWidth={Math.max(d.stroke_width, tool === 'eraser' ? 12 : d.stroke_width)}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className={cn(
                    tool === 'eraser' &&
                      !toolsDisabled &&
                      'hover:stroke-red-500 cursor-pointer touch-manipulation',
                  )}
                  onPointerDown={(e) => {
                    if (tool !== 'eraser' || toolsDisabled) return;
                    e.stopPropagation();
                    void handleEraserClick(d.id);
                  }}
                />
              ))}
            </g>
          </svg>

          <WhiteboardAnnotationsLayer
            annotations={annotationsWithOptimistic}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            textFontFamily={textConfig.fontFamily}
            textColorHex={textColorHex}
            disabled={disabled}
            contentLocked={toolsDisabled}
            worldWidth={worldSize.width}
            worldHeight={worldSize.height}
            selectedAnnotationId={selectedAnnotationId}
            autoFocusTextId={autoFocusTextId}
            onAutoFocusDone={() => setAutoFocusTextId(null)}
            remapTextPayloadIds={remapTextPayloadIds}
            onRemapTextPayloadIdsDone={() => setRemapTextPayloadIds(null)}
            onTextPayloadLiveChange={(id, textPayload) => {
              textLivePayloadsRef.current[id] = textPayload;
            }}
            pendingPolyline={pendingPolyline}
            polylinePreview={polylinePreview}
            shapePreview={shapePreview}
            measurePreview={measurePreviewPayload}
            furniturePreview={furniturePreviewPayload}
            onSelectAnnotation={handleSelectAnnotation}
            onCommitAnnotation={commitAnnotation}
            onDeleteAnnotation={deleteDrawing}
            screenToWorld={screenToWorld}
          />
        </div>
        )}

        {!activeImage && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4 p-6 z-10">
            <div className="rounded-2xl bg-primary/10 p-4">
              <ImageIcon className="h-10 w-10 text-primary/70" />
            </div>
            <p className="text-sm text-center max-w-xs font-medium">
              Insira uma foto para medir, anotar e desenhar como no PhotoMeasure.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-2"
                disabled={disabled || uploadingCount > 0}
                onClick={() => openGalleryPicker()}
              >
                {uploadingCount > 0 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Inserir foto
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={disabled || uploadingCount > 0}
                onClick={() => cameraCaptureRef.current?.requestCapture()}
              >
                <Camera className="h-4 w-4" />
                Tirar foto
              </Button>
              {!!leadId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={disabled || uploadingCount > 0 || isImportingFromProject}
                  onClick={() => setProjectPickerOpen(true)}
                >
                  {isImportingFromProject ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                  Do projeto
                </Button>
              )}
            </div>
          </div>
        )}
        </div>

        <canvas
          ref={drawCanvasRef}
          aria-hidden
          className={cn(
            'absolute inset-0 z-[9300] touch-none',
            tool === 'pencil' && activeImageId ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none',
          )}
          onPointerDown={handleDrawPointerDown}
          onPointerMove={handleDrawPointerMove}
          onPointerUp={(e) => void handleDrawPointerUp(e)}
          onPointerLeave={(e) => void handleDrawPointerUp(e)}
          onPointerCancel={(e) => void handleDrawPointerUp(e)}
        />
      </div>

      {/* Barra de ferramentas — aparece abaixo da foto para editar */}
      <div
        data-whiteboard-toolbar
        className={cn(
          'flex flex-wrap items-center gap-1.5 sm:gap-2 p-2 rounded-xl border border-border/80 shadow-sm shrink-0',
          isFullscreenLayout
            ? 'absolute inset-x-2 bottom-2 z-[9500] bg-[hsl(var(--card))]/95 backdrop-blur-sm'
            : 'bg-[hsl(var(--card))] order-2',
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {toolbarCollapsed ? (
          <TooltipProvider delayDuration={200}>
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="default"
                      className={toolBtnClass}
                      aria-label="Expandir ferramentas"
                      onClick={() => setToolbarCollapsed(false)}
                    >
                      <ChevronUp className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mostrar ferramentas</TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground truncate">
                  Ferramentas recolhidas — pinça com 2 dedos para zoom
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isOnline ? (
                  <Cloud className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <CloudOff className="h-4 w-4 text-red-500 animate-pulse mr-1" />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className={toolBtnClass}
                  onClick={zoomOut}
                  disabled={disabled || !activeImage}
                  aria-label="Diminuir zoom"
                >
                  <ZoomOut className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                </Button>
                <span className="text-xs font-mono tabular-nums text-muted-foreground min-w-[2.75rem] text-center">
                  {zoomPercent}%
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className={toolBtnClass}
                  onClick={zoomIn}
                  disabled={disabled || !activeImage}
                  aria-label="Aumentar zoom"
                >
                  <ZoomIn className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                </Button>
                {isFullscreenLayout && onClose && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className={toolBtnClass}
                    onClick={onClose}
                    aria-label="Fechar"
                  >
                    <Minimize2 className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                  </Button>
                )}
              </div>
            </div>
          </TooltipProvider>
        ) : (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center px-1.5 py-1">
                {isOnline ? (
                  <Cloud className="h-4 w-4 text-green-500" />
                ) : (
                  <CloudOff className="h-4 w-4 text-red-500 animate-pulse" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isOnline ? 'Online — Sincronizado' : 'Offline — Edições serão salvas localmente'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={toolBtnClass}
                aria-label="Recolher ferramentas"
                onClick={() => setToolbarCollapsed(true)}
              >
                <ChevronDown className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Recolher barra (mais espaço para desenhar)</TooltipContent>
          </Tooltip>

          <div className="w-px h-7 bg-border mx-0.5" />

          {!activeImage && (
            <span className="text-xs text-muted-foreground px-1">Insira uma foto para usar as ferramentas</span>
          )}

          {(
            [
              { t: 'select' as Tool, icon: MousePointer, label: 'Selecionar' },
              { t: 'pencil' as Tool, icon: Pencil, label: 'Desenhar' },
              { t: 'line' as Tool, icon: Minus, label: 'Linha reta — clique e arraste' },
              { t: 'eraser' as Tool, icon: Eraser, label: 'Apagar traço' },
              { t: 'text' as Tool, icon: Type, label: 'Caixa de texto' },
              { t: 'rect' as Tool, icon: Square, label: 'Retângulo' },
              { t: 'ellipse' as Tool, icon: Circle, label: 'Elipse' },
              { t: 'points' as Tool, icon: Waypoints, label: 'Pontos e linhas — duplo clique na lousa para finalizar' },
              { t: 'measure' as Tool, icon: Ruler, label: 'Medição reta' },
              { t: 'measure_arc' as Tool, icon: Spline, label: 'Medição em arco' },
            ] as const
          ).map(({ t, icon: Icon, label }) => (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant={tool === t ? 'default' : 'outline'}
                  className={toolBtnClass}
                  disabled={toolsDisabled}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => selectTool(t)}
                >
                  <Icon className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={tool === 'furniture' ? 'default' : 'outline'}
                className={toolBtnClass}
                disabled={toolsDisabled}
                aria-label="Móveis de marcenaria"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  selectTool('furniture');
                }}
              >
                <Box className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Móveis — esboços de marcenaria</TooltipContent>
          </Tooltip>

          <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />

          <Popover open={imageSourceOpen} onOpenChange={setImageSourceOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={toolBtnClass}
                disabled={disabled || uploadingCount > 0}
                aria-label="Inserir foto"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {uploadingCount > 0 ? (
                  <Loader2 className={cn('animate-spin', isMobile ? 'h-5 w-5' : 'h-4 w-4')} />
                ) : (
                  <Camera className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-56 space-y-1 p-2 z-[10050]"
              align="center"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                className={cn('w-full justify-start gap-2 text-sm', isMobile ? 'h-11' : 'h-10')}
                disabled={disabled || uploadingCount > 0}
                onClick={() => {
                  // Abrir o seletor no mesmo toque — fechar o menu antes quebra no iPad/Android.
                  openGalleryPicker();
                  setImageSourceOpen(false);
                }}
              >
                <ImagePlus className="h-4 w-4 shrink-0" />
                Anexar imagens
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn('w-full justify-start gap-2 text-sm', isMobile ? 'h-11' : 'h-10')}
                disabled={disabled || uploadingCount > 0}
                onClick={() => {
                  cameraCaptureRef.current?.requestCapture();
                  setImageSourceOpen(false);
                }}
              >
                <Camera className="h-4 w-4 shrink-0" />
                Tirar foto
              </Button>
              {!!leadId && (
                <Button
                  type="button"
                  variant="ghost"
                  className={cn('w-full justify-start gap-2 text-sm', isMobile ? 'h-11' : 'h-10')}
                  disabled={disabled || uploadingCount > 0 || isImportingFromProject}
                  onClick={() => {
                    setImageSourceOpen(false);
                    setProjectPickerOpen(true);
                  }}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  Do projeto
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {typeof document !== 'undefined'
            ? createPortal(
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  multiple
                  className="fixed left-0 top-0 h-px w-px opacity-0"
                  style={{ zIndex: -1 }}
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) {
                      void handleUploadFiles(files).finally(() => {
                        e.target.value = '';
                      });
                      return;
                    }
                    e.target.value = '';
                  }}
                />,
                document.body,
              )
            : null}

          <div className="w-px h-7 bg-border mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={toolBtnClass}
                disabled={toolsDisabled || !canUndo || historyApplying}
                onClick={() => void handleUndo()}
              >
                <Undo2 className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voltar (desfazer) — Ctrl+Z</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={toolBtnClass}
                disabled={toolsDisabled || !canRedo || historyApplying}
                onClick={() => void redoHistory()}
              >
                <Redo2 className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Avançar (refazer) — Ctrl+Y</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={toolBtnClass}
                disabled={toolsDisabled || imageDrawings.length === 0 || historyApplying}
                onClick={() => void handleDeleteLast()}
              >
                <ArrowLeftToLine className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Apagar o último desenho</TooltipContent>
          </Tooltip>

          <div className="w-px h-7 bg-border mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="outline" className={toolBtnClass} onClick={zoomOut} disabled={disabled || !activeImage}>
                <ZoomOut className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Diminuir zoom</TooltipContent>
          </Tooltip>

          <span className="text-xs font-mono tabular-nums text-muted-foreground min-w-[3rem] text-center px-1">
            {zoomPercent}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="outline" className={toolBtnClass} onClick={zoomIn} disabled={disabled || !activeImage}>
                <ZoomIn className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aumentar zoom</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={toolBtnClass}
                onClick={() => fitContent(16)}
                disabled={disabled || !activeImage}
              >
                <Scan className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ajustar foto na tela</TooltipContent>
          </Tooltip>

          {tool === 'points' && toolStepHint && (
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground px-2 py-1 rounded-md bg-card/95 border border-border/60">
              {toolStepHint}
            </span>
          )}

          {tool === 'points' && (pendingPolyline?.length ?? 0) > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className={isMobile ? 'h-11' : 'h-8'}
              disabled={toolsDisabled || (pendingPolyline?.length ?? 0) < 2}
              onClick={() => void finalizePendingPolyline()}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Finalizar linha
            </Button>
          )}

          {(tool === 'text' || textPlacementPending) && (
            <>
              <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={toolsDisabled}
                    className={cn(
                      'font-mono tabular-nums px-2 min-w-[3.25rem]',
                      isMobile ? 'h-11 text-sm' : 'h-8 text-xs',
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {textFontSizePx}px
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-56 space-y-3 z-[10050]"
                  align="center"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-2">
                    <Label className="text-xs">Tamanho da fonte</Label>
                    <Slider
                      value={[textFontSizePx]}
                      min={WHITEBOARD_FONT_SIZE_MIN}
                      max={WHITEBOARD_FONT_SIZE_MAX}
                      step={1}
                      onValueChange={([v]) => setTextFontSizePx(v)}
                      onValueCommit={([v]) => commitTextFontSize(v)}
                    />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {isAdmin
                        ? 'Ao soltar o controle, o tamanho é salvo para todos os usuários.'
                        : 'Vale para os próximos textos que você criar nesta foto.'}
                    </p>
                  </div>
                </PopoverContent>
              </Popover>

              <Input
                type="color"
                value={textColorHex}
                onChange={(e) => commitTextColorHex(e.target.value)}
                className={cn('p-0 border cursor-pointer', isMobile ? 'h-11 w-12' : 'h-8 w-10')}
                disabled={disabled || !isAdmin}
                title={
                  isAdmin
                    ? 'Cor do texto (padrão para todos)'
                    : 'Cor do texto definida pelo administrador'
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
            </>
          )}

          {(tool === 'measure' || tool === 'measure_arc' || tool === 'furniture') && (
            <>
              <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
              {toolStepHint && (
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground px-2 py-1 rounded-md bg-card/95 border border-border/60 backdrop-blur-sm max-w-[14rem] leading-tight">
                  {toolStepHint}
                </span>
              )}
              {tool === 'furniture' && (
                <div className="flex max-w-[min(96vw,42rem)] flex-wrap items-center gap-1">
                  {FURNITURE_FAMILIES.map((family) => {
                    const variants = getFurnitureVariants(family.id);
                    const activeFamily = getFamilyForModuleType(furnitureModuleType) === family.id;
                    const previewType = activeFamily ? furnitureModuleType : family.defaultType;
                    return (
                      <Popover
                        key={family.id}
                        open={furnitureFamilyOpen === family.id}
                        onOpenChange={(open) =>
                          setFurnitureFamilyOpen(open ? family.id : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title={`${family.label} — ${family.description}. Clique para ver os modelos.`}
                            disabled={toolsDisabled}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={cn(
                              'flex items-center gap-1 rounded-lg border px-1.5 py-1 text-left transition-colors',
                              activeFamily
                                ? 'border-primary/50 bg-primary/15 text-foreground'
                                : 'border-border/70 bg-card/70 text-muted-foreground hover:bg-muted/50',
                            )}
                          >
                            <FurnitureModuleThumb moduleType={previewType} className="h-7 w-6" />
                            <span className="text-[10px] font-semibold leading-tight max-w-[3.6rem]">
                              {family.label}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="z-[10050] w-[min(92vw,20rem)] p-2"
                          align="start"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="mb-2 px-1 text-[11px] font-semibold text-foreground">
                            Modelos de {family.label}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {variants.map((mod) => {
                              const active = furnitureModuleType === mod.type;
                              return (
                                <button
                                  key={mod.type}
                                  type="button"
                                  title={mod.description}
                                  disabled={toolsDisabled}
                                  onClick={() => selectFurnitureModule(mod.type)}
                                  className={cn(
                                    'flex items-center gap-1.5 rounded-lg border px-1.5 py-1.5 text-left transition-colors',
                                    active
                                      ? 'border-primary/50 bg-primary/15 text-foreground'
                                      : 'border-border/60 bg-card hover:bg-muted/60',
                                  )}
                                >
                                  <FurnitureModuleThumb
                                    moduleType={mod.type}
                                    className="h-8 w-7 shrink-0"
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-[10px] font-semibold leading-tight">
                                      {mod.label}
                                    </span>
                                    <span className="block text-[9px] leading-tight text-muted-foreground line-clamp-2">
                                      {mod.description}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              )}
              {(tool === 'measure' || tool === 'measure_arc') &&
                MEASURE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    disabled={toolsDisabled}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                      measureColor === preset.hex
                        ? 'border-white ring-2 ring-primary scale-110'
                        : 'border-white/40',
                    )}
                    style={{ backgroundColor: preset.hex }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setMeasureColor(preset.hex)}
                  />
                ))}
            </>
          )}

          {(tool === 'pencil' ||
            tool === 'eraser' ||
            (ANNOTATION_TOOLS.includes(tool) &&
              tool !== 'text' &&
              tool !== 'measure' &&
              tool !== 'measure_arc')) && (
            <>
              <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={cn('p-0 border cursor-pointer', isMobile ? 'h-11 w-12' : 'h-8 w-10')}
                disabled={toolsDisabled || tool === 'eraser'}
                title="Cor do traço"
              />
              <Slider
                value={[strokeWidth]}
                min={1}
                max={14}
                step={1}
                disabled={toolsDisabled || tool === 'eraser'}
                onValueChange={([v]) => setStrokeWidth(v)}
                className={cn(isMobile ? 'w-24' : 'w-20')}
              />
            </>
          )}

          {selectedAnnotationId && tool === 'select' && !toolsDisabled && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className={isMobile ? 'h-11' : 'h-8'}
              disabled={disabled}
              onClick={() => {
                void deleteDrawing(selectedAnnotationId);
                setSelectedAnnotationId(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remover forma
            </Button>
          )}

          {activeImage && !toolsDisabled && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className={isMobile ? 'h-11' : 'h-8'}
              disabled={disabled}
              onClick={() => {
                void deleteImage({ id: activeImage.id, fileUrl: activeImage.file_url });
                setActiveImageId(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remover foto
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn('text-muted-foreground', isMobile ? 'h-11' : 'h-8')}
            disabled={
              toolsDisabled ||
              (imageDrawings.length === 0 &&
                optimisticAnnotations.length === 0 &&
                !pendingPolyline &&
                !shapePreview &&
                !pendingMeasure &&
                !pendingFurniture)
            }
            onClick={() => void clearDrawings()}
          >
            Limpar desenhos
          </Button>

          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          {isFullscreenLayout && onClose && (
            <>
              <div className="w-px h-7 bg-border mx-0.5" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="icon" variant="outline" className={toolBtnClass} onClick={onClose}>
                    <Minimize2 className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fechar</TooltipContent>
              </Tooltip>
            </>
          )}
        </TooltipProvider>
        )}
      </div>

      {!isFullscreenLayout && images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 order-3">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveImageId(img.id)}
              className={cn(
                'relative shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-all',
                activeImageId === img.id
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border/60 opacity-80 hover:opacity-100',
              )}
            >
              <img src={img.file_url} alt={img.file_name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {!isFullscreenLayout && (
        <div className="shrink-0 order-4 space-y-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setHelpExpanded((v) => !v)}
            aria-expanded={helpExpanded}
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            {helpExpanded ? 'Ocultar dicas' : 'Ver dicas de uso'}
            {helpExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {helpExpanded && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Inserir foto</strong> — use o ícone de câmera ·{' '}
              <strong>Tirar foto</strong> — no celular/tablet abre a câmera do aparelho (com zoom); no PC usa a webcam ·{' '}
              <strong>Do projeto</strong> — use imagens já anexadas ·{' '}
              <strong>Disquete</strong> — salva a foto com desenhos nos anexos e limpa a lousa ·{' '}
              <strong>Linha reta</strong> — clique e arraste ·{' '}
              <strong>Medição</strong> — clique dois pontos (reta) ou três (arco) ·{' '}
              <strong>Etiqueta</strong> — toque no valor para editar (ex: 58,5) ·{' '}
              <strong>Ferramentas</strong> — use o botão de seta para recolher a barra e ganhar espaço ·{' '}
              <strong>Dois cliques</strong> na foto = ajustar zoom ·{' '}
              <strong>Pinça</strong> — aproxime ou afaste dois dedos na foto para dar zoom ·{' '}
              {isMobile && 'Use tela cheia para mais espaço.'}
            </p>
          )}
        </div>
      )}

      {typeof leadId === 'number' && (
        <WhiteboardProjectImagePicker
          leadId={leadId}
          open={projectPickerOpen}
          onOpenChange={setProjectPickerOpen}
          existingImageUrls={images.map((img) => img.file_url)}
          onSelect={handleImportFromProject}
          isSelecting={isImportingFromProject}
        />
      )}

      <WhiteboardCameraCapture
        ref={cameraCaptureRef}
        open={cameraCaptureOpen}
        onOpenChange={setCameraCaptureOpen}
        disabled={disabled || uploadingCount > 0}
        onCapture={async (file) => {
          await handleUploadFiles([file]);
        }}
      />
    </div>
  );
});

export function LeadWhiteboard({ leadId, disabled }: LeadWhiteboardProps) {
  const isMobile = useIsMobile();
  const [fullscreen, setFullscreen] = useState(false);
  const boardRef = useRef<BoardInnerHandle>(null);
  const [saveState, setSaveState] = useState<{
    canSave: boolean;
    isSaving: boolean;
    disabledReason?: string;
  }>({ canSave: false, isSaving: false });

  const { isSuperAdmin } = useAuth();
  const { userRole, hasPermission } = usePermissions();
  const canUploadAttachment =
    !disabled &&
    (isSuperAdmin ||
      userRole === 'admin' ||
      userRole === 'vendedor' ||
      hasPermission('leads', 'edit'));

  const updateFullscreen = useCallback((open: boolean) => {
    setWhiteboardFullscreenOpenFlag(open);
    setFullscreen(open);
  }, []);

  const openFullscreen = () => updateFullscreen(true);

  useEffect(() => {
    if (!fullscreen) return;
    setWhiteboardFullscreenOpenFlag(true);
    return () => {
      setWhiteboardFullscreenOpenFlag(false);
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen || !isMobile) return;

    const meta = document.querySelector('meta[name="viewport"]');
    const previousContent = meta?.getAttribute('content') ?? '';
    meta?.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    );

    const { style } = document.body;
    const prevOverflow = style.overflow;
    const prevPosition = style.position;
    const prevWidth = style.width;
    style.overflow = 'hidden';
    style.position = 'fixed';
    style.width = '100%';

    return () => {
      if (meta && previousContent) meta.setAttribute('content', previousContent);
      style.overflow = prevOverflow;
      style.position = prevPosition;
      style.width = prevWidth;
    };
  }, [fullscreen, isMobile]);

  const handleHeaderSave = () => {
    void boardRef.current?.saveToAttachments();
  };

  return (
    <div
      className="space-y-2 w-full overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-card/80 to-card/30 p-3 sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <ImageIcon className="h-4 w-4 text-primary" />
          </span>
          Fotos do lead
        </Label>
        <div className="flex items-center gap-1.5">
          {canUploadAttachment && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={!saveState.canSave || fullscreen}
                    aria-label="Salvar nos anexos"
                    onClick={handleHeaderSave}
                  >
                    {saveState.isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {saveState.disabledReason ?? 'Salvar nos anexos'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {leadId && (
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={openFullscreen}>
              <Maximize2 className="h-3.5 w-3.5" />
              {isMobile ? 'Abrir' : 'Tela cheia'}
            </Button>
          )}
        </div>
      </div>

      {!fullscreen && (
        <BoardInner
          ref={boardRef}
          leadId={leadId}
          disabled={disabled}
          minHeight={isMobile ? 300 : 380}
          onSaveStateChange={setSaveState}
        />
      )}

      <Dialog open={fullscreen} onOpenChange={updateFullscreen}>
        <DialogContent
          nested
          overlayClassName={leadFullscreenOverlayClass}
          data-whiteboard-fullscreen=""
          className={cn(
            leadFullscreenContentClass,
            '!fixed inset-0 left-0 top-0 !translate-x-0 !translate-y-0 max-w-none w-[100dvw] h-[100dvh] max-h-[100dvh] p-0 gap-0 !flex !flex-col rounded-none border-0 bg-background [&>button]:hidden data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 touch-manipulation',
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Fotos do lead</DialogTitle>
          {fullscreen && (
            <BoardInner
              key="whiteboard-fullscreen"
              leadId={leadId}
              disabled={disabled}
              variant="fullscreen"
              onClose={() => updateFullscreen(false)}
              className="flex-1 min-h-0 h-full w-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
