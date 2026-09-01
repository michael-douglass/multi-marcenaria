import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Redo2,
  Save,
  Sofa,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  preventFullscreenOutsideDismiss,
  PROJECT_IMAGE_PICKER_OPEN_ATTR,
  setAmbienteFullscreenOpenFlag,
  setProjectImagePickerOpenFlag,
} from '@/lib/dialog-outside-guard';
import { leadFullscreenContentClass, leadFullscreenOverlayClass } from '@/lib/overlay-z-index';
import { isLikelyImageFile } from '@/lib/whiteboard-image-upload';
import { FurnitureModuleGfx } from '@/components/leads/whiteboard/FurnitureModuleGfx';
import { WhiteboardCameraCapture, type WhiteboardCameraCaptureHandle } from '@/components/leads/whiteboard/WhiteboardCameraCapture';
import { WhiteboardFurnitureCatalog } from '@/components/leads/whiteboard/WhiteboardFurnitureCatalog';
import { WhiteboardProjectImagePicker } from '@/components/leads/whiteboard/WhiteboardProjectImagePicker';
import { containRotatedPlane } from '@/lib/lead-image-studio';
import { AmbienteAtmosphereFoil } from '@/components/leads/ambiente/AmbienteAtmosphereFoil';
import { AmbienteDraftingGrid } from '@/components/leads/ambiente/AmbienteDraftingGrid';
import { AmbienteDrawLayer } from '@/components/leads/ambiente/AmbienteDrawLayer';
import { AmbienteDrawToolbar } from '@/components/leads/ambiente/AmbienteDrawToolbar';
import { AmbienteImageEditHud } from '@/components/leads/ambiente/AmbienteImageEditHud';
import { AmbienteObjectEditHud } from '@/components/leads/ambiente/AmbienteObjectEditHud';
import { AmbientePhotoStudioDialog } from '@/components/leads/ambiente/AmbientePhotoStudioDialog';
import { AmbienteShapeEditHud } from '@/components/leads/ambiente/AmbienteShapeEditHud';
import { AmbienteSceneDock } from '@/components/leads/ambiente/AmbienteSceneDock';
import { AmbienteZoomHud } from '@/components/leads/ambiente/AmbienteZoomHud';
import { RealisticFurnitureObject } from '@/components/leads/ambiente/RealisticFurnitureObject';
import { LeadFolderPickDialog } from '@/components/leads/LeadFolderPickDialog';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { dataUrlToFile } from '@/lib/contrato-anexo-upload';
import { loadImageForRender } from '@/lib/render-image-normalize';
import { sanitizeVisitFileBaseName } from '@/lib/lead-photo-checklist-catalog';
import { whiteboardSaveStamp } from '@/lib/lead-whiteboard-save';
import {
  AMBIENTE_INK,
  appendPencilPoint,
  cloneGeoShapes,
  isDrawCreateTool,
  previewFromDrag,
  resizeBoxShape,
  shapeCenter,
  shapeIsCommitable,
  translateShape,
  wrapShapeRotation,
} from '@/lib/lead-ai-ambiente-draw';
import {
  exportAmbienteCompositionToJpeg,
  exportAmbienteFurnitureReferences,
  fileToImagePreview,
  previewFromImageUrl,
  urlToImagePreview,
} from '@/lib/lead-ai-ambiente-export';
import {
  ambienteDraftHasContent,
  clearAmbienteDraft,
  loadAmbienteDraft,
  saveAmbienteDraft,
} from '@/lib/lead-ai-ambiente-draft';
import { buildAmbienteCenaInventario } from '@/lib/lead-ai-ambiente-inventario';
import { parseAmbienteSugestoes } from '@/lib/lead-ai-ambiente-sugestoes';
import {
  AMBIENTE_ZOOM_FACTOR,
  AMBIENTE_ZOOM_MIN,
  clampAmbienteObjectHeight,
  clampAmbienteObjectWidth,
  clampAmbienteZoom,
  overlaySizeFromZoom,
  wrapPhotoYaw,
  clampPhotoPitch,
  zoomFromObjectWidth,
  zoomFromOverlayWidth,
  planeFromContainFit,
  PHOTO_PLANE,
  planeToViewportBox,
  remapSceneToPlane,
  isUsableAmbienteViewport,
  scaleOverlayBox,
  type AmbienteCoordSpace,
  type AmbienteNormPlane,
} from '@/lib/lead-ai-ambiente-zoom';
import { getFurnitureModuleMeta } from '@/lib/furniture-modules';
import {
  ambienteFurnitureDefaultSize,
  clampOrbitPitch,
  furnitureViewIsFlat,
  wrapOrbitYaw,
  type FurnitureViewMode,
} from '@/lib/furniture-catalog-banks';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import type {
  AmbienteBackground,
  AmbienteDrawTool,
  AmbienteFurnitureObject,
  AmbienteGeoKind,
  AmbienteGeoShape,
  AmbienteImageOverlay,
  AmbienteIncomingPhoto,
  AmbienteLabelMarker,
  AmbienteSuggestion,
} from '@/lib/lead-ai-ambiente-types';

interface LeadAIAmbienteComposerProps {
  leadId: number;
  disabled?: boolean;
  isBusy?: boolean;
  incomingPhoto?: AmbienteIncomingPhoto | null;
  /** JPEG da lousa atual, para o quadro “Antes” quando o render antigo não guardou a montagem. */
  onCompositionPreviewUrl?: (url: string | null) => void;
  onAnalyze: (input: {
    descricao: string;
    imageDataUrl?: string;
    cenaInventario?: string;
  }) => Promise<string>;
  onRender: (input: {
    descricao: string;
    analiseTexto?: string;
    cenaInventario?: string;
    compositionDataUrl?: string;
    sourceImageDataUrl?: string;
    furnitureReferences?: Array<{ label: string; dataUrl: string }>;
  }) => Promise<void> | void;
}

type DragKind =
  | 'object'
  | 'overlay'
  | 'marker'
  | 'resize-overlay'
  | 'resize-object'
  | 'rotate-object'
  | 'orbit-object'
  | 'pan-background'
  | 'rotate-background'
  | 'rotate-overlay'
  | 'orbit-overlay'
  | 'shape'
  | 'resize-shape'
  | 'rotate-shape';

interface DragState {
  kind: DragKind;
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origWidth?: number;
  origHeight?: number;
  origRotation?: number;
  origYaw?: number;
  origPitch?: number;
  startClientX?: number;
  startClientY?: number;
}

interface SceneHistoryEntry {
  background: AmbienteBackground | null;
  overlays: AmbienteImageOverlay[];
  objects: AmbienteFurnitureObject[];
  markers: AmbienteLabelMarker[];
  shapes: AmbienteGeoShape[];
  selectedId: string | null;
}

