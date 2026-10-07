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
import { createPortal, flushSync } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
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
  PenLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PROJECT_IMAGE_PICKER_OPEN_ATTR,
  WHITEBOARD_FULLSCREEN_ATTR,
  setWhiteboardFullscreenOpenFlag,
} from '@/lib/dialog-outside-guard';
import { leadFullscreenContentClass } from '@/lib/overlay-z-index';
import { isTouchOrCompactViewport } from '@/lib/viewport-ui';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadWhiteboard, type LeadWhiteboardImage, type LeadWhiteboardDrawing } from '@/hooks/useLeadWhiteboard';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { useWhiteboardHistory } from '@/hooks/useWhiteboardHistory';
import { useWhiteboardTextConfig } from '@/hooks/useWhiteboardTextConfig';
import { usePermissions } from '@/hooks/usePermissions';
import { buildWhiteboardAttachmentFile } from '@/lib/lead-whiteboard-save';
import { buildWhiteboardNoteAttachmentFiles } from '@/lib/lead-whiteboard-note-export';
import { WhiteboardProjectImagePicker } from '@/components/leads/whiteboard/WhiteboardProjectImagePicker';
import { LeadFolderPickDialog } from '@/components/leads/LeadFolderPickDialog';
import { WhiteboardCameraCapture, type WhiteboardCameraCaptureHandle } from '@/components/leads/whiteboard/WhiteboardCameraCapture';
import { createBlankWhiteboardFile, isLikelyImageFile } from '@/lib/whiteboard-image-upload';
import type { LeadMidiaDisponivel } from '@/lib/orcamento-slide-types';
import { sanitizeVisitFileBaseName } from '@/lib/lead-photo-checklist-catalog';
import {
  LEAD_WHITEBOARD_IMPORT_EVENT,
  type LeadWhiteboardImportDetail,
} from '@/lib/lead-whiteboard-import';
import {
  WHITEBOARD_FONT_SIZE_MIN,
  WHITEBOARD_FONT_SIZE_MAX,
} from '@/lib/whiteboard-text-config';
import { useWhiteboardTouchLock } from '@/hooks/useWhiteboardTouchLock';
import { useWhiteboardViewport } from '@/hooks/useWhiteboardViewport';
import { WhiteboardAnnotationsLayer } from '@/components/leads/whiteboard/WhiteboardAnnotationsLayer';
import { FurnitureModuleThumb } from '@/components/leads/whiteboard/FurnitureModuleGfx';
import { WhiteboardWoodFoil } from '@/components/leads/whiteboard/WhiteboardWoodFoil';
import { WhiteboardImageNotes } from '@/components/leads/whiteboard/WhiteboardImageNotes';
import {
  DraftingDivider,
  DraftingGroup,
  DraftingHint,
  DraftingRail,
  LousaUsageTips,
  draftingIconClass,
} from '@/components/leads/whiteboard/WhiteboardDraftingChrome';
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

interface OpenFullscreenOptions {
  /** Só o botão “Quadro branco” pede folha nova — “Abrir” só expande. */
  createBlankIfEmpty?: boolean;
}

interface BoardInnerProps extends LeadWhiteboardProps {
  className?: string;
  minHeight?: number;
  variant?: 'inline' | 'fullscreen';
  onClose?: () => void;
  /** Pedir tela cheia (ex.: após criar quadro branco). */
  onRequestFullscreen?: (options?: OpenFullscreenOptions) => void;
  onSaveStateChange?: (state: {
    canSave: boolean;
    isSaving: boolean;
    disabledReason?: string;
  }) => void;
}

export interface BoardInnerHandle {
  saveToAttachments: () => Promise<void>;
  /** Cria uma folha branca se a lousa estiver vazia. */
  ensureBlankBoard: () => Promise<void>;
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
  {
    leadId,
    disabled,
    className,
    minHeight = 360,
    variant = 'inline',
    onClose,
    onRequestFullscreen,
    onSaveStateChange,
  },
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
  /** Tablet largo (ex.: Tab S9 Ultra) não entra em isMobile — mesmo assim precisa de zoom estável. */
  const isTouchUi = isTouchOrCompactViewport();
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
    saveImageNote,
    isOnline,
    isSaving,
  } = useLeadWhiteboard(leadId);

  const { uploadPDF, pdfs } = useLeadPDFs(leadId);
  const suggestedFolderIdRef = useRef<string | null>(null);
  const suggestedFolderNameRef = useRef<string>('');
  const pendingSaveFileRef = useRef<File | null>(null);
  const savePreviewUrlRef = useRef<string | null>(null);
  /** Texto da nota digitado (mesmo sem clicar em “Salvar nota”). */
  const noteDraftRef = useRef('');
  const [noteDraftHasText, setNoteDraftHasText] = useState(false);
  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [savePreviewUrl, setSavePreviewUrl] = useState<string | null>(null);
  const [saveDefaultFileName, setSaveDefaultFileName] = useState('');
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
  /** Espelho das medições em edição — o commit ao deselecionar só enxerga texto sem isso. */
  const measureLivePayloadsRef = useRef<Record<string, WhiteboardMeasurePayload>>({});

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
    maxFitScale: isMobile || isTouchUi ? 1 : undefined,
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
        delete measureLivePayloadsRef.current[id];
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
        measureLivePayloadsRef.current[id] ??
        (() => {
          const ann = annotationsWithOptimistic.find((a) => a.id === id);
          if (!ann) return null;
          if (ann.payload.kind === 'text' || ann.payload.kind === 'measure') {
            return ann.payload;
          }
          return null;
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
        if (resolved.kind === 'measure') {
          measureLivePayloadsRef.current[id] = resolved;
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

  /** Grava texto ou medição em edição antes de trocar a seleção / clicar fora. */
  const commitActiveAnnotation = useCallback(async () => {
    const id = selectedAnnotationIdRef.current;
    if (!id) return;
    // Sai do campo primeiro: o onBlur/onChange espelha o valor exato no ref
    if (
      document.activeElement instanceof HTMLTextAreaElement ||
      document.activeElement instanceof HTMLInputElement
    ) {
      document.activeElement.blur();
    }
    await commitAnnotation(id);
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
    measureLivePayloadsRef.current = {};
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
    if (!activeImage) return 'Abra um quadro branco ou insira uma foto antes de salvar';
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

      pendingSaveFileRef.current = file;
      if (savePreviewUrlRef.current) URL.revokeObjectURL(savePreviewUrlRef.current);
      const preview = URL.createObjectURL(file);
      savePreviewUrlRef.current = preview;
      setSavePreviewUrl(preview);
      setSaveDefaultFileName(
        sanitizeVisitFileBaseName(activeImage.file_name.replace(/\.[^.]+$/, '') || 'foto-lousa'),
      );
      setSavePickerOpen(true);
    } catch (error) {
      toast.error('Não foi possível salvar a lousa', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      if (!pendingSaveFileRef.current) setIsSavingAttachment(false);
    }
  }, [
    leadId,
    activeImage,
    canSaveToAttachments,
    discardEphemeralWork,
    drawings,
    optimisticAnnotations,
    legacyFallbackImageId,
  ]);

  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const imagesCountRef = useRef(images.length);
  imagesCountRef.current = images.length;

  const ensureBlankBoard = useCallback(async () => {
    if (!leadId || disabled) {
      toast.error('Salve o lead antes de usar a lousa');
      throw new Error('Lead não disponível');
    }
    // Ao abrir tela cheia o Board remonta: espera o cache/fetch antes de achar “vazio”.
    const deadline = Date.now() + 4000;
    while (isLoadingRef.current && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
    if (imagesCountRef.current > 0) return;
    setUploadingCount(1);
    try {
      const file = await createBlankWhiteboardFile(1280, 720);
      const boardWidth = boardAreaRef.current?.clientWidth ?? viewportRef.current?.clientWidth ?? 1280;
      const ok = await uploadImage(file, boardWidth, 0);
      if (!ok) throw new Error('Falha ao criar quadro branco');
    } catch (error) {
      if (!(error instanceof Error && error.message === 'Falha ao criar quadro branco')) {
        toast.error('Não foi possível abrir o quadro branco', {
          description: error instanceof Error ? error.message : undefined,
        });
      }
      throw error;
    } finally {
      setUploadingCount(0);
    }
  }, [leadId, disabled, uploadImage]);

  const startBlankBoard = useCallback(async () => {
    // Expande e só então cria a folha — evita flash no card e quadro fantasma no “Abrir”.
    if (onRequestFullscreen) {
      onRequestFullscreen({ createBlankIfEmpty: true });
      return;
    }
    await ensureBlankBoard();
  }, [ensureBlankBoard, onRequestFullscreen]);

  useImperativeHandle(
    ref,
    () => ({
      saveToAttachments,
      ensureBlankBoard,
    }),
    [saveToAttachments, ensureBlankBoard],
  );

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
          suggestedFolderIdRef.current = midia.folder_id ?? null;
          suggestedFolderNameRef.current = '';
          setActiveImageId(created.id);
          setProjectPickerOpen(false);
        }
      } finally {
        setIsImportingFromProject(false);
      }
    },
    [leadId, disabled, importImageFromUrl],
  );

  const handleNoteDraftChange = useCallback((imageId: string, note: string) => {
    if (imageId !== activeImageId) return;
    noteDraftRef.current = note;
    setNoteDraftHasText(note.trim().length > 0);
  }, [activeImageId]);

  const confirmSaveToFolder = useCallback(
    async (
      folderId: string | null,
      options?: { fileName: string; includeNotes: boolean; folderName?: string },
    ) => {
      const file = pendingSaveFileRef.current;
      if (!file || !leadId) return;
      const base = options?.fileName?.trim();
      const safeBase = sanitizeVisitFileBaseName(base || 'foto-lousa');
      const named = new File([file], `${safeBase}.jpg`, {
        type: file.type || 'image/jpeg',
      });
      const noteText =
        noteDraftRef.current.trim() || activeImage?.observacao?.trim() || '';
      const shouldIncludeNotes = Boolean(options?.includeNotes && noteText);

      try {
        // Garante a nota no banco antes de limpar a lousa
        if (noteText && activeImage?.id) {
          await saveImageNote(activeImage.id, noteText);
        }

        await uploadPDF(named, {
          folderId,
          folderName: options?.folderName,
        });

        if (shouldIncludeNotes) {
          const noteFiles = await buildWhiteboardNoteAttachmentFiles({
            photoFile: named,
            noteText,
            photoFileName: named.name,
            baseName: safeBase,
            leadId,
          });
          // Uma única vez: só a imagem da nota (com miniatura). Antes ia JPG + PDF = duplicata.
          await uploadPDF(noteFiles.imageFile, {
            folderId,
            folderName: options?.folderName,
          });
        }

        await clearWhiteboard();
        setActiveImageId(null);
        setOptimisticAnnotations([]);
        setSelectedAnnotationId(null);
        setAutoFocusTextId(null);
        setRemapTextPayloadIds(null);
        textLivePayloadsRef.current = {};
        measureLivePayloadsRef.current = {};
        pendingTextCommitRef.current = {};
        resetHistory();
        pendingSaveFileRef.current = null;
        noteDraftRef.current = '';
        setNoteDraftHasText(false);
        if (savePreviewUrlRef.current) {
          URL.revokeObjectURL(savePreviewUrlRef.current);
          savePreviewUrlRef.current = null;
        }
        setSavePreviewUrl(null);
        toast.success(
          shouldIncludeNotes
            ? 'Foto e nota salvas na mesma pasta. A lousa foi limpa para um novo trabalho.'
            : 'Foto com desenhos salva nos anexos. A lousa foi limpa para um novo trabalho.',
        );
      } catch (error) {
        toast.error('Não foi possível salvar a lousa', {
          description: error instanceof Error ? error.message : undefined,
        });
        throw error;
      } finally {
        setIsSavingAttachment(false);
      }
    },
    [leadId, activeImage?.id, activeImage?.observacao, uploadPDF, clearWhiteboard, resetHistory, saveImageNote],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<LeadWhiteboardImportDetail>).detail;
      if (!detail || detail.leadId !== leadId || disabled) return;
      suggestedFolderIdRef.current = detail.folderId ?? null;
      suggestedFolderNameRef.current = detail.folderName ?? '';
      const boardWidth = boardAreaRef.current?.clientWidth ?? 800;
      void importImageFromUrl({
        fileUrl: detail.fileUrl,
        fileName: detail.fileName,
        boardWidth,
      }).then((created) => {
        if (created) setActiveImageId(created.id);
      });
    };
    window.addEventListener(LEAD_WHITEBOARD_IMPORT_EVENT, handler);
    return () => window.removeEventListener(LEAD_WHITEBOARD_IMPORT_EVENT, handler);
  }, [leadId, disabled, importImageFromUrl]);

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
    if (!activeImage) return;
    const t = requestAnimationFrame(() => fitContent(16));
    return () => cancelAnimationFrame(t);
  }, [activeImage?.id, worldSize.width, worldSize.height, fitContent, activeImage]);

  useEffect(() => {
    if (!isFullscreenLayout || !viewportEl) return;

    // Toque / tablet: um ajuste só (raf + fallback). ResizeObserver contínuo faz a lousa “piscar”.
    if (isTouchUi || isMobile) {
      const raf = requestAnimationFrame(() => fitContent(16));
      const timer = window.setTimeout(() => fitContent(16), 320);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }

    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fitContent(16));
    });
    ro.observe(viewportEl);
    raf = requestAnimationFrame(() => fitContent(16));
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [isFullscreenLayout, viewportEl, fitContent, activeImage?.id, isMobile, isTouchUi]);

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
    const clickedMeasure = (e.target as HTMLElement).closest(
      '[data-whiteboard-measure], [data-whiteboard-measure-label]',
    );
    const clickedFurniture = (e.target as HTMLElement).closest('[data-whiteboard-furniture]');
    if (!clickedText && !clickedMeasure && !clickedFurniture && tool === 'select') {
      // Grava texto E número da régua digitado antes de limpar a seleção
      void commitActiveAnnotation();
      if (selectedAnnotationIdRef.current) {
        setSelectedAnnotationId(null);
      }
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

  const toolBtnClass = draftingIconClass({ compact: !isMobile });

  return (
    <div
      className={cn(
        'min-h-0 w-full',
        isFullscreenLayout
          ? cn('relative flex-1 min-h-0 overflow-hidden', className)
          : cn('flex flex-col space-y-2', className),
      )}
    >
      {/* Foto + notas ao lado (desktop) / abaixo (celular) */}
      <div
        className={cn(
          isFullscreenLayout
            ? 'absolute inset-0 flex flex-col gap-2 p-2 pb-[5.75rem] sm:flex-row sm:pb-24'
            : 'order-1 flex flex-col gap-2 lg:flex-row lg:items-stretch',
        )}
      >
      {/* Área da foto */}
      <div
        ref={bindBoardAreaRef}
        data-whiteboard-viewport
        className={cn(
          'min-w-0 select-none overscroll-none',
          isFullscreenLayout
            ? 'relative min-h-0 flex-1 overflow-hidden rounded-xl border border-gold/25'
            : 'relative w-full max-h-[min(48vh,380px)] overflow-hidden rounded-xl border border-gold/30 shadow-[inset_0_1px_0_rgba(242,216,146,0.1),0_10px_28px_rgba(0,0,0,0.28)] lg:min-h-[280px] lg:flex-1',
        )}
        style={isFullscreenLayout ? undefined : { minHeight: Math.min(minHeight, 280) }}
      >
        <div
          ref={bindViewportRef}
          role="application"
          aria-label="Área de edição da foto"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleViewportDoubleClick}
          className={cn(
            'absolute inset-0 overflow-hidden bg-[#120c09]',
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
          <div className="absolute z-[9600] pointer-events-auto bottom-3 left-3">
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
            onMeasurePayloadLiveChange={(id, measurePayload) => {
              measureLivePayloadsRef.current[id] = measurePayload;
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#d4bc9f] gap-4 p-6 z-10">
            <div className="rounded-2xl border border-gold/25 bg-gold/10 p-4">
              <ImageIcon className="h-10 w-10 text-gold/80" />
            </div>
            <p className="text-sm text-center max-w-xs font-medium text-[#fff6ea]">
              Abra um quadro branco para desenhar sem foto, ou insira uma imagem para medir e anotar.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-2"
                disabled={disabled || uploadingCount > 0}
                onClick={() => {
                  void startBlankBoard();
                }}
              >
                {uploadingCount > 0 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PenLine className="h-4 w-4" />
                )}
                Quadro branco
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={disabled || uploadingCount > 0}
                onClick={() => openGalleryPicker()}
              >
                <ImagePlus className="h-4 w-4" />
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

        {activeImage?.observacao?.trim() && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[9200] rounded-lg border border-[#f2d892]/80 bg-[#f2d892]/95 px-3 py-2 shadow-lg sm:max-w-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#3d2b1f]">
              Nota desta foto
            </p>
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#1a120b]">
              {activeImage.observacao.trim()}
            </p>
          </div>
        )}
      </div>

      {activeImage && (
        <WhiteboardImageNotes
          imageId={activeImage.id}
          initialNote={activeImage.observacao}
          disabled={disabled}
          compact
          className={cn(
            isFullscreenLayout
              ? 'max-h-[38%] shrink-0 overflow-y-auto sm:max-h-none sm:h-full sm:w-72 xl:w-80'
              : 'lg:self-stretch',
          )}
          onSave={saveImageNote}
          onDraftChange={handleNoteDraftChange}
        />
      )}
      </div>

      {/* Barra de ferramentas — mesa de desenho, abaixo da foto */}
      <div
        data-whiteboard-toolbar
        className={cn(
          'relative overflow-hidden rounded-xl border border-gold/30 shadow-[0_8px_24px_rgba(0,0,0,0.28)] shrink-0',
          isFullscreenLayout
            ? 'absolute inset-x-2 bottom-2 z-[9500] bg-[#1a100c]/95 backdrop-blur-sm'
            : 'bg-[#1a100c] order-2',
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <WhiteboardWoodFoil />
        {toolbarCollapsed ? (
          <TooltipProvider delayDuration={200}>
            <div className="relative z-10 flex w-full items-center justify-between gap-2 px-2.5 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn(toolBtnClass, 'bg-gold/20 text-gold ring-1 ring-gold/50')}
                      aria-label="Expandir ferramentas"
                      onClick={() => setToolbarCollapsed(false)}
                    >
                      <ChevronUp className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mostrar ferramentas</TooltipContent>
                </Tooltip>
                <span className="truncate font-display text-[11px] uppercase tracking-[0.16em] text-gold/80">
                  Recolhida — pinça com 2 dedos para zoom
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isOnline ? (
                  <Cloud className="h-4 w-4 text-emerald-400 mr-1" />
                ) : (
                  <CloudOff className="h-4 w-4 text-red-400 animate-pulse mr-1" />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={toolBtnClass}
                  onClick={zoomOut}
                  disabled={disabled || !activeImage}
                  aria-label="Diminuir zoom"
                >
                  <ZoomOut className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                </Button>
                <span className="min-w-[2.75rem] text-center font-mono text-xs tabular-nums text-[#fff6ea]">
                  {zoomPercent}%
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
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
                    variant="ghost"
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
          <div className="relative z-10 flex flex-col gap-2.5 p-2.5 sm:p-3">
          {!activeImage && (
            <p className="font-display text-[11px] uppercase tracking-[0.16em] text-gold/80">
              Abra um quadro branco ou insira uma foto para usar as ferramentas
            </p>
          )}
          <DraftingRail>
          <DraftingGroup label="Mesa" className="order-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-8 w-8 items-center justify-center sm:h-8 sm:w-8">
                {isOnline ? (
                  <Cloud className="h-4 w-4 text-emerald-400" />
                ) : (
                  <CloudOff className="h-4 w-4 text-red-400 animate-pulse" />
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
                variant="ghost"
                className={toolBtnClass}
                aria-label="Recolher ferramentas"
                onClick={() => setToolbarCollapsed(true)}
              >
                <ChevronDown className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Recolher barra (mais espaço para desenhar)</TooltipContent>
          </Tooltip>
          </DraftingGroup>

          <DraftingDivider />

          <DraftingGroup label="Marcar" fullOnMobile className="order-2 sm:order-none">
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
            ] as const
          ).map(({ t, icon: Icon, label }) => (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={draftingIconClass({ compact: !isMobile, active: tool === t })}
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
          </DraftingGroup>

          <DraftingDivider />

          <DraftingGroup label="Medir" className="order-3 sm:order-none">
          {(
            [
              { t: 'measure' as Tool, icon: Ruler, label: 'Medição reta' },
              { t: 'measure_arc' as Tool, icon: Spline, label: 'Medição em arco' },
            ] as const
          ).map(({ t, icon: Icon, label }) => (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={draftingIconClass({ compact: !isMobile, active: tool === t })}
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
                variant="ghost"
                className={draftingIconClass({ compact: !isMobile, active: tool === 'furniture' })}
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
          </DraftingGroup>

          <DraftingDivider />

          <DraftingGroup label="Foto" className="order-4 sm:order-none">
          <Popover open={imageSourceOpen} onOpenChange={setImageSourceOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
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
          </DraftingGroup>
          </DraftingRail>

          {(tool === 'points' ||
            tool === 'text' ||
            textPlacementPending ||
            tool === 'measure' ||
            tool === 'measure_arc' ||
            tool === 'furniture' ||
            tool === 'pencil' ||
            tool === 'eraser' ||
            (ANNOTATION_TOOLS.includes(tool) &&
              tool !== 'text' &&
              tool !== 'measure' &&
              tool !== 'measure_arc') ||
            (selectedAnnotationId && tool === 'select')) && (
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain border-t border-gold/15 pt-2">
          {tool === 'points' && toolStepHint && (
            <DraftingHint>{toolStepHint}</DraftingHint>
          )}

          {tool === 'points' && (pendingPolyline?.length ?? 0) > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 bg-gold/20 text-gold hover:bg-gold/30"
              disabled={toolsDisabled || (pendingPolyline?.length ?? 0) < 2}
              onClick={() => void finalizePendingPolyline()}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Finalizar linha
            </Button>
          )}

          {(tool === 'text' || textPlacementPending) && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={toolsDisabled}
                    className="h-8 min-w-[3.25rem] px-2 font-mono text-xs tabular-nums text-[#fff6ea] hover:bg-gold/15 hover:text-gold"
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
                className="h-8 w-10 cursor-pointer border border-gold/30 bg-transparent p-0"
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
              {toolStepHint && <DraftingHint>{toolStepHint}</DraftingHint>}
              {tool === 'furniture' && (
                <div className="flex flex-nowrap items-center gap-1">
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
                                ? 'border-gold/50 bg-gold/15 text-[#fff6ea]'
                                : 'border-gold/20 bg-[#120c09]/70 text-[#d4bc9f] hover:bg-gold/10',
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
              <span className="whitespace-nowrap font-display text-[11px] uppercase tracking-[0.16em] text-gold">
                Traço
              </span>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer border border-gold/30 bg-transparent p-0"
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
                className="w-20 shrink-0"
              />
            </>
          )}

          {selectedAnnotationId && tool === 'select' && !toolsDisabled && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 shrink-0"
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
          </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gold/15 pt-2">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className={toolBtnClass} onClick={zoomOut} disabled={disabled || !activeImage}>
                    <ZoomOut className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Diminuir zoom</TooltipContent>
              </Tooltip>

              <span className="min-w-[3.25rem] px-1 text-center font-mono text-sm tabular-nums text-[#fff6ea]">
                {zoomPercent}%
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className={toolBtnClass} onClick={zoomIn} disabled={disabled || !activeImage}>
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
                    variant="ghost"
                    className={toolBtnClass}
                    onClick={() => fitContent(16)}
                    disabled={disabled || !activeImage}
                  >
                    <Scan className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ajustar foto na tela</TooltipContent>
              </Tooltip>
              <div className="mx-1 h-5 w-px bg-gold/25" aria-hidden />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
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
                    variant="ghost"
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
                    variant="ghost"
                    className={toolBtnClass}
                    disabled={toolsDisabled || imageDrawings.length === 0 || historyApplying}
                    onClick={() => void handleDeleteLast()}
                  >
                    <ArrowLeftToLine className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apagar o último desenho</TooltipContent>
              </Tooltip>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
            </div>

            <div className="flex items-center gap-1.5">
          {activeImage && !toolsDisabled && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium text-red-200 hover:bg-destructive/30 hover:text-red-50"
              disabled={disabled}
              onClick={() => {
                void deleteImage({ id: activeImage.id, fileUrl: activeImage.file_url });
                setActiveImageId(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover foto
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs font-medium text-[#fff6ea] hover:bg-gold/15 hover:text-gold"
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

          {isFullscreenLayout && onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className={toolBtnClass} onClick={onClose}>
                    <Minimize2 className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fechar</TooltipContent>
              </Tooltip>
          )}
            </div>
          </div>
          </div>
        </TooltipProvider>
        )}
      </div>

      {!isFullscreenLayout && images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 order-3">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              title={img.observacao?.trim() || img.file_name}
              onClick={() => setActiveImageId(img.id)}
              className={cn(
                'relative shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all',
                activeImageId === img.id
                  ? 'border-gold ring-2 ring-gold/30'
                  : 'border-gold/25 opacity-80 hover:opacity-100',
              )}
            >
              <img src={img.file_url} alt={img.file_name} className="h-full w-full object-cover" />
              {img.observacao?.trim() && (
                <span
                  className="absolute bottom-0 inset-x-0 truncate px-0.5 py-0.5 text-[0.55rem] font-bold leading-tight"
                  style={{ backgroundColor: 'rgba(242,216,146,0.95)', color: '#1a120b' }}
                >
                  {img.observacao.trim()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!isFullscreenLayout && (
        <div className="shrink-0 order-4 space-y-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-display text-xs uppercase tracking-[0.16em] text-gold hover:text-[#fff6ea] transition-colors"
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
          {helpExpanded && <LousaUsageTips isMobile={isMobile} />}
        </div>
      )}

      {typeof leadId === 'number' && (
        <WhiteboardProjectImagePicker
          leadId={leadId}
          open={projectPickerOpen}
          onOpenChange={setProjectPickerOpen}
          elevated={variant === 'fullscreen'}
          existingImageUrls={images.map((img) => img.file_url)}
          onSelect={handleImportFromProject}
          isSelecting={isImportingFromProject}
        />
      )}

      <LeadFolderPickDialog
        open={savePickerOpen}
        onOpenChange={(open) => {
          setSavePickerOpen(open);
          if (!open && pendingSaveFileRef.current) {
            pendingSaveFileRef.current = null;
            if (savePreviewUrlRef.current) {
              URL.revokeObjectURL(savePreviewUrlRef.current);
              savePreviewUrlRef.current = null;
            }
            setSavePreviewUrl(null);
            setIsSavingAttachment(false);
          }
        }}
        leadId={typeof leadId === 'number' ? leadId : null}
        title="Onde guardar esta foto?"
        description="A foto da lousa entra na pasta escolhida. Se houver nota, ela vai junto como arquivo separado (com miniatura da foto)."
        confirmLabel="Salvar nesta pasta"
        previewUrl={savePreviewUrl}
        allowUnfiled={false}
        elevated={variant === 'fullscreen'}
        coverItems={pdfs}
        askFileName
        defaultFileName={saveDefaultFileName}
        defaultFolderId={suggestedFolderIdRef.current}
        defaultFolderName={suggestedFolderNameRef.current}
        notesToggle
        notesCount={noteDraftHasText || activeImage?.observacao?.trim() ? 1 : 0}
        onConfirm={(folderId, options) => confirmSaveToFolder(folderId, options)}
      />

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

function readLeadModalScrollTop(): number | null {
  if (typeof document === 'undefined') return null;
  const body = document.querySelector<HTMLElement>('[data-lead-modal-scroll="true"]');
  return body ? body.scrollTop : null;
}

function restoreLeadModalScrollTop(top: number | null) {
  if (top == null || typeof document === 'undefined') return;
  const apply = () => {
    const body = document.querySelector<HTMLElement>('[data-lead-modal-scroll="true"]');
    if (body) body.scrollTop = top;
  };
  // Vários passos: soltar body { position:fixed } no mobile ainda zera o scroll depois.
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(() => {
      apply();
      for (const ms of [50, 120, 250, 450, 700]) {
        window.setTimeout(apply, ms);
      }
    });
  });
}

/**
 * Sobrevive ao remount do Dialog do lead (quando a flag “não-modal” liga).
 * Sem isso, o Abrir setava a flag, o card remontava a lousa com fullscreen=false
 * e a tela cheia “falhava” — só sobrava scroll no topo + flag órfã.
 */
let whiteboardFullscreenIntent = false;
let whiteboardSavedScrollTop: number | null = null;
/** Pedido de folha branca que sobrevive ao remount do card. */
let whiteboardPendingCreateBlank = false;

function readWhiteboardFullscreenIntent(): boolean {
  if (whiteboardFullscreenIntent) return true;
  if (typeof document === 'undefined') return false;
  return document.documentElement.hasAttribute(WHITEBOARD_FULLSCREEN_ATTR);
}

export function LeadWhiteboard({ leadId, disabled }: LeadWhiteboardProps) {
  const isMobile = useIsMobile();
  const isTouchUi = isTouchOrCompactViewport();
  const [fullscreen, setFullscreen] = useState(readWhiteboardFullscreenIntent);
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

  const [openingFullscreen, setOpeningFullscreen] = useState(false);

  const updateFullscreen = useCallback((open: boolean) => {
    if (!open) {
      whiteboardFullscreenIntent = false;
      whiteboardPendingCreateBlank = false;
      setWhiteboardFullscreenOpenFlag(false);
      const saved = whiteboardSavedScrollTop;
      setFullscreen(false);
      restoreLeadModalScrollTop(saved);
      // Mantém o valor até o unlock do body terminar de bagunçar o scroll.
      window.setTimeout(() => {
        restoreLeadModalScrollTop(saved);
        if (whiteboardSavedScrollTop === saved) {
          whiteboardSavedScrollTop = null;
        }
      }, 800);
      return;
    }
    whiteboardFullscreenIntent = true;
    setFullscreen(true);
  }, []);

  const openFullscreen = useCallback(async (options?: OpenFullscreenOptions) => {
    if (openingFullscreen) return;
    setOpeningFullscreen(true);
    try {
      // Guarda fora do React — o remount do card apagaria um useRef.
      whiteboardSavedScrollTop = readLeadModalScrollTop();
      whiteboardFullscreenIntent = true;
      if (options?.createBlankIfEmpty) {
        whiteboardPendingCreateBlank = true;
      }
      // Flag antes do estado: se o Dialog remountar no meio, o próximo mount
      // já nasce em tela cheia (readWhiteboardFullscreenIntent).
      setWhiteboardFullscreenOpenFlag(true);
      flushSync(() => {
        setFullscreen(true);
      });
      // Se NÃO remountou, a ref desta instância ainda vale — tenta já.
      // Se remountou, o effect abaixo na instância nova cumpre o pedido.
      if (whiteboardPendingCreateBlank && boardRef.current) {
        whiteboardPendingCreateBlank = false;
        await boardRef.current.ensureBlankBoard();
      }
    } catch {
      /* toast já exibido em ensureBlankBoard */
    } finally {
      setOpeningFullscreen(false);
    }
  }, [openingFullscreen]);

  useLayoutEffect(() => {
    if (!fullscreen) return;
    setWhiteboardFullscreenOpenFlag(true);
    return () => {
      // Remount no meio da abertura mantém a intent — não apaga a flag.
      if (!whiteboardFullscreenIntent) {
        setWhiteboardFullscreenOpenFlag(false);
      }
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen || !whiteboardPendingCreateBlank) return;
    let cancelled = false;
    const run = async () => {
      const deadline = Date.now() + 2500;
      while (!cancelled && !boardRef.current && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
      }
      if (cancelled || !whiteboardPendingCreateBlank || !boardRef.current) return;
      whiteboardPendingCreateBlank = false;
      try {
        await boardRef.current.ensureBlankBoard();
      } catch {
        /* toast já exibido em ensureBlankBoard */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (
        typeof document !== 'undefined' &&
        document.documentElement.hasAttribute(PROJECT_IMAGE_PICKER_OPEN_ATTR)
      ) {
        return;
      }
      event.preventDefault();
      updateFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, updateFullscreen]);

  useEffect(() => {
    if (!fullscreen || !(isMobile || isTouchUi)) return;

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
      // Soltar o body no touch costuma zerar o scroll do card — recoloca na hora.
      restoreLeadModalScrollTop(whiteboardSavedScrollTop);
    };
  }, [fullscreen, isMobile, isTouchUi]);

  const handleHeaderSave = () => {
    void boardRef.current?.saveToAttachments();
  };

  const board = (
    <BoardInner
      ref={boardRef}
      leadId={leadId}
      disabled={disabled}
      minHeight={isMobile ? 300 : 380}
      variant={fullscreen ? 'fullscreen' : 'inline'}
      onClose={fullscreen ? () => updateFullscreen(false) : undefined}
      onRequestFullscreen={(options) => {
        void openFullscreen(options);
      }}
      onSaveStateChange={setSaveState}
      className={fullscreen ? 'flex-1 min-h-0 h-full w-full' : undefined}
    />
  );

  return (
    <div
      id="lead-whiteboard"
      className="relative w-full space-y-2 overflow-hidden rounded-xl border border-gold/25 bg-[#1a100c]/40 p-3 sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-2.5">
        <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold tracking-tight text-[#fff6ea]">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-gold/15">
            <ImageIcon className="h-4 w-4 text-gold" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[10px] font-normal uppercase tracking-[0.22em] text-gold/80">
              Lousa
            </span>
            Fotos do lead
          </span>
        </Label>
        {/* Botões mais abaixo do título — longe do cabeçalho do card */}
        {!fullscreen && (
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            {canUploadAttachment && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={!saveState.canSave || openingFullscreen}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={openingFullscreen}
                onClick={() => {
                  // Só expande — não cria quadro branco (isso é o botão “Quadro branco”).
                  void openFullscreen();
                }}
              >
                {openingFullscreen ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
                {isMobile || isTouchUi ? 'Abrir' : 'Tela cheia'}
              </Button>
            )}
          </div>
        )}
      </div>

      {fullscreen ? (
        <>
          <div className="rounded-xl border border-gold/25 bg-[#1a100c]/50 px-3 py-3 text-sm text-[#d4bc9f]">
            Lousa aberta em tela cheia — use o botão de reduzir para voltar.
          </div>
          {createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Lousa em tela cheia"
              data-whiteboard-fullscreen=""
              className={cn(
                leadFullscreenContentClass,
                'fixed inset-0 flex h-[100dvh] max-h-[100dvh] w-[100dvw] flex-col bg-background touch-manipulation',
              )}
            >
              <span className="sr-only">Fotos do lead</span>
              {board}
            </div>,
            document.body,
          )}
        </>
      ) : (
        board
      )}
    </div>
  );
}