const HISTORY_LIMIT = 40;

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function cloneScene(entry: SceneHistoryEntry): SceneHistoryEntry {
  return {
    background: entry.background ? { ...entry.background } : null,
    overlays: entry.overlays.map((item) => ({ ...item })),
    objects: entry.objects.map((item) => ({ ...item })),
    markers: entry.markers.map((item) => ({ ...item })),
    shapes: cloneGeoShapes(entry.shapes ?? []),
    selectedId: entry.selectedId,
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function ambienteBlockedMessage(params: {
  kind: 'analyze' | 'render';
  configOff: boolean;
  locked: boolean;
  busy?: boolean;
  canGo: boolean;
}): string | null {
  if (params.configOff) {
    return 'A renderização com ambiente está desligada. Ative em Pipeline → Configurações → IA e confira a chave da API.';
  }
  if (params.kind === 'render' && params.busy) {
    return 'Já existe uma renderização em andamento. Espere ela terminar.';
  }
  if (params.locked) {
    return 'Aguarde a ação atual terminar.';
  }
  if (!params.canGo) {
    return 'Escreva o cômodo no prompt, coloque uma foto ou um móvel na lousa para começar.';
  }
  return null;
}

function SceneDeleteBadge({
  label,
  disabled,
  onRemove,
}: {
  label: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Apagar ${label}`}
      disabled={disabled}
      className="absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#f2d892]/60 bg-[#1c100c] text-[#f2d892] shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-[#3a2218] disabled:opacity-50"
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function wrapPhotoRotation(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function LeadAIAmbienteComposer({
  leadId,
  disabled = false,
  isBusy = false,
  incomingPhoto = null,
  onCompositionPreviewUrl,
  onAnalyze,
  onRender,
}: LeadAIAmbienteComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraCaptureRef = useRef<WhiteboardCameraCaptureHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [descricao, setDescricao] = useState('');
  const [background, setBackground] = useState<AmbienteBackground | null>(null);
  const [overlays, setOverlays] = useState<AmbienteImageOverlay[]>([]);
  const [objects, setObjects] = useState<AmbienteFurnitureObject[]>([]);
  const [markers, setMarkers] = useState<AmbienteLabelMarker[]>([]);
  const [shapes, setShapes] = useState<AmbienteGeoShape[]>([]);
  const [drawTool, setDrawTool] = useState<AmbienteDrawTool>('select');
  const [drawFill, setDrawFill] = useState(false);
  const [drawStroke, setDrawStroke] = useState(AMBIENTE_INK);
  const [drawPreview, setDrawPreview] = useState<AmbienteGeoShape | null>(null);
  const [suggestions, setSuggestions] = useState<AmbienteSuggestion[]>([]);
  const [analiseTexto, setAnaliseTexto] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFlattening, setIsFlattening] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<FurnitureModuleType>('rack');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [isImportingProject, setIsImportingProject] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [photoPulse, setPhotoPulse] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [isSavingCopy, setIsSavingCopy] = useState(false);
  const [sourceFolderId, setSourceFolderId] = useState<string | null>(null);
  const [photoStudioOpen, setPhotoStudioOpen] = useState(false);
  const [photoStudioCrop, setPhotoStudioCrop] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [viewportSize, setViewportSize] = useState({ w: 1, h: 1 });
  const [photoSpaceReady, setPhotoSpaceReady] = useState(false);
  /** Impede usar o tamanho da tela cheia na lousa pequena (e o contrário). */
  const [fittedHost, setFittedHost] = useState<'card' | 'fullscreen' | null>(null);
  const viewportSizeRef = useRef(viewportSize);
  viewportSizeRef.current = viewportSize;
  const layoutHost = isFullscreen ? 'fullscreen' : 'card';
  const planeFitsHost =
    fittedHost === layoutHost && isUsableAmbienteViewport(viewportSize.w, viewportSize.h);
  const photoSpaceReadyRef = useRef(false);
  photoSpaceReadyRef.current = photoSpaceReady;
  const coordSpaceRef = useRef<AmbienteCoordSpace>('viewport');
  const photoPlaneRef = useRef<HTMLDivElement>(null);
  const lastPhotoPlaneRef = useRef<AmbienteNormPlane>(PHOTO_PLANE);
  const scenePlaneRef = useRef<AmbienteNormPlane | null>(null);
  const historyRef = useRef<SceneHistoryEntry[]>([]);
  const redoRef = useRef<SceneHistoryEntry[]>([]);
  const pendingHistoryRef = useRef<SceneHistoryEntry | null>(null);
  const renderStartedRef = useRef(false);
  const persistComposerDraftRef = useRef<() => void>(() => {});

  const exportViewport = useCallback((): { width: number; height: number } | undefined => {
    const size = viewportSizeRef.current;
    if (!isUsableAmbienteViewport(size.w, size.h)) return undefined;
    return { width: size.w, height: size.h };
  }, []);

  const updateFullscreen = useCallback((open: boolean) => {
    if (!open) persistComposerDraftRef.current();
    setFittedHost(null);
    setAmbienteFullscreenOpenFlag(open);
    setIsFullscreen(open);
  }, []);

  const { uploadAttachment, pdfs } = useLeadPDFs(leadId);

  const locked = disabled || isAnalyzing || isFlattening || isSavingCopy;
  const hasComposition =
    Boolean(background) || objects.length > 0 || overlays.length > 0 || markers.length > 0 || shapes.length > 0;
  const canAnalyze = descricao.trim().length > 0 || hasComposition;
  const canRender = canAnalyze || hasComposition;
  const canUndo = historyCount > 0 && !locked;
  const canRedo = redoCount > 0 && !locked;

  useEffect(() => {
    let cancelled = false;
    setDraftReady(false);
    setDraftRestored(false);
    setPhotoSpaceReady(false);
    setFittedHost(null);
    coordSpaceRef.current = 'viewport';
    scenePlaneRef.current = null;
    lastPhotoPlaneRef.current = PHOTO_PLANE;
    onCompositionPreviewUrl?.(null);
    void (async () => {
      const draft = await loadAmbienteDraft(leadId);
      if (cancelled) return;
      if (draft && ambienteDraftHasContent(draft)) {
        const restoredSpace: AmbienteCoordSpace =
          draft.coordSpace === 'photo' && draft.background ? 'photo' : 'viewport';
        coordSpaceRef.current = restoredSpace;
        setPhotoSpaceReady(restoredSpace === 'photo');
        setDescricao(draft.descricao);
        setBackground(draft.background);
        setOverlays(draft.overlays);
        setObjects(draft.objects);
        setMarkers(draft.markers);
        setShapes(draft.shapes);
        setSelectedId(draft.selectedId);
        setSourceFolderId(draft.sourceFolderId);
        setDraftRestored(true);
        if (onCompositionPreviewUrl && (draft.background || draft.overlays.length > 0)) {
          void exportAmbienteCompositionToJpeg({
            background: draft.background,
            overlays: draft.overlays,
            objects: draft.objects,
            markers: draft.markers,
            shapes: draft.shapes,
            viewport: exportViewport(),
            coordSpace: restoredSpace,
          })
            .then((exported) => {
              if (!cancelled) onCompositionPreviewUrl(exported.dataUrl);
            })
            .catch(() => {
              if (!cancelled) onCompositionPreviewUrl(null);
            });
        }
      }
      setDraftReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, onCompositionPreviewUrl]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      void saveAmbienteDraft({
        leadId,
        savedAt: Date.now(),
        descricao,
        background,
        overlays,
        objects,
        markers,
        shapes,
        selectedId,
        sourceFolderId,
        coordSpace: photoSpaceReady ? 'photo' : 'viewport',
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    background,
    descricao,
    draftReady,
    leadId,
    markers,
    objects,
    overlays,
    selectedId,
    shapes,
    sourceFolderId,
    photoSpaceReady,
  ]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const host = isFullscreen ? 'fullscreen' : 'card';
    const update = () => {
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      setViewportSize({ w, h });
      if (isUsableAmbienteViewport(w, h)) setFittedHost(host);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullscreen, catalogOpen, draftReady, background]);

  const bgFit =
    background && isUsableAmbienteViewport(viewportSize.w, viewportSize.h)
      ? containRotatedPlane(
          background.naturalWidth || 1,
          background.naturalHeight || 1,
          viewportSize.w,
          viewportSize.h,
          background.rotation ?? 0,
        )
      : null;
  const scenePlane: AmbienteNormPlane = bgFit
    ? planeFromContainFit(bgFit.nw, bgFit.nh)
    : { left: 0, top: 0, width: 1, height: 1 };

  useLayoutEffect(() => {
    scenePlaneRef.current = scenePlane;
    if (!draftReady) return;
    if (fittedHost !== layoutHost) return;
    if (!isUsableAmbienteViewport(viewportSize.w, viewportSize.h)) return;

    const scene = {
      overlays: overlaysRef.current,
      objects: objectsRef.current,
      markers: markersRef.current,
      shapes: shapesRef.current,
    };

    const remapHistories = (from: AmbienteNormPlane, to: AmbienteNormPlane) => {
      const mapEntry = (entry: SceneHistoryEntry): SceneHistoryEntry => ({
        ...entry,
        ...remapSceneToPlane(entry, from, to),
      });
      historyRef.current = historyRef.current.map(mapEntry);
      redoRef.current = redoRef.current.map(mapEntry);
    };

    const applyScene = (next: typeof scene, space: AmbienteCoordSpace) => {
      coordSpaceRef.current = space;
      setPhotoSpaceReady(space === 'photo');
      setOverlays(next.overlays);
      setObjects(next.objects);
      setMarkers(next.markers);
      setShapes(next.shapes);
    };

    if (background?.url && coordSpaceRef.current === 'viewport') {
      remapHistories(scenePlane, PHOTO_PLANE);
      applyScene(remapSceneToPlane(scene, scenePlane, PHOTO_PLANE), 'photo');
      lastPhotoPlaneRef.current = scenePlane;
      return;
    }

    if (!background?.url && coordSpaceRef.current === 'photo') {
      const fromPlane = lastPhotoPlaneRef.current;
      remapHistories(PHOTO_PLANE, fromPlane);
      applyScene(remapSceneToPlane(scene, PHOTO_PLANE, fromPlane), 'viewport');
      return;
    }

    if (background?.url) lastPhotoPlaneRef.current = scenePlane;
  }, [
    background?.url,
    draftReady,
    fittedHost,
    layoutHost,
    scenePlane.left,
    scenePlane.top,
    scenePlane.width,
    scenePlane.height,
    viewportSize.h,
    viewportSize.w,
  ]);

  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const drawToolRef = useRef(drawTool);
  drawToolRef.current = drawTool;
  const drawFillRef = useRef(drawFill);
  drawFillRef.current = drawFill;
  const drawColorRef = useRef(drawStroke);
  drawColorRef.current = drawStroke;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const descricaoRef = useRef(descricao);
  descricaoRef.current = descricao;
  const sourceFolderIdRef = useRef(sourceFolderId);
  sourceFolderIdRef.current = sourceFolderId;
  const draftReadyRef = useRef(draftReady);
  draftReadyRef.current = draftReady;
  persistComposerDraftRef.current = () => {
    if (!draftReadyRef.current) return;
    void saveAmbienteDraft({
      leadId,
      savedAt: Date.now(),
      descricao: descricaoRef.current,
      background: backgroundRef.current,
      overlays: overlaysRef.current,
      objects: objectsRef.current,
      markers: markersRef.current,
      shapes: shapesRef.current,
      selectedId: selectedIdRef.current,
      sourceFolderId: sourceFolderIdRef.current,
      coordSpace: photoSpaceReadyRef.current ? 'photo' : 'viewport',
    });
  };
  const shapeOrigRef = useRef<AmbienteGeoShape | null>(null);
  const drawStrokeRef = useRef<{
    id: string;
    kind: AmbienteGeoKind;
    start: { x: number; y: number };
    points: { x: number; y: number }[];
  } | null>(null);
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    angle: number;
    rotation: number;
  } | null>(null);
  const ignoreWheelUntilRef = useRef(0);

  const readScene = useCallback((): SceneHistoryEntry => ({
    background: backgroundRef.current,
    overlays: overlaysRef.current,
    objects: objectsRef.current,
    markers: markersRef.current,
    shapes: shapesRef.current,
    selectedId: selectedIdRef.current,
  }), []);

  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current, cloneScene(readScene())].slice(-HISTORY_LIMIT);
    redoRef.current = [];
    setHistoryCount(historyRef.current.length);
    setRedoCount(0);
  }, [readScene]);

  const handleDrawStrokeChange = useCallback(
    (hex: string) => {
      setDrawStroke(hex);
      const currentId = selectedIdRef.current;
      if (!currentId) return;
      const selected = shapesRef.current.find((shape) => shape.id === currentId);
      if (!selected || selected.stroke.toLowerCase() === hex.toLowerCase()) return;
      pushHistory();
      setShapes((prev) =>
        prev.map((shape) => (shape.id === currentId ? { ...shape, stroke: hex } : shape)),
      );
    },
    [pushHistory],
  );

  const undoLast = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    redoRef.current = [...redoRef.current, cloneScene(readScene())].slice(-HISTORY_LIMIT);
    setHistoryCount(historyRef.current.length);
    setRedoCount(redoRef.current.length);
    setBackground(previous.background);
    setOverlays(previous.overlays);
    setObjects(previous.objects);
    setMarkers(previous.markers);
    setShapes(previous.shapes ?? []);
    setSelectedId(previous.selectedId);
    setDrawPreview(null);
    setDrag(null);
  }, [readScene]);

  const redoLast = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current = [...historyRef.current, cloneScene(readScene())].slice(-HISTORY_LIMIT);
    setHistoryCount(historyRef.current.length);
    setRedoCount(redoRef.current.length);
    setBackground(next.background);
    setOverlays(next.overlays);
    setObjects(next.objects);
    setMarkers(next.markers);
    setShapes(next.shapes ?? []);
    setSelectedId(next.selectedId);
    setDrawPreview(null);
    setDrag(null);
  }, [readScene]);

  const pulseComposer = useCallback(() => {
    setPhotoPulse(true);
    window.setTimeout(() => setPhotoPulse(false), 1200);
  }, []);

  const toggleCatalog = useCallback(() => {
    setCatalogOpen((open) => !open);
  }, []);

  const setPhotoAsBackgroundOrOverlay = useCallback(async (preview: AmbienteBackground) => {
    const current = backgroundRef.current;
    if (!current) {
      pushHistory();
      setBackground({
        ...preview,
        scale: preview.scale ?? 1,
        offsetX: preview.offsetX ?? 0.5,
        offsetY: preview.offsetY ?? 0.5,
      });
      setSelectedId('background');
      pulseComposer();
      return;
    }
    const existingOverlay = overlaysRef.current.find((item) => item.url === preview.url);
    if (existingOverlay) {
      setSelectedId(existingOverlay.id);
      pulseComposer();
      return;
    }
    pushHistory();
    const id = newId('ov');
    const aspect = (preview.naturalWidth || 1) / Math.max(preview.naturalHeight || 1, 1);
    const plane = scenePlaneRef.current;
    const sceneAspect = photoSpaceReadyRef.current && plane
      ? (plane.width * viewportSizeRef.current.w) / Math.max(plane.height * viewportSizeRef.current.h, 1)
      : (viewportRef.current?.clientWidth || 1) / Math.max(viewportRef.current?.clientHeight || 1, 1);
    const size = overlaySizeFromZoom(1, aspect, sceneAspect);
    setOverlays((prev) => [
      ...prev,
      {
        id,
        url: preview.url,
        label: preview.label,
        x: 0.12 + (prev.length % 3) * 0.08,
        y: 0.18 + (prev.length % 3) * 0.07,
        width: size.width,
        height: size.height,
        rotation: 0,
        yaw: 0,
        pitch: 0,
        flipH: false,
        flipV: false,
        zIndex: prev.length + 1,
      },
    ]);
    setSelectedId(id);
    pulseComposer();
  }, [pulseComposer, pushHistory]);

  const handleFileList = useCallback(
    async (files: FileList | File[] | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!isLikelyImageFile(file)) {
        toast.error('Selecione uma imagem válida');
        return;
      }
      try {
        const preview = await fileToImagePreview(file);
        await setPhotoAsBackgroundOrOverlay(preview);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível ler a foto');
      }
    },
    [setPhotoAsBackgroundOrOverlay],
  );

  const setPhotoRef = useRef(setPhotoAsBackgroundOrOverlay);
  setPhotoRef.current = setPhotoAsBackgroundOrOverlay;

  useEffect(() => {
    if (!draftReady) return;
    if (!incomingPhoto?.url) return;
    const photo = incomingPhoto;
    let cancelled = false;
    void (async () => {
      try {
        const preview = await urlToImagePreview(photo.url, photo.label);
        if (cancelled) return;
        if (photo.asBackground) {
          if (backgroundRef.current) pushHistory();
          setBackground({
            ...preview,
            scale: preview.scale ?? 1,
            offsetX: preview.offsetX ?? 0.5,
            offsetY: preview.offsetY ?? 0.5,
          });
          setSelectedId('background');
          pulseComposer();
        } else {
          await setPhotoRef.current(preview);
        }
        toast.success('Foto na lousa', {
          description: 'Agora você pode medir, anotar e posicionar móveis em cima dela.',
        });
      } catch (err) {
        if (cancelled) return;
        setBackground({
          url: photo.url,
          label: photo.label,
          naturalWidth: 960,
          naturalHeight: 640,
          scale: 1,
          offsetX: 0.5,
          offsetY: 0.5,
          rotation: 0,
          flipH: false,
          flipV: false,
        });
        setSelectedId('background');
        pulseComposer();
        toast.error(err instanceof Error ? err.message : 'A foto entrou na lousa, mas o ajuste fino falhou');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftReady, incomingPhoto?.asBackground, incomingPhoto?.label, incomingPhoto?.nonce, incomingPhoto?.url, pulseComposer, pushHistory]);

  const readSelectedScale = useCallback((): number => {
    const id = selectedIdRef.current;
    if (id === 'background' || (!id && backgroundRef.current)) {
      return backgroundRef.current?.scale ?? 1;
    }
    const overlay = overlaysRef.current.find((item) => item.id === id);
    if (overlay) return zoomFromOverlayWidth(overlay.width, overlay.height);
    const object = objectsRef.current.find((item) => item.id === id);
    if (object) return zoomFromObjectWidth(object.width);
    return backgroundRef.current?.scale ?? 1;
  }, []);

  const applySelectedScale = useCallback((nextScale: number) => {
    const zoom = clampAmbienteZoom(nextScale);
    const id = selectedIdRef.current;
    if (!id || id === 'background') {
      setBackground((prev) => (prev ? { ...prev, scale: zoom } : prev));
      if (!id) setSelectedId('background');
      return;
    }
    const overlay = overlaysRef.current.find((item) => item.id === id);
    if (overlay) {
      const currentZoom = Math.max(AMBIENTE_ZOOM_MIN, zoomFromOverlayWidth(overlay.width, overlay.height));
      const factor = zoom / currentZoom;
      const next = scaleOverlayBox(overlay, factor);
      setOverlays((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...next } : item)),
      );
      return;
    }
    if (objectsRef.current.some((item) => item.id === id)) {
      const current = objectsRef.current.find((item) => item.id === id);
      if (!current) return;
      const currentZoom = Math.max(0.08, zoomFromObjectWidth(current.width));
      const factor = zoom / currentZoom;
      setObjects((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                width: clampAmbienteObjectWidth(item.width * factor),
                height: clampAmbienteObjectHeight(item.height * factor),
              }
            : item,
        ),
      );
    }
  }, []);

  const nudgeSelectedScale = useCallback(
    (direction: 1 | -1) => {
      const factor = direction > 0 ? AMBIENTE_ZOOM_FACTOR : 1 / AMBIENTE_ZOOM_FACTOR;
      applySelectedScale(readSelectedScale() * factor);
    },
    [applySelectedScale, readSelectedScale],
  );

  const scaleSelectedObject = useCallback((factor: number) => {
    const id = selectedIdRef.current;
    if (!id || !objectsRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              width: clampAmbienteObjectWidth(item.width * factor),
              height: clampAmbienteObjectHeight(item.height * factor),
            }
          : item,
      ),
    );
  }, [pushHistory]);

  const nudgeSelectedObjectWidth = useCallback((factor: number) => {
    const id = selectedIdRef.current;
    if (!id || !objectsRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, width: clampAmbienteObjectWidth(item.width * factor) } : item,
      ),
    );
  }, [pushHistory]);

  const rotateSelectedObject = useCallback((deltaDeg: number) => {
    const id = selectedIdRef.current;
    if (!id || !objectsRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) => (item.id === id ? { ...item, rotation: (item.rotation ?? 0) + deltaDeg } : item)),
    );
  }, [pushHistory]);

  const rotateSelectedPhoto = useCallback((deltaDeg: number) => {
    const id = selectedIdRef.current;
    pushHistory();
    if (id && overlaysRef.current.some((item) => item.id === id)) {
      setOverlays((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, rotation: wrapPhotoRotation((item.rotation ?? 0) + deltaDeg) } : item,
        ),
      );
      return;
    }
    setBackground((prev) =>
      prev ? { ...prev, rotation: wrapPhotoRotation((prev.rotation ?? 0) + deltaDeg) } : prev,
    );
    if (!id) setSelectedId('background');
  }, [pushHistory]);

  const setSelectedPhotoRotation = useCallback((deg: number) => {
    const id = selectedIdRef.current;
    const next = wrapPhotoRotation(deg);
    if (id && overlaysRef.current.some((item) => item.id === id)) {
      setOverlays((prev) =>
        prev.map((item) => (item.id === id ? { ...item, rotation: next } : item)),
      );
      return;
    }
    setBackground((prev) => (prev ? { ...prev, rotation: next } : prev));
    if (!id) setSelectedId('background');
  }, []);

  const rotateSelectedShape = useCallback((deltaDeg: number) => {
    const id = selectedIdRef.current;
    if (!id || !shapesRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setShapes((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, rotation: wrapShapeRotation((item.rotation ?? 0) + deltaDeg) } : item,
      ),
    );
  }, [pushHistory]);

  const setSelectedShapeRotation = useCallback((deg: number) => {
    const id = selectedIdRef.current;
    if (!id || !shapesRef.current.some((item) => item.id === id)) return;
    const next = wrapShapeRotation(deg);
    setShapes((prev) => prev.map((item) => (item.id === id ? { ...item, rotation: next } : item)));
  }, []);

  const snapSelectedShapeRotation = useCallback((deg: number) => {
    const id = selectedIdRef.current;
    if (!id || !shapesRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setShapes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, rotation: wrapShapeRotation(deg) } : item)),
    );
  }, [pushHistory]);

  const flipSelectedPhoto = useCallback((axis: 'h' | 'v') => {
    const id = selectedIdRef.current;
    pushHistory();
    if (id && overlaysRef.current.some((item) => item.id === id)) {
      setOverlays((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                flipH: axis === 'h' ? !item.flipH : item.flipH,
                flipV: axis === 'v' ? !item.flipV : item.flipV,
              }
            : item,
        ),
      );
      return;
    }
    setBackground((prev) =>
      prev
        ? {
            ...prev,
            flipH: axis === 'h' ? !prev.flipH : prev.flipH,
            flipV: axis === 'v' ? !prev.flipV : prev.flipV,
          }
        : prev,
    );
    if (!id) setSelectedId('background');
  }, [pushHistory]);

  const selectedPhotoUrl = (): string | null => {
    const id = selectedIdRef.current;
    const overlay = id ? overlaysRef.current.find((item) => item.id === id) : null;
    if (overlay) return overlay.url;
    return backgroundRef.current?.url ?? null;
  };

  const openPhotoStudio = useCallback((startInCrop: boolean) => {
    if (!selectedPhotoUrl()) {
      toast.error('Selecione uma foto na lousa para editar');
      return;
    }
    setPhotoStudioCrop(startInCrop);
    setPhotoStudioOpen(true);
  }, []);

  const applyStudioBakedUrl = useCallback(async (bakedUrl: string) => {
    const id = selectedIdRef.current;
    const overlay = id ? overlaysRef.current.find((item) => item.id === id) : null;
    const img = await loadImageForRender(bakedUrl);
    const naturalWidth = img.naturalWidth || img.width || 1;
    const naturalHeight = img.naturalHeight || img.height || 1;
    pushHistory();
    if (overlay) {
      const plane = scenePlaneRef.current;
      const sceneAspect = photoSpaceReadyRef.current && plane
        ? (plane.width * viewportSizeRef.current.w) / Math.max(plane.height * viewportSizeRef.current.h, 1)
        : (viewportRef.current?.clientWidth || 1) / Math.max(viewportRef.current?.clientHeight || 1, 1);
      const zoom = zoomFromOverlayWidth(overlay.width, overlay.height);
      const size = overlaySizeFromZoom(zoom, naturalWidth / Math.max(naturalHeight, 1), sceneAspect);
      const cx = overlay.x + overlay.width / 2;
      const cy = overlay.y + overlay.height / 2;
      setOverlays((prev) =>
        prev.map((item) =>
          item.id === overlay.id
            ? {
                ...item,
                url: bakedUrl,
                width: size.width,
                height: size.height,
                x: cx - size.width / 2,
                y: cy - size.height / 2,
              }
            : item,
        ),
      );
      toast.success('Foto atualizada na lousa', {
        description: 'Recorte, fundo e luz já entram na renderização e no salvar.',
      });
      return;
    }
    setBackground((prev) =>
      prev
        ? {
            ...prev,
            url: bakedUrl,
            naturalWidth,
            naturalHeight,
          }
        : prev,
    );
    if (!id) setSelectedId('background');
    toast.success('Foto atualizada na lousa', {
      description: 'Recorte, fundo e luz já entram na renderização e no salvar.',
    });
  }, [pushHistory]);

  const orbitSelectedPhotoYaw = useCallback((deltaDeg: number) => {
    const id = selectedIdRef.current;
    if (!id || !overlaysRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setOverlays((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, yaw: wrapPhotoYaw((item.yaw ?? 0) + deltaDeg) } : item,
      ),
    );
  }, [pushHistory]);

  const orbitSelectedPhotoPitch = useCallback((deltaDeg: number) => {
    const id = selectedIdRef.current;
    if (!id || !overlaysRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setOverlays((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pitch: clampPhotoPitch((item.pitch ?? 0) + deltaDeg) } : item,
      ),
    );
  }, [pushHistory]);

  const setSelectedPhotoYaw = useCallback((deg: number) => {
    const id = selectedIdRef.current;
    if (!id || !overlaysRef.current.some((item) => item.id === id)) return;
    setOverlays((prev) =>
      prev.map((item) => (item.id === id ? { ...item, yaw: wrapPhotoYaw(deg) } : item)),
    );
  }, []);

  const setSelectedPhotoPitch = useCallback((deg: number) => {
    const id = selectedIdRef.current;
    if (!id || !overlaysRef.current.some((item) => item.id === id)) return;
    setOverlays((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pitch: clampPhotoPitch(deg) } : item)),
    );
  }, []);

  const setSelectedPhotoOrbit = useCallback((yaw: number, pitch?: number) => {
    const id = selectedIdRef.current;
    if (!id || !overlaysRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setOverlays((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              yaw: wrapPhotoYaw(yaw),
              pitch: clampPhotoPitch(pitch ?? item.pitch ?? 0),
            }
          : item,
      ),
    );
  }, [pushHistory]);

  const orbitSelectedYaw = useCallback((deltaDeg: number) => {
    const id = selectedIdRef.current;
    if (!id || !objectsRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, yaw: wrapOrbitYaw((item.yaw ?? 0) + deltaDeg) } : item,
      ),
    );
  }, [pushHistory]);

  const orbitSelectedPitch = useCallback((deltaDeg: number) => {
    const id = selectedIdRef.current;
    if (!id || !objectsRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pitch: clampOrbitPitch((item.pitch ?? 0) + deltaDeg) } : item,
      ),
    );
  }, [pushHistory]);

  const setSelectedOrbit = useCallback((yaw: number, pitch?: number) => {
    const id = selectedIdRef.current;
    if (!id || !objectsRef.current.some((item) => item.id === id)) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              yaw: wrapOrbitYaw(yaw),
              pitch: clampOrbitPitch(pitch ?? item.pitch ?? 0),
            }
          : item,
      ),
    );
  }, [pushHistory]);

  const changeSelectedObjectType = useCallback((moduleType: FurnitureModuleType) => {
    const id = selectedIdRef.current;
    if (!id) return;
    const meta = getFurnitureModuleMeta(moduleType);
    pushHistory();
    setObjects((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, moduleType, label: meta.label } : item,
      ),
    );
    setSelectedFurnitureType(moduleType);
  }, [pushHistory]);

  const changeSelectedViewMode = useCallback((viewMode: FurnitureViewMode) => {
    const id = selectedIdRef.current;
    if (!id) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) => (item.id === id ? { ...item, viewMode } : item)),
    );
  }, [pushHistory]);

  const changeSelectedObjectColor = useCallback((colorHex: string) => {
    const id = selectedIdRef.current;
    if (!id) return;
    pushHistory();
    setObjects((prev) =>
      prev.map((item) => (item.id === id ? { ...item, colorHex } : item)),
    );
  }, [pushHistory]);

  const handlePlaceFurniture = useCallback((moduleType: FurnitureModuleType, viewMode: FurnitureViewMode = '3d') => {
    const meta = getFurnitureModuleMeta(moduleType);
    const size = ambienteFurnitureDefaultSize(moduleType, viewMode);
    const id = newId('fur');
    pushHistory();
    setObjects((prev) => [
      ...prev,
      {
        id,
        moduleType,
        label: meta.label,
        x: 0.5,
        y: 0.58,
        width: size.width,
        height: size.height,
        rotation: 0,
        yaw: 0,
        pitch: 0,
        colorHex: '#f2d892',
        viewMode,
      },
    ]);
    setSelectedFurnitureType(moduleType);
    setSelectedId(id);
    setDrawTool('select');
  }, [pushHistory]);

  const handleApplySuggestion = useCallback((suggestion: AmbienteSuggestion) => {
    if (suggestion.tipoModulo) {
      handlePlaceFurniture(suggestion.tipoModulo);
      return;
    }
    const id = newId('mk');
    pushHistory();
    setMarkers((prev) => [
      ...prev,
      {
        id,
        nome: suggestion.nome,
        x: 0.35 + (prev.length % 4) * 0.12,
        y: 0.42 + Math.floor(prev.length / 4) * 0.12,
      },
    ]);
    setSelectedId(id);
  }, [handlePlaceFurniture, pushHistory]);

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) {
      toast.error('Descreva o ambiente, desenhe na lousa ou insira uma foto');
      return;
    }
    setIsAnalyzing(true);
    try {
      let imageDataUrl: string | undefined;
      if (hasComposition) {
        const exported = await exportAmbienteCompositionToJpeg({
          background,
          overlays,
          objects,
          markers,
          shapes,
          viewport: exportViewport(),
          coordSpace: photoSpaceReady ? 'photo' : 'viewport',
        });
        imageDataUrl = exported.dataUrl;
      }
      const cenaInventario = buildAmbienteCenaInventario({
        descricao: descricao.trim(),
        background,
        overlays,
        objects,
        markers,
        shapes,
      });
      const yaml = await onAnalyze({
        descricao: descricao.trim(),
        imageDataUrl,
        cenaInventario,
      });
      setAnaliseTexto(yaml);
      setSuggestions(parseAmbienteSugestoes(yaml));
      toast.success('Sugestões prontas — clique para posicionar na cena');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível desmembrar o ambiente');
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    background,
    canAnalyze,
    descricao,
    exportViewport,
    hasComposition,
    markers,
    objects,
    onAnalyze,
    overlays,
    shapes,
    photoSpaceReady,
  ]);

  const handleRenderAmbiente = useCallback(async () => {
    if (!canRender) {
      toast.error('Descreva o ambiente, insira uma foto ou posicione um objeto');
      return;
    }
    if (locked || isBusy || renderStartedRef.current) {
      const blocked = ambienteBlockedMessage({
        kind: 'render',
        configOff: disabled,
        locked,
        busy: isBusy || isFlattening,
        canGo: canRender,
      });
      if (blocked) {
        setActionNotice(blocked);
        toast.error(blocked);
      }
      return;
    }
    renderStartedRef.current = true;
    setIsFlattening(true);
    try {
      let compositionDataUrl: string | undefined;
      if (hasComposition) {
        const exported = await exportAmbienteCompositionToJpeg({
          background,
          overlays,
          objects,
          markers,
          shapes,
          viewport: exportViewport(),
          coordSpace: photoSpaceReady ? 'photo' : 'viewport',
        });
        compositionDataUrl = exported.dataUrl;
      } else if (background) {
        const exported = await exportAmbienteCompositionToJpeg({
          background,
          overlays: [],
          objects: [],
          markers: [],
          viewport: exportViewport(),
          coordSpace: photoSpaceReady ? 'photo' : 'viewport',
        });
        compositionDataUrl = exported.dataUrl;
      }
      const cenaInventario = buildAmbienteCenaInventario({
        descricao: descricao.trim(),
        background,
        overlays,
        objects,
        markers,
        shapes,
      });
      const furnitureReferences =
        overlays.length > 0 ? await exportAmbienteFurnitureReferences(overlays) : undefined;
      updateFullscreen(false);
      setIsFlattening(false);
      renderStartedRef.current = false;
      void Promise.resolve(
        onRender({
          descricao: descricao.trim(),
          analiseTexto: analiseTexto ?? undefined,
          cenaInventario,
          compositionDataUrl,
          sourceImageDataUrl: background?.url,
          furnitureReferences,
        }),
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Não foi possível renderizar o ambiente';
        setActionNotice(message);
        toast.error(message);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível renderizar o ambiente';
      setActionNotice(message);
      toast.error(message);
      renderStartedRef.current = false;
      setIsFlattening(false);
    }
  }, [
    analiseTexto,
    background,
    canRender,
    descricao,
    disabled,
    exportViewport,
    hasComposition,
    isBusy,
    isFlattening,
    locked,
    markers,
    objects,
    onRender,
    overlays,
    shapes,
    updateFullscreen,
    photoSpaceReady,
  ]);

  const pointerToNorm = useCallback((
    event: { clientX: number; clientY: number },
    space: 'auto' | 'viewport' = 'auto',
  ) => {
    const usePhoto =
      space !== 'viewport' && photoSpaceReady && photoPlaneRef.current;
    const rect = usePhoto
      ? photoPlaneRef.current!.getBoundingClientRect()
      : viewportRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, [photoSpaceReady]);

  const beginDrag = useCallback(
    (
      kind: DragKind,
      id: string,
      x: number,
      y: number,
      event: ReactPointerEvent,
      size?: { width?: number; height?: number; rotation?: number; yaw?: number; pitch?: number },
    ) => {
      if (locked) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      pendingHistoryRef.current = cloneScene(readScene());
      if (kind === 'shape' || kind === 'resize-shape' || kind === 'rotate-shape') {
        shapeOrigRef.current = shapesRef.current.find((item) => item.id === id) ?? null;
      }
      const point = pointerToNorm(
        event,
        kind === 'pan-background' || kind === 'rotate-background' ? 'viewport' : 'auto',
      );
      setSelectedId(id);
      setDrag({
        kind,
        id,
        startX: point.x,
        startY: point.y,
        origX: x,
        origY: y,
        origWidth: size?.width,
        origHeight: size?.height,
        origRotation: size?.rotation,
        origYaw: size?.yaw,
        origPitch: size?.pitch,
        startClientX: event.clientX,
        startClientY: event.clientY,
      });
    },
    [locked, pointerToNorm, readScene],
  );

  const onViewportPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      const point = pointerToNorm(
        event,
        drag.kind === 'pan-background' || drag.kind === 'rotate-background' ? 'viewport' : 'auto',
      );
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      if (drag.kind === 'pan-background') {
        setBackground((prev) =>
          prev
            ? {
                ...prev,
                offsetX: Math.min(1, Math.max(0, drag.origX + dx)),
                offsetY: Math.min(1, Math.max(0, drag.origY + dy)),
              }
            : prev,
        );
        return;
      }
      if (drag.kind === 'resize-overlay' && drag.origWidth != null && drag.origHeight != null) {
        const factor = Math.max(0.05, 1 + dx * 2.4);
        const next = scaleOverlayBox(
          { x: drag.origX, y: drag.origY, width: drag.origWidth, height: drag.origHeight },
          factor,
        );
        setOverlays((prev) =>
          prev.map((item) => (item.id === drag.id ? { ...item, ...next } : item)),
        );
        return;
      }
      if (drag.kind === 'shape') {
        const orig = shapeOrigRef.current;
        if (orig) {
          setShapes((prev) =>
            prev.map((item) => (item.id === drag.id ? translateShape(orig, dx, dy) : item)),
          );
        }
        return;
      }
      if (drag.kind === 'resize-shape' && drag.origWidth != null && drag.origHeight != null) {
        const orig = shapeOrigRef.current;
        if (orig) {
          const factor = Math.max(0.25, 1 + dx * 2.4);
          setShapes((prev) =>
            prev.map((item) =>
              item.id === drag.id
                ? resizeBoxShape(orig, {
                    x: drag.origX,
                    y: drag.origY,
                    width: drag.origWidth!,
                    height: drag.origHeight!,
                  }, factor)
                : item,
            ),
          );
        }
        return;
      }
      if (drag.kind === 'rotate-shape') {
        const orig = shapeOrigRef.current;
        const cx = orig ? shapeCenter(orig).x : drag.origX;
        const cy = orig ? shapeCenter(orig).y : drag.origY;
        const angleNow = (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI;
        const angleStart = (Math.atan2(drag.startY - cy, drag.startX - cx) * 180) / Math.PI;
        const rotation = wrapShapeRotation((drag.origRotation ?? 0) + (angleNow - angleStart));
        setShapes((prev) =>
          prev.map((item) => (item.id === drag.id ? { ...item, rotation } : item)),
        );
        return;
      }
      if (drag.kind === 'resize-object' && drag.origWidth != null && drag.origHeight != null) {
        const factor = Math.max(0.25, 1 + dx * 2.4);
        setObjects((prev) =>
          prev.map((item) =>
            item.id === drag.id
              ? {
                  ...item,
                  width: clampAmbienteObjectWidth(drag.origWidth! * factor),
                  height: clampAmbienteObjectHeight(drag.origHeight! * factor),
                }
              : item,
          ),
        );
        return;
      }
      if (drag.kind === 'rotate-object') {
        const angleNow = (Math.atan2(point.y - drag.origY, point.x - drag.origX) * 180) / Math.PI;
        const angleStart = (Math.atan2(drag.startY - drag.origY, drag.startX - drag.origX) * 180) / Math.PI;
        const rotation = (drag.origRotation ?? 0) + (angleNow - angleStart);
        setObjects((prev) =>
          prev.map((item) => (item.id === drag.id ? { ...item, rotation } : item)),
        );
        return;
      }
      if (drag.kind === 'rotate-overlay') {
        const overlay = overlaysRef.current.find((item) => item.id === drag.id);
        const cx = overlay ? overlay.x + overlay.width / 2 : drag.origX;
        const cy = overlay ? overlay.y + overlay.height / 2 : drag.origY;
        const angleNow = (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI;
        const angleStart = (Math.atan2(drag.startY - cy, drag.startX - cx) * 180) / Math.PI;
        const rotation = wrapPhotoRotation((drag.origRotation ?? 0) + (angleNow - angleStart));
        setOverlays((prev) =>
          prev.map((item) => (item.id === drag.id ? { ...item, rotation } : item)),
        );
        return;
      }
      if (drag.kind === 'orbit-overlay') {
        const px = event.clientX - (drag.startClientX ?? event.clientX);
        const py = event.clientY - (drag.startClientY ?? event.clientY);
        const yaw = wrapPhotoYaw((drag.origYaw ?? 0) + px * 0.55);
        const pitch = clampPhotoPitch((drag.origPitch ?? 0) - py * 0.42);
        setOverlays((prev) =>
          prev.map((item) => (item.id === drag.id ? { ...item, yaw, pitch } : item)),
        );
        return;
      }
      if (drag.kind === 'rotate-background') {
        const angleNow = (Math.atan2(point.y - 0.5, point.x - 0.5) * 180) / Math.PI;
        const angleStart = (Math.atan2(drag.startY - 0.5, drag.startX - 0.5) * 180) / Math.PI;
        const rotation = wrapPhotoRotation((drag.origRotation ?? 0) + (angleNow - angleStart));
        setBackground((prev) => (prev ? { ...prev, rotation } : prev));
        return;
      }
      if (drag.kind === 'orbit-object') {
        const px = event.clientX - (drag.startClientX ?? event.clientX);
        const py = event.clientY - (drag.startClientY ?? event.clientY);
        const yaw = wrapOrbitYaw((drag.origYaw ?? 0) + px * 0.5);
        const pitch = clampOrbitPitch((drag.origPitch ?? 0) - py * 0.38);
        setObjects((prev) =>
          prev.map((item) => (item.id === drag.id ? { ...item, yaw, pitch } : item)),
        );
        return;
      }
      const nx = Math.min(0.94, Math.max(0.06, drag.origX + dx));
      const ny = Math.min(0.94, Math.max(0.06, drag.origY + dy));
      if (drag.kind === 'object') {
        setObjects((prev) => prev.map((item) => (item.id === drag.id ? { ...item, x: nx, y: ny } : item)));
      } else if (drag.kind === 'overlay') {
        setOverlays((prev) =>
          prev.map((item) =>
            item.id === drag.id ? { ...item, x: nx - item.width / 2, y: ny - item.height / 2 } : item,
          ),
        );
      } else if (drag.kind === 'marker') {
        setMarkers((prev) => prev.map((item) => (item.id === drag.id ? { ...item, x: nx, y: ny } : item)));
      }
    },
    [drag, pointerToNorm],
  );

  const endDrag = useCallback(() => {
    const pending = pendingHistoryRef.current;
    pendingHistoryRef.current = null;
    if (pending) {
      const current = JSON.stringify({
        background: backgroundRef.current,
        overlays: overlaysRef.current,
        objects: objectsRef.current,
        markers: markersRef.current,
        shapes: shapesRef.current,
      });
      const before = JSON.stringify({
        background: pending.background,
        overlays: pending.overlays,
        objects: pending.objects,
        markers: pending.markers,
        shapes: pending.shapes,
      });
      if (current !== before) {
        historyRef.current = [...historyRef.current, pending].slice(-HISTORY_LIMIT);
        redoRef.current = [];
        setHistoryCount(historyRef.current.length);
        setRedoCount(0);
      }
    }
    shapeOrigRef.current = null;
    setDrag(null);
  }, []);

  const onDrawPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (locked || !isDrawCreateTool(drawToolRef.current) || !event.isPrimary) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = pointerToNorm(event);
      const kind = drawToolRef.current as AmbienteGeoKind;
      const id = newId('geo');
      drawStrokeRef.current = { id, kind, start: point, points: [point] };
      setSelectedId(null);
      setDrawPreview(
        previewFromDrag({
          id,
          kind,
          start: point,
          end: point,
          shiftKey: event.shiftKey,
          fill: drawFillRef.current,
          stroke: drawColorRef.current,
          points: [point],
        }),
      );
    },
    [locked, pointerToNorm],
  );

  const onDrawPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const stroke = drawStrokeRef.current;
      if (!stroke) return;
      const point = pointerToNorm(event);
      const points = stroke.kind === 'pencil' ? appendPencilPoint(stroke.points, point) : stroke.points;
      stroke.points = points;
      setDrawPreview(
        previewFromDrag({
          id: stroke.id,
          kind: stroke.kind,
          start: stroke.start,
          end: point,
          shiftKey: event.shiftKey,
          fill: drawFillRef.current,
          stroke: drawColorRef.current,
          points,
        }),
      );
    },
    [pointerToNorm],
  );

  const onDrawPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const stroke = drawStrokeRef.current;
      if (!stroke) return;
      const point = pointerToNorm(event);
      const points = stroke.kind === 'pencil' ? appendPencilPoint(stroke.points, point) : stroke.points;
      const preview = previewFromDrag({
        id: stroke.id,
        kind: stroke.kind,
        start: stroke.start,
        end: point,
        shiftKey: event.shiftKey,
        fill: drawFillRef.current,
        stroke: drawColorRef.current,
        points,
      });
      drawStrokeRef.current = null;
      setDrawPreview(null);
      if (!shapeIsCommitable(preview)) return;
      pushHistory();
      setShapes((prev) => [...prev, preview]);
      setSelectedId(preview.id);
    },
    [pointerToNorm, pushHistory],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const touchDistance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const touchAngle = (touches: TouchList) =>
      (Math.atan2(touches[1].clientY - touches[0].clientY, touches[1].clientX - touches[0].clientX) * 180) /
      Math.PI;

    const onWheel = (event: WheelEvent) => {
      if (locked) return;
      event.preventDefault();
      if (Date.now() < ignoreWheelUntilRef.current) return;
      const factor = event.deltaY > 0 ? 1 / AMBIENTE_ZOOM_FACTOR : AMBIENTE_ZOOM_FACTOR;
      applySelectedScale(readSelectedScale() * factor);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2 || locked) return;
      drawStrokeRef.current = null;
      setDrawPreview(null);
      pendingHistoryRef.current = cloneScene(readScene());
      const selectedObject = objectsRef.current.find((item) => item.id === selectedIdRef.current);
      pinchRef.current = {
        distance: touchDistance(event.touches),
        scale: readSelectedScale(),
        angle: touchAngle(event.touches),
        rotation: selectedObject?.rotation ?? 0,
      };
      setDrag(null);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchRef.current || locked) return;
      event.preventDefault();
      const ratio = touchDistance(event.touches) / pinchRef.current.distance;
      applySelectedScale(pinchRef.current.scale * ratio);
      const selectedId = selectedIdRef.current;
      if (selectedId && objectsRef.current.some((item) => item.id === selectedId)) {
        const delta = touchAngle(event.touches) - pinchRef.current.angle;
        const nextRotation = pinchRef.current.rotation + delta;
        setObjects((prev) =>
          prev.map((item) => (item.id === selectedId ? { ...item, rotation: nextRotation } : item)),
        );
      }
    };

    const onTouchEnd = () => {
      pinchRef.current = null;
      const pending = pendingHistoryRef.current;
      pendingHistoryRef.current = null;
      if (pending) {
        const current = JSON.stringify({
          background: backgroundRef.current,
          overlays: overlaysRef.current,
          objects: objectsRef.current,
          markers: markersRef.current,
          shapes: shapesRef.current,
        });
        const before = JSON.stringify({
          background: pending.background,
          overlays: pending.overlays,
          objects: pending.objects,
          markers: pending.markers,
          shapes: pending.shapes,
        });
        if (current !== before) {
          historyRef.current = [...historyRef.current, pending].slice(-HISTORY_LIMIT);
          redoRef.current = [];
          setHistoryCount(historyRef.current.length);
          setRedoCount(0);
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applySelectedScale, locked, readSelectedScale, isFullscreen, readScene]);

  useEffect(() => {
    ignoreWheelUntilRef.current = Date.now() + 1000;
    setAmbienteFullscreenOpenFlag(isFullscreen);
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      ignoreWheelUntilRef.current = Date.now() + 1000;
      setAmbienteFullscreenOpenFlag(false);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const removeById = useCallback((id: string) => {
    if (!id) return;
    pushHistory();
    setObjects((prev) => prev.filter((item) => item.id !== id));
    setOverlays((prev) => prev.filter((item) => item.id !== id));
    setMarkers((prev) => prev.filter((item) => item.id !== id));
    setShapes((prev) => prev.filter((item) => item.id !== id));
    if (id === 'background') {
      setBackground(null);
      setSourceFolderId(null);
    }
    setSelectedId((current) => (current === id ? null : current));
  }, [pushHistory]);

  const removeSelected = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    removeById(id);
  }, [removeById]);

  const removeSelectedPhoto = useCallback(() => {
    const id = selectedIdRef.current;
    const overlay = id ? overlaysRef.current.find((item) => item.id === id) : null;
    if (overlay) {
      removeById(overlay.id);
      return;
    }
    if (backgroundRef.current) {
      removeById('background');
      return;
    }
    const lastOverlay = overlaysRef.current[overlaysRef.current.length - 1];
    if (lastOverlay) removeById(lastOverlay.id);
  }, [removeById]);

  const clearDrawings = useCallback(() => {
    if (shapesRef.current.length === 0) return;
    pushHistory();
    const drawingIds = new Set(shapesRef.current.map((item) => item.id));
    setShapes([]);
    setDrawPreview(null);
    setSelectedId((current) => {
      if (current && drawingIds.has(current)) {
        return backgroundRef.current ? 'background' : null;
      }
      return current;
    });
  }, [pushHistory]);

  const canSaveCopy = (Boolean(background) || overlays.length > 0) && !locked;
  const saveDisabledReason =
    !background && overlays.length === 0
      ? 'Insira uma foto na cena antes de salvar'
      : locked
        ? 'Aguarde o processamento terminar'
        : undefined;

  const performSaveCopy = useCallback(async (
    folderId: string | null,
    options?: { fileName: string; includeNotes: boolean },
  ) => {
    const currentBackground = backgroundRef.current;
    const currentOverlays = overlaysRef.current;
    if (!leadId || (!currentBackground && currentOverlays.length === 0)) return;
    const stamp = whiteboardSaveStamp();
    const baseName = sanitizeVisitFileBaseName(
      options?.fileName
        || currentBackground?.label.replace(/\.[^.]+$/, '')
        || currentOverlays[0]?.label.replace(/\.[^.]+$/, '')
        || `ambiente-lead-${leadId}-${stamp}`,
    );
    setIsSavingCopy(true);
    try {
      const exported = await exportAmbienteCompositionToJpeg({
        background: currentBackground,
        overlays: currentOverlays,
        objects: objectsRef.current,
        markers: markersRef.current,
        shapes: shapesRef.current,
        viewport: exportViewport(),
        coordSpace: photoSpaceReadyRef.current ? 'photo' : 'viewport',
      });
      const composedFile = dataUrlToFile(exported.dataUrl, `${baseName}.jpg`);
      await uploadAttachment(composedFile, folderId, baseName);

      const urlsToRevoke = [
        currentBackground?.url,
        ...currentOverlays.map((item) => item.url),
      ];
      setBackground(null);
      setOverlays([]);
      setSelectedId(null);
      setSourceFolderId(null);
      urlsToRevoke.forEach((url) => {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      await clearAmbienteDraft(leadId);

      toast.success(
        folderId
          ? 'Foto guardada na pasta. Ela saiu da lousa e já aparece na galeria.'
          : 'Foto guardada nos anexos. Ela saiu da lousa e já aparece na galeria.',
      );
      setFolderPickerOpen(false);
    } catch (error) {
      toast.error('Não foi possível salvar a foto', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSavingCopy(false);
    }
  }, [exportViewport, leadId, uploadAttachment]);

  const saveCopyToFolder = useCallback(async () => {
    if (!canSaveCopy) return;
    setFolderPickerOpen(true);
  }, [canSaveCopy]);

  useEffect(() => {
    return () => {
      const urls = [
        backgroundRef.current?.url,
        ...overlaysRef.current.map((item) => item.url),
      ];
      urls.forEach((url) => {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoLast();
        return;
      }
      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z')
      ) {
        event.preventDefault();
        redoLast();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = event.key.toLowerCase();
        const toolByKey: Record<string, AmbienteDrawTool> = {
          v: 'select',
          p: 'pencil',
          l: 'line',
          r: 'rect',
          o: 'ellipse',
          t: 'triangle',
        };
        if (toolByKey[key]) {
          event.preventDefault();
          const next = toolByKey[key];
          setDrawTool(next);
          if (isDrawCreateTool(next)) {
            setSelectedId(null);
            setDrawPreview(null);
          }
          return;
        }
      }
      if (event.key === '[' ) {
        event.preventDefault();
        if (shapesRef.current.some((item) => item.id === selectedIdRef.current)) {
          rotateSelectedShape(-15);
        } else {
          rotateSelectedObject(-15);
        }
        return;
      }
      if (event.key === ']') {
        event.preventDefault();
        if (shapesRef.current.some((item) => item.id === selectedIdRef.current)) {
          rotateSelectedShape(15);
        } else {
          rotateSelectedObject(15);
        }
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        scaleSelectedObject(0.85);
        return;
      }
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        scaleSelectedObject(1.15);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIdRef.current) {
          event.preventDefault();
          removeSelected();
          return;
        }
        if (backgroundRef.current || overlaysRef.current.length > 0) {
          event.preventDefault();
          removeSelectedPhoto();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSelected, removeSelectedPhoto, redoLast, rotateSelectedObject, rotateSelectedShape, scaleSelectedObject, undoLast]);

  const hudScale = (() => {
    if (selectedId === 'background' || (!selectedId && background)) return background?.scale ?? 1;
    const overlay = overlays.find((item) => item.id === selectedId);
    if (overlay) return zoomFromOverlayWidth(overlay.width, overlay.height);
    const object = objects.find((item) => item.id === selectedId);
    if (object) return zoomFromObjectWidth(object.width);
    return background?.scale ?? 1;
  })();
  const showZoomHud = Boolean(background) || overlays.length > 0 || objects.length > 0 || shapes.length > 0;
  const selectedObject = objects.find((item) => item.id === selectedId) ?? null;
  const selectedOverlay = overlays.find((item) => item.id === selectedId) ?? null;
  const selectedShape = shapes.find((item) => item.id === selectedId) ?? null;
  const zoomPercent = Math.round(hudScale * 100);
  const photoHudTarget = selectedShape
    ? null
    : selectedOverlay
      ? selectedOverlay
      : background && (selectedId === 'background' || (!selectedId && !selectedObject))
        ? background
        : null;

  const selectedKind =
    selectedOverlay || selectedId === 'background' || (photoHudTarget && !selectedObject && !selectedShape)
      ? 'photo'
      : selectedObject || selectedShape || (selectedId && selectedId !== 'background')
        ? 'piece'
        : null;
  const hasDrawings = shapes.length > 0;
  const canRemovePhoto = Boolean(selectedOverlay || background || overlays.length > 0);

  const composerBody = (
    <section
      id={isFullscreen ? 'lead-ai-ambiente-composer-fullscreen' : 'lead-ai-ambiente-composer'}
      className={cn(
        'overflow-hidden border bg-gradient-to-b from-mahogany-card/80 to-mahogany-elevated/40 shadow-inner shadow-black/10 transition-[box-shadow,border-color] duration-500',
        isFullscreen
          ? 'flex h-full min-h-0 w-full flex-1 flex-col rounded-none border-0'
          : 'rounded-xl',
        photoPulse ? 'border-gold/70 shadow-[0_0_0_1px_rgba(242,216,146,0.35)]' : 'border-gold-border-subtle/30',
      )}
    >
      <div className="relative shrink-0 border-b border-gold-border-subtle/20 bg-mahogany-elevated/60 px-4 py-3 sm:px-5">
        <AmbienteAtmosphereFoil intensity={0.7} />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-gold">
              <Sofa className="h-4 w-4" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                Compor ambiente
              </span>
            </div>
            <Label className="text-sm font-medium text-foreground">
              Descreva o cômodo, desenhe na lousa e posicione os móveis
            </Label>
            {!isFullscreen && (
              <p className="text-xs text-cream-muted">
                A IA lê os desenhos da lousa e cada móvel posicionado, entende o cômodo descrito e
                gera a foto sem variar o móvel.
                {draftRestored ? ' Rascunho recuperado — pode continuar de onde parou.' : ' A montagem é guardada sozinha se o sistema cair.'}
              </p>
            )}
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-1.5 pointer-events-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-gold-border-subtle/40 bg-mahogany-muted/40"
              disabled={!canUndo}
              onClick={undoLast}
              aria-label="Desfazer última ação"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desfazer</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-gold-border-subtle/40 bg-mahogany-muted/40"
              disabled={!canRedo}
              onClick={redoLast}
              aria-label="Refazer última ação"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refazer</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-gold-border-subtle/40 bg-mahogany-muted/40"
              disabled={!canSaveCopy}
              onClick={() => void saveCopyToFolder()}
              aria-label="Guardar na pasta do lead e tirar da lousa"
            >
              {isSavingCopy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Salvar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-gold-border-subtle/40 bg-mahogany-muted/40"
              onClick={() => updateFullscreen(!isFullscreen)}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tela cheia</span>
                </>
              )}
            </Button>
            {isFullscreen && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-cream-muted hover:text-foreground"
                onClick={() => updateFullscreen(false)}
                aria-label="Fechar tela cheia"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'space-y-4 p-4 sm:p-5',
          isFullscreen && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        <div className={cn('space-y-2', isFullscreen && 'shrink-0')}>
          <Label htmlFor="lead-ai-ambiente-descricao" className="text-xs text-cream-secondary">
            Prompt do ambiente
          </Label>
          <Textarea
            id="lead-ai-ambiente-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            disabled={locked}
            rows={isFullscreen ? 2 : 4}
            maxLength={2000}
            placeholder="Ex.: Sala de estar contemporânea, sofá linho claro, piso carvalho, luz natural da janela à esquerda, painel TV em noce…"
            className={cn(
              'resize-y border-gold-border-subtle/30 bg-mahogany-muted/40 text-sm',
              isFullscreen ? 'min-h-[64px]' : 'min-h-[96px]',
            )}
          />
        </div>

        <div
          className={cn(
            'relative min-w-0 w-full',
            isFullscreen ? 'flex min-h-0 flex-1 gap-3' : 'flex flex-col',
          )}
        >
          <div
            data-whiteboard-viewport="true"
            className={cn(
              'relative min-w-0 w-full select-none overscroll-none',
              isFullscreen
                ? 'min-h-[min(48dvh,420px)] flex-1'
                : catalogOpen
                  ? 'h-[320px] max-h-[320px]'
                  : 'max-h-[min(52vh,420px)]',
            )}
            style={isFullscreen ? undefined : { minHeight: 320 }}
          >
          <div
            ref={viewportRef}
            role="application"
            aria-label="Área de composição do ambiente"
            className={cn(
              'absolute inset-0 bg-muted/20 rounded-xl border border-border/60 shadow-inner overflow-hidden',
            )}
            style={{ touchAction: 'none' }}
            onPointerMove={(event) => {
              onViewportPointerMove(event);
              onDrawPointerMove(event);
            }}
            onPointerUp={(event) => {
              endDrag();
              onDrawPointerUp(event);
            }}
            onPointerCancel={(event) => {
              endDrag();
              onDrawPointerUp(event);
            }}
          >
            <AmbienteAtmosphereFoil intensity={background ? 0.35 : 1} />
            <AmbienteDraftingGrid active={isDrawCreateTool(drawTool)} />

            {background ? (
              <img
                src={background.url}
                alt={background.label}
                className={cn(
                  planeFitsHost
                    ? 'absolute max-w-none origin-center'
                    : 'absolute inset-0 h-full w-full origin-center object-contain',
                  selectedId === 'background' && 'ring-1 ring-inset ring-gold/40',
                )}
                draggable={false}
                style={{
                  ...(planeFitsHost
                    ? {
                        left: `${scenePlane.left * 100}%`,
                        top: `${scenePlane.top * 100}%`,
                        width: `${scenePlane.width * 100}%`,
                        height: `${scenePlane.height * 100}%`,
                      }
                    : undefined),
                  transform: [
                    `translate(${(background.offsetX - 0.5) * 40}%, ${(background.offsetY - 0.5) * 40}%)`,
                    `rotate(${background.rotation ?? 0}deg)`,
                    `scaleX(${background.flipH ? -1 : 1})`,
                    `scaleY(${background.flipV ? -1 : 1})`,
                    `scale(${background.scale})`,
                  ].join(' '),
                  cursor: locked ? 'default' : 'grab',
                }}
                onPointerDown={(event) =>
                  beginDrag(
                    'pan-background',
                    'background',
                    background.offsetX,
                    background.offsetY,
                    event,
                  )
                }
              />
            ) : objects.length > 0 || overlays.length > 0 || shapes.length > 0 ? null : (
              <div className="pointer-events-none absolute inset-0 z-[56] flex flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
                <div className="rounded-2xl bg-primary/10 p-4">
                  <ImageIcon className="h-10 w-10 text-primary/70" />
                </div>
                <p className="max-w-xs text-center text-sm font-medium">
                  Abra as ferramentas no canto direito para inserir a foto do cômodo, ou desenhe direto na lousa.
                </p>
              </div>
            )}

            <div
              ref={photoSpaceReady && background && planeFitsHost ? photoPlaneRef : undefined}
              data-ambiente-photo-plane={photoSpaceReady && background ? (planeFitsHost ? 'js' : 'css') : undefined}
              className={cn(
                photoSpaceReady && background && planeFitsHost
                  ? 'pointer-events-none absolute z-20 overflow-visible'
                  : photoSpaceReady && background
                    ? 'pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-visible'
                    : 'contents',
              )}
              style={
                photoSpaceReady && background && planeFitsHost
                  ? {
                      left: `${scenePlane.left * 100}%`,
                      top: `${scenePlane.top * 100}%`,
                      width: `${scenePlane.width * 100}%`,
                      height: `${scenePlane.height * 100}%`,
                    }
                  : undefined
              }
            >
            <div
              ref={photoSpaceReady && background && !planeFitsHost ? photoPlaneRef : undefined}
              className={
                photoSpaceReady && background && !planeFitsHost
                  ? 'relative max-h-full max-w-full overflow-visible'
                  : 'contents'
              }
              style={
                photoSpaceReady && background && !planeFitsHost
                  ? {
                      aspectRatio: `${Math.max(1, background.naturalWidth || 1)} / ${Math.max(1, background.naturalHeight || 1)}`,
                      height: '100%',
                      width: 'auto',
                    }
                  : undefined
              }
            >
            <AmbienteDrawLayer
              shapes={shapes}
              preview={drawPreview}
              selectedId={selectedId}
              tool={drawTool}
              disabled={locked}
              onSelect={setSelectedId}
              onMovePointerDown={(id, x, y, event) => beginDrag('shape', id, x, y, event)}
              onResizePointerDown={(id, x, y, size, event) =>
                beginDrag('resize-shape', id, x, y, event, size)
              }
              onRotatePointerDown={(id, cx, cy, rotation, event) =>
                beginDrag('rotate-shape', id, cx, cy, event, { rotation })
              }
              onRemove={removeById}
            />

            {isDrawCreateTool(drawTool) && !locked && (
              <div
                data-ambiente-draw-surface="true"
                className="absolute inset-0 z-[45] cursor-crosshair touch-none"
                onPointerDown={onDrawPointerDown}
                onPointerMove={onDrawPointerMove}
                onPointerUp={onDrawPointerUp}
                onPointerCancel={onDrawPointerUp}
              />
            )}

            {overlays.map((overlay) => (
              <div
                key={overlay.id}
                className={cn(
                  'absolute z-20 cursor-grab overflow-visible rounded-md border bg-transparent shadow-md pointer-events-auto active:cursor-grabbing',
                  selectedId === overlay.id ? 'border-gold ring-2 ring-gold/40' : 'border-gold/30',
                )}
                style={{
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                  width: `${overlay.width * 100}%`,
                  height: `${overlay.height * 100}%`,
                  perspective: '36rem',
                  transformStyle: 'preserve-3d',
                  transform: `rotate(${overlay.rotation}deg)`,
                }}
                onPointerDown={(event) =>
                  beginDrag(
                    'overlay',
                    overlay.id,
                    overlay.x + overlay.width / 2,
                    overlay.y + overlay.height / 2,
                    event,
                  )
                }
              >
                <img
                  src={overlay.url}
                  alt={overlay.label}
                  className="h-full w-full rounded-md object-contain"
                  draggable={false}
                  style={{
                    transform: [
                      `rotateX(${overlay.pitch ?? 0}deg)`,
                      `rotateY(${overlay.yaw ?? 0}deg)`,
                      `scaleX(${overlay.flipH ? -1 : 1})`,
                      `scaleY(${overlay.flipV ? -1 : 1})`,
                    ].join(' '),
                    transformStyle: 'preserve-3d',
                  }}
                />
                {selectedId === overlay.id && (
                  <>
                    <SceneDeleteBadge
                      label={overlay.label || 'foto'}
                      disabled={locked}
                      onRemove={() => removeById(overlay.id)}
                    />
                    <button
                      type="button"
                      aria-label="Virar foto em todos os eixos"
                      title="Arraste para virar de lado e inclinar"
                      className="absolute -left-1.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-grab rounded-full border border-gold bg-[#f2d892] shadow active:cursor-grabbing"
                      onPointerDown={(event) =>
                        beginDrag('orbit-overlay', overlay.id, overlay.x, overlay.y, event, {
                          yaw: overlay.yaw ?? 0,
                          pitch: overlay.pitch ?? 0,
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Girar foto"
                      className="absolute -top-1.5 left-1/2 z-10 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border border-gold bg-[#fff6ea] shadow active:cursor-grabbing"
                      onPointerDown={(event) =>
                        beginDrag('rotate-overlay', overlay.id, overlay.x, overlay.y, event, {
                          rotation: overlay.rotation,
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Redimensionar foto"
                      className="absolute -bottom-1.5 -right-1.5 z-10 h-4 w-4 cursor-nwse-resize rounded-full border border-gold bg-[#fff6ea] shadow"
                      onPointerDown={(event) =>
                        beginDrag('resize-overlay', overlay.id, overlay.x, overlay.y, event, {
                          width: overlay.width,
                          height: overlay.height,
                        })
                      }
                    />
                  </>
                )}
              </div>
            ))}

            {objects.map((object) => {
              const isRealistic = object.viewMode === 'realista';
              const payload = {
                kind: 'furniture_module' as const,
                moduleType: object.moduleType,
                a: { x: 50, y: 8 },
                b: { x: 50, y: 92 },
                widthOverride: 72,
                topDown: true,
                flatFront: furnitureViewIsFlat(object.viewMode),
                colorHex: object.colorHex,
                locked: true,
              };
              return (
                <div
                  key={object.id}
                  className={cn(
                    'absolute z-30 cursor-grab overflow-visible pointer-events-auto active:cursor-grabbing',
                    selectedId === object.id && 'drop-shadow-[0_0_12px_rgba(242,216,146,0.55)]',
                  )}
                  style={{
                    left: `${object.x * 100}%`,
                    top: `${object.y * 100}%`,
                    width: `${object.width * 100}%`,
                    height: `${object.height * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${object.rotation ?? 0}deg)`,
                    perspective: isRealistic ? undefined : '32rem',
                  }}
                  onPointerDown={(event) => beginDrag('object', object.id, object.x, object.y, event)}
                >
                  {isRealistic ? (
                    <RealisticFurnitureObject
                      moduleType={object.moduleType}
                      selected={selectedId === object.id}
                      yaw={object.yaw ?? 0}
                      pitch={object.pitch ?? 0}
                      colorHex={object.colorHex}
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        transform: `rotateX(${object.pitch ?? 0}deg) rotateY(${object.yaw ?? 0}deg)`,
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                        <FurnitureModuleGfx
                          payload={payload}
                          strokeColor="#f2d892"
                          strokeWidth={1.6}
                          selected={selectedId === object.id}
                          showLabel={false}
                        />
                      </svg>
                    </div>
                  )}
                  {selectedId === object.id && (
                    <>
                      <button
                        type="button"
                        aria-label="Redimensionar objeto"
                        className="absolute -bottom-1.5 -right-1.5 z-10 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-background bg-sky-600 shadow ring-2 ring-sky-400/35"
                        onPointerDown={(event) =>
                          beginDrag('resize-object', object.id, object.x, object.y, event, {
                            width: object.width,
                            height: object.height,
                          })
                        }
                      />
                      <SceneDeleteBadge
                        label={object.label}
                        disabled={locked}
                        onRemove={() => removeById(object.id)}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {selectedObject && (
              <AmbienteObjectEditHud
                object={selectedObject}
                disabled={locked}
                onScale={scaleSelectedObject}
                onNudgeWidth={nudgeSelectedObjectWidth}
                onRotate={rotateSelectedObject}
                onRotatePointerDown={(event) =>
                  beginDrag('rotate-object', selectedObject.id, selectedObject.x, selectedObject.y, event, {
                    rotation: selectedObject.rotation ?? 0,
                  })
                }
                onOrbitYaw={orbitSelectedYaw}
                onOrbitPitch={orbitSelectedPitch}
                onOrbitPreset={setSelectedOrbit}
                onOrbitPointerDown={(event) =>
                  beginDrag('orbit-object', selectedObject.id, selectedObject.x, selectedObject.y, event, {
                    yaw: selectedObject.yaw ?? 0,
                    pitch: selectedObject.pitch ?? 0,
                  })
                }
                onChangeType={changeSelectedObjectType}
                onChangeViewMode={changeSelectedViewMode}
                onChangeColor={changeSelectedObjectColor}
                onRemove={() => removeById(selectedObject.id)}
              />
            )}

            {markers.map((marker) => (
              <div
                key={marker.id}
                className={cn(
                  'absolute z-40 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border px-2.5 py-1 text-[11px] font-semibold text-[#f2d892] pointer-events-auto active:cursor-grabbing',
                  selectedId === marker.id
                    ? 'border-gold bg-[#2a1812] ring-2 ring-gold/40'
                    : 'border-[rgba(240,210,140,0.45)] bg-[#2a1812]/90',
                )}
                style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                onPointerDown={(event) => beginDrag('marker', marker.id, marker.x, marker.y, event)}
              >
                {marker.nome}
                {selectedId === marker.id && (
                  <SceneDeleteBadge
                    label={marker.nome}
                    disabled={locked}
                    onRemove={() => removeById(marker.id)}
                  />
                )}
              </div>
            ))}

            </div>
            </div>

            <TooltipProvider delayDuration={180}>
              <AmbienteSceneDock
                locked={locked}
                catalogOpen={catalogOpen}
                canUndo={canUndo}
                canRedo={canRedo}
                canSave={canSaveCopy}
                isSaving={isSavingCopy}
                hasBackground={Boolean(background) || overlays.length > 0}
                hasSelection={Boolean(selectedKind)}
                selectedKind={selectedKind}
                hasDrawings={hasDrawings}
                onInsertPhoto={() => fileInputRef.current?.click()}
                onCapture={() => cameraCaptureRef.current?.requestCapture()}
                onProject={() => {
                  setProjectImagePickerOpenFlag(true);
                  setProjectPickerOpen(true);
                }}
                onToggleCatalog={toggleCatalog}
                onUndo={undoLast}
                onRedo={redoLast}
                onSave={() => void saveCopyToFolder()}
                onRemoveSelected={selectedKind === 'piece' ? removeSelected : undefined}
                onClearDrawings={hasDrawings ? clearDrawings : undefined}
                onClearPhoto={canRemovePhoto ? removeSelectedPhoto : undefined}
              />
            </TooltipProvider>

            {showZoomHud && (
              <AmbienteZoomHud
                scale={hudScale}
                disabled={locked}
                onScaleChange={applySelectedScale}
                onZoomIn={() => nudgeSelectedScale(1)}
                onZoomOut={() => nudgeSelectedScale(-1)}
              />
            )}
            {selectedShape && (
              <AmbienteShapeEditHud
                rotation={selectedShape.rotation ?? 0}
                disabled={locked}
                onRotate={rotateSelectedShape}
                onRotationChange={setSelectedShapeRotation}
                onSnapRotation={snapSelectedShapeRotation}
                onRotatePointerDown={(event) => {
                  const center = shapeCenter(selectedShape);
                  beginDrag('rotate-shape', selectedShape.id, center.x, center.y, event, {
                    rotation: selectedShape.rotation ?? 0,
                  });
                }}
              />
            )}
            {photoHudTarget && (
              <AmbienteImageEditHud
                rotation={photoHudTarget.rotation ?? 0}
                yaw={selectedOverlay?.yaw ?? 0}
                pitch={selectedOverlay?.pitch ?? 0}
                flipH={Boolean(photoHudTarget.flipH)}
                flipV={Boolean(photoHudTarget.flipV)}
                anchor={
                  selectedOverlay
                    ? photoSpaceReady
                      ? planeToViewportBox(selectedOverlay, scenePlane)
                      : {
                          x: selectedOverlay.x,
                          y: selectedOverlay.y,
                          width: selectedOverlay.width,
                          height: selectedOverlay.height,
                        }
                    : undefined
                }
                showOrbit={Boolean(selectedOverlay)}
                disabled={locked}
                onRotate={rotateSelectedPhoto}
                onRotationChange={setSelectedPhotoRotation}
                onRotatePointerDown={(event) => {
                  if (selectedOverlay) {
                    beginDrag('rotate-overlay', selectedOverlay.id, selectedOverlay.x, selectedOverlay.y, event, {
                      rotation: selectedOverlay.rotation,
                    });
                    return;
                  }
                  beginDrag('rotate-background', 'background', 0.5, 0.5, event, {
                    rotation: background?.rotation ?? 0,
                  });
                }}
                onYaw={orbitSelectedPhotoYaw}
                onPitch={orbitSelectedPhotoPitch}
                onYawChange={setSelectedPhotoYaw}
                onPitchChange={setSelectedPhotoPitch}
                onOrbitPreset={setSelectedPhotoOrbit}
                onOrbitPointerDown={(event) => {
                  if (!selectedOverlay) return;
                  beginDrag('orbit-overlay', selectedOverlay.id, selectedOverlay.x, selectedOverlay.y, event, {
                    yaw: selectedOverlay.yaw ?? 0,
                    pitch: selectedOverlay.pitch ?? 0,
                  });
                }}
                onFlipH={() => flipSelectedPhoto('h')}
                onFlipV={() => flipSelectedPhoto('v')}
                onCrop={() => openPhotoStudio(true)}
                onRetouch={() => openPhotoStudio(false)}
                onRemove={removeSelectedPhoto}
              />
            )}
          </div>
          </div>
          {catalogOpen && (
            <aside
              data-furniture-catalog-dock=""
              className={cn(
                'pointer-events-auto min-h-0',
                isFullscreen
                  ? 'flex w-[min(100%,22.5rem)] shrink-0 flex-col'
                  : 'mt-3 h-[min(26rem,50vh)] w-full',
              )}
            >
              <WhiteboardFurnitureCatalog
                selectedType={selectedFurnitureType}
                onSelect={handlePlaceFurniture}
                disabled={locked}
                variant="dock"
                hint="Escolha o banco (Retos, 3D ou Realistas) e clique no modelo para posicionar. Na foto, use +/− para o tamanho."
                onClose={() => setCatalogOpen(false)}
              />
            </aside>
          )}
        </div>

        <TooltipProvider delayDuration={200}>
          <div
            data-ambiente-toolbar="true"
            className={cn(
              'relative z-20 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/80 bg-[hsl(var(--card))] p-2 shadow-sm',
              isFullscreen && 'shrink-0',
            )}
          >
            {!background ? (
              <span className="px-1 text-xs text-muted-foreground">
                Insira uma foto ou desenhe o cômodo na lousa
              </span>
            ) : (
              <span className="hidden px-1 text-[11px] text-muted-foreground sm:inline">
                {isDrawCreateTool(drawTool)
                  ? 'Clique e arraste para desenhar · Shift trava proporção'
                  : 'Selecione para mover · pinça no objeto · +/− para tamanho'}
              </span>
            )}
            <AmbienteDrawToolbar
              tool={drawTool}
              fill={drawFill}
              stroke={drawStroke}
              disabled={locked}
              onToolChange={(next) => {
                setDrawTool(next);
                if (isDrawCreateTool(next)) {
                  setSelectedId(null);
                  setDrawPreview(null);
                }
              }}
              onFillChange={setDrawFill}
              onStrokeChange={handleDrawStrokeChange}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!canUndo} onClick={undoLast}>
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desfazer — Ctrl+Z</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!canRedo} onClick={redoLast}>
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refazer — Ctrl+Y</TooltipContent>
            </Tooltip>
            <div className="mx-0.5 hidden h-7 w-px bg-border sm:block" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={locked || !showZoomHud} onClick={() => nudgeSelectedScale(-1)}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Diminuir</TooltipContent>
            </Tooltip>
            <span className="min-w-[3rem] px-1 text-center font-mono text-xs tabular-nums text-muted-foreground">
              {zoomPercent}%
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={locked || !showZoomHud} onClick={() => nudgeSelectedScale(1)}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aumentar</TooltipContent>
            </Tooltip>
            <div className="mx-0.5 hidden h-7 w-px bg-border sm:block" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={!canSaveCopy}
                  aria-label="Guardar na pasta do lead e tirar da lousa"
                  onClick={() => void saveCopyToFolder()}
                >
                  {isSavingCopy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{saveDisabledReason ?? 'Guardar na pasta e tirar da lousa'}</TooltipContent>
            </Tooltip>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-cream-muted"
              disabled={locked || !hasDrawings}
              onClick={clearDrawings}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar desenhos
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-[#f3c4b8] hover:bg-red-950/40 hover:text-[#f3c4b8]"
              disabled={locked || !canRemovePhoto}
              onClick={removeSelectedPhoto}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir foto
            </Button>
          </div>
        </TooltipProvider>

        {suggestions.length > 0 && (
          <div className={cn('space-y-2', isFullscreen && 'shrink-0')}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
              Sugestões da IA
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  disabled={locked}
                  title={suggestion.justificativa || suggestion.posicaoSugerida}
                  onClick={() => handleApplySuggestion(suggestion)}
                  className="rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
                >
                  {suggestion.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn('relative z-20 space-y-2', isFullscreen && 'shrink-0')}>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              aria-disabled={locked || !canAnalyze}
              disabled={false}
              onClick={() => {
                const blocked = ambienteBlockedMessage({
                  kind: 'analyze',
                  configOff: disabled,
                  locked,
                  canGo: canAnalyze,
                });
                if (blocked) {
                  setActionNotice(blocked);
                  toast.error(blocked);
                  return;
                }
                setActionNotice(null);
                void handleAnalyze();
              }}
              className={cn(
                'cursor-pointer border-gold-border-subtle/40 bg-mahogany-muted/40',
                (locked || !canAnalyze) && 'opacity-80',
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desmembrando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Sugerir composição
                </>
              )}
            </Button>
            <Button
              type="button"
              aria-disabled={locked || isBusy || !canRender}
              disabled={false}
              title={
                disabled
                  ? 'Ative a renderização com ambiente nas configurações de IA'
                  : isBusy || isFlattening
                    ? 'Já existe uma renderização em andamento'
                    : locked
                      ? 'Aguarde a ação atual terminar'
                      : !canRender
                        ? 'Descreva o cômodo, coloque uma foto ou um móvel na lousa'
                        : 'Gerar a foto do ambiente'
              }
              onClick={() => {
                const blocked = ambienteBlockedMessage({
                  kind: 'render',
                  configOff: disabled,
                  locked,
                  busy: isBusy || isFlattening,
                  canGo: canRender,
                });
                if (blocked) {
                  setActionNotice(blocked);
                  toast.error(blocked);
                  return;
                }
                setActionNotice(null);
                void handleRenderAmbiente();
              }}
              className={cn(
                'relative z-20 cursor-pointer overflow-hidden',
                (locked || isBusy || !canRender) && 'opacity-80',
              )}
            >
              <AmbienteAtmosphereFoil intensity={1.35} />
              <span className="relative z-10 inline-flex items-center">
                {isBusy || isFlattening ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Renderizando ambiente…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Renderizar ambiente
                  </>
                )}
              </span>
            </Button>
          </div>
          {actionNotice ? (
            <p role="status" className="max-w-xl text-xs leading-relaxed text-gold">
              {actionNotice}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );

  const overlayDialogs = (
    <>
      <WhiteboardProjectImagePicker
        leadId={leadId}
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        elevated
        isSelecting={isImportingProject}
        existingImageUrls={overlays.map((item) => item.url)}
        onSelect={async (midia) => {
          const url = midia.file_url?.trim();
          if (!url) {
            toast.error('Esta foto não tem um arquivo válido');
            return;
          }
          setIsImportingProject(true);
          try {
            const label = midia.preview_label || midia.file_name || 'Foto do projeto';
            const preview = await urlToImagePreview(url, label).catch(() =>
              previewFromImageUrl(url, label),
            );
            setProjectPickerOpen(false);
            await setPhotoAsBackgroundOrOverlay(preview);
            if (midia.folder_id) setSourceFolderId(midia.folder_id);
            toast.success('Foto na lousa', {
              description: 'Agora você pode medir, anotar e posicionar móveis em cima dela.',
            });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Não foi possível importar a foto');
          } finally {
            setIsImportingProject(false);
          }
        }}
      />
      <LeadFolderPickDialog
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        leadId={leadId}
        title="Guardar a foto em qual pasta?"
        description="A foto com zoom, recorte e posição sai da lousa e entra na galeria da pasta escolhida."
        confirmLabel="Guardar nesta pasta"
        previewUrl={background?.url ?? overlays[0]?.url}
        elevated={isFullscreen}
        coverItems={pdfs}
        askFileName
        defaultFolderId={sourceFolderId}
        defaultFileName={
          background?.label
            ? sanitizeVisitFileBaseName(background.label.replace(/\.[^.]+$/, ''))
            : overlays[0]?.label
              ? sanitizeVisitFileBaseName(overlays[0].label.replace(/\.[^.]+$/, ''))
              : 'ambiente'
        }
        onConfirm={(folderId, options) => performSaveCopy(folderId, options)}
      />
      <AmbientePhotoStudioDialog
        open={photoStudioOpen}
        sourceUrl={selectedOverlay?.url ?? background?.url ?? null}
        photoLabel={selectedOverlay?.label ?? background?.label}
        startInCrop={photoStudioCrop}
        onOpenChange={setPhotoStudioOpen}
        onApply={(bakedUrl) => applyStudioBakedUrl(bakedUrl)}
      />
      <WhiteboardCameraCapture
        ref={cameraCaptureRef}
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        disabled={locked}
        onCapture={(file) => void handleFileList([file])}
      />
    </>
  );

  return (
    <>
      {isFullscreen ? (
        <section
          id="lead-ai-ambiente-composer"
          className="rounded-xl border border-gold-border-subtle/30 bg-gradient-to-b from-mahogany-card/80 to-mahogany-elevated/40 px-4 py-8 text-center"
        >
          <p className="text-sm font-medium text-foreground">Edição em tela cheia</p>
          <p className="mt-1 text-xs text-cream-muted">
            A composição continua aberta na tela inteira. Esc ou o botão Sair voltam para cá.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5 border-gold-border-subtle/40"
            onClick={() => updateFullscreen(false)}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Voltar ao card
          </Button>
        </section>
      ) : (
        composerBody
      )}

      <Dialog
        open={isFullscreen}
        onOpenChange={(open) => {
          if (!open && (projectPickerOpen || folderPickerOpen || cameraOpen || photoStudioOpen)) return;
          if (
            !open &&
            typeof document !== 'undefined' &&
            document.documentElement.hasAttribute(PROJECT_IMAGE_PICKER_OPEN_ATTR)
          ) {
            return;
          }
          updateFullscreen(open);
        }}
      >
        <DialogContent
          nested
          overlayClassName={leadFullscreenOverlayClass}
          data-ambiente-composer-fullscreen=""
          className={cn(
            leadFullscreenContentClass,
            '!fixed inset-0 left-0 top-0 !translate-x-0 !translate-y-0 max-w-none w-[100dvw] h-[100dvh] max-h-[100dvh] p-0 gap-0 !flex !flex-col rounded-none border-0 bg-mahogany-panel',
            '[&>button]:hidden data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 touch-manipulation',
          )}
          onOpenAutoFocus={(event) => {
            if (catalogOpen || projectPickerOpen || photoStudioOpen || cameraOpen || folderPickerOpen) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={preventFullscreenOutsideDismiss}
          onInteractOutside={preventFullscreenOutsideDismiss}
          onFocusOutside={preventFullscreenOutsideDismiss}
        >
          <DialogTitle className="sr-only">Compor ambiente em tela cheia</DialogTitle>
          <DialogDescription className="sr-only">
            Monte o cômodo na lousa, posicione móveis do catálogo e gire cada peça em todas as direções.
          </DialogDescription>
          {isFullscreen ? composerBody : null}
        </DialogContent>
      </Dialog>

      {overlayDialogs}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFileList(event.target.files);
          event.currentTarget.value = '';
        }}
      />
    </>
  );
}
