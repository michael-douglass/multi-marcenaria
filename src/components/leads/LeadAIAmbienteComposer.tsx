import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Camera,
  FolderOpen,
  ImageIcon,
  ImagePlus,
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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AMBIENTE_FULLSCREEN_ATTR } from '@/lib/dialog-outside-guard';
import { isLikelyImageFile } from '@/lib/whiteboard-image-upload';
import { FurnitureModuleGfx } from '@/components/leads/whiteboard/FurnitureModuleGfx';
import { WhiteboardCameraCapture, type WhiteboardCameraCaptureHandle } from '@/components/leads/whiteboard/WhiteboardCameraCapture';
import { WhiteboardFurnitureCatalog } from '@/components/leads/whiteboard/WhiteboardFurnitureCatalog';
import { WhiteboardProjectImagePicker } from '@/components/leads/whiteboard/WhiteboardProjectImagePicker';
import { AmbienteAtmosphereFoil } from '@/components/leads/ambiente/AmbienteAtmosphereFoil';
import { AmbienteDraftingGrid } from '@/components/leads/ambiente/AmbienteDraftingGrid';
import { AmbienteDrawLayer } from '@/components/leads/ambiente/AmbienteDrawLayer';
import { AmbienteDrawToolbar } from '@/components/leads/ambiente/AmbienteDrawToolbar';
import { AmbienteObjectEditHud } from '@/components/leads/ambiente/AmbienteObjectEditHud';
import { AmbienteZoomHud } from '@/components/leads/ambiente/AmbienteZoomHud';
import { LeadFolderPickDialog } from '@/components/leads/LeadFolderPickDialog';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { dataUrlToFile } from '@/lib/contrato-anexo-upload';
import { sanitizeVisitFileBaseName } from '@/lib/lead-photo-checklist-catalog';
import { whiteboardSaveStamp } from '@/lib/lead-whiteboard-save';
import {
  AMBIENTE_INK,
  appendPencilPoint,
  cloneGeoShapes,
  isDrawCreateTool,
  previewFromDrag,
  resizeBoxShape,
  shapeIsCommitable,
  translateShape,
} from '@/lib/lead-ai-ambiente-draw';
import {
  exportAmbienteCompositionToJpeg,
  fileToImagePreview,
  urlToImagePreview,
} from '@/lib/lead-ai-ambiente-export';
import { buildAmbienteCenaInventario } from '@/lib/lead-ai-ambiente-inventario';
import { parseAmbienteSugestoes } from '@/lib/lead-ai-ambiente-sugestoes';
import {
  AMBIENTE_OBJECT_BASE_H,
  AMBIENTE_OBJECT_BASE_W,
  AMBIENTE_ZOOM_STEP,
  clampAmbienteObjectHeight,
  clampAmbienteObjectWidth,
  clampAmbienteZoom,
  overlaySizeFromZoom,
  zoomFromObjectWidth,
  zoomFromOverlayWidth,
} from '@/lib/lead-ai-ambiente-zoom';
import { getFurnitureModuleMeta } from '@/lib/furniture-modules';
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
  | 'pan-background'
  | 'shape'
  | 'resize-shape';

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

async function fileFromImageUrl(url: string, fileName: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível copiar a foto original');
  const blob = await response.blob();
  const type = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return new File([blob], fileName, { type, lastModified: Date.now() });
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

export function LeadAIAmbienteComposer({
  leadId,
  disabled = false,
  isBusy = false,
  incomingPhoto = null,
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
  const renderStartedRef = useRef(false);

  const { uploadAttachment, pdfs } = useLeadPDFs(leadId);

  const locked = disabled || isAnalyzing || isFlattening || isSavingCopy;
  const hasComposition =
    Boolean(background) || objects.length > 0 || overlays.length > 0 || markers.length > 0 || shapes.length > 0;
  const canAnalyze = descricao.trim().length > 0 || hasComposition;
  const canRender = canAnalyze || hasComposition;
  const canUndo = historyCount > 0 && !locked;
  const canRedo = redoCount > 0 && !locked;

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
  const historyRef = useRef<SceneHistoryEntry[]>([]);
  const redoRef = useRef<SceneHistoryEntry[]>([]);
  const pendingHistoryRef = useRef<SceneHistoryEntry | null>(null);

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
    if (current.url === preview.url || existingOverlay) {
      setSelectedId(current.url === preview.url ? 'background' : existingOverlay?.id ?? 'background');
      pulseComposer();
      return;
    }
    pushHistory();
    const id = newId('ov');
    const size = overlaySizeFromZoom(1);
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

  useEffect(() => {
    if (!incomingPhoto) return;
    const photo = incomingPhoto;
    let cancelled = false;
    void (async () => {
      try {
        const preview = await urlToImagePreview(photo.url, photo.label);
        if (cancelled) return;
        await setPhotoAsBackgroundOrOverlay(preview);
        toast.success('Foto enviada para Compor ambiente', {
          description: 'Use o zoom para aproximar ou afastar a imagem na cena.',
        });
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Não foi possível enviar a foto ao ambiente');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incomingPhoto, setPhotoAsBackgroundOrOverlay]);

  const readSelectedScale = useCallback((): number => {
    const id = selectedIdRef.current;
    if (id === 'background' || (!id && backgroundRef.current)) {
      return backgroundRef.current?.scale ?? 1;
    }
    const overlay = overlaysRef.current.find((item) => item.id === id);
    if (overlay) return zoomFromOverlayWidth(overlay.width);
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
      const size = overlaySizeFromZoom(zoom);
      setOverlays((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;
          return {
            ...item,
            width: size.width,
            height: size.height,
            x: cx - size.width / 2,
            y: cy - size.height / 2,
          };
        }),
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
      applySelectedScale(readSelectedScale() + direction * AMBIENTE_ZOOM_STEP);
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

  const handlePlaceFurniture = useCallback((moduleType: FurnitureModuleType) => {
    const meta = getFurnitureModuleMeta(moduleType);
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
        width: AMBIENTE_OBJECT_BASE_W,
        height: AMBIENTE_OBJECT_BASE_H,
        rotation: 0,
        colorHex: '#f2d892',
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
    hasComposition,
    markers,
    objects,
    onAnalyze,
    overlays,
    shapes,
  ]);

  const handleRenderAmbiente = useCallback(async () => {
    if (!canRender) {
      toast.error('Descreva o ambiente, insira uma foto ou posicione um objeto');
      return;
    }
    if (locked || isBusy || renderStartedRef.current) return;
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
        });
        compositionDataUrl = exported.dataUrl;
      } else if (background) {
        const exported = await exportAmbienteCompositionToJpeg({
          background,
          overlays: [],
          objects: [],
          markers: [],
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
      setIsFullscreen(false);
      await onRender({
        descricao: descricao.trim(),
        analiseTexto: analiseTexto ?? undefined,
        cenaInventario,
        compositionDataUrl,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível renderizar o ambiente');
    } finally {
      renderStartedRef.current = false;
      setIsFlattening(false);
    }
  }, [
    analiseTexto,
    background,
    canRender,
    descricao,
    hasComposition,
    isBusy,
    locked,
    markers,
    objects,
    onRender,
    overlays,
    shapes,
  ]);

  const pointerToNorm = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  const beginDrag = useCallback(
    (
      kind: DragKind,
      id: string,
      x: number,
      y: number,
      event: ReactPointerEvent,
      size?: { width?: number; height?: number; rotation?: number },
    ) => {
      if (locked) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      pendingHistoryRef.current = cloneScene(readScene());
      if (kind === 'shape' || kind === 'resize-shape') {
        shapeOrigRef.current = shapesRef.current.find((item) => item.id === id) ?? null;
      }
      const point = pointerToNorm(event);
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
      });
    },
    [locked, pointerToNorm, readScene],
  );

  const onViewportPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      const point = pointerToNorm(event);
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
        const factor = Math.max(0.2, 1 + dx * 2.4);
        const size = overlaySizeFromZoom(zoomFromOverlayWidth(drag.origWidth * factor));
        setOverlays((prev) =>
          prev.map((item) => {
            if (item.id !== drag.id) return item;
            const cx = drag.origX + drag.origWidth! / 2;
            const cy = drag.origY + drag.origHeight! / 2;
            return {
              ...item,
              width: size.width,
              height: size.height,
              x: cx - size.width / 2,
              y: cy - size.height / 2,
            };
          }),
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
      const direction: 1 | -1 = event.deltaY > 0 ? -1 : 1;
      applySelectedScale(readSelectedScale() + direction * AMBIENTE_ZOOM_STEP);
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
    if (!isFullscreen) return;
    document.documentElement.setAttribute(AMBIENTE_FULLSCREEN_ATTR, 'true');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.removeAttribute(AMBIENTE_FULLSCREEN_ATTR);
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
    }
    setSelectedId((current) => (current === id ? null : current));
  }, [pushHistory]);

  const removeSelected = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    removeById(id);
  }, [removeById]);

  const clearPhoto = useCallback(() => {
    if (!backgroundRef.current && overlaysRef.current.length === 0) return;
    pushHistory();
    setBackground(null);
    setOverlays([]);
    setSelectedId(null);
    setSourceFolderId(null);
  }, [pushHistory]);

  const canSaveCopy = Boolean(background) && !locked;
  const saveDisabledReason = !background
    ? 'Insira uma foto na cena antes de salvar'
    : locked
      ? 'Aguarde o processamento terminar'
      : undefined;

  const performSaveCopy = useCallback(async (
    folderId: string | null,
    options?: { fileName: string; includeNotes: boolean },
  ) => {
    const currentBackground = backgroundRef.current;
    if (!leadId || !currentBackground) return;
    const stamp = whiteboardSaveStamp();
    const baseName = sanitizeVisitFileBaseName(
      options?.fileName || currentBackground.label.replace(/\.[^.]+$/, '') || `ambiente-lead-${leadId}-${stamp}`,
    );
    setIsSavingCopy(true);
    try {
      const originalName = `${baseName}.jpg`;
      const originalFile = currentBackground.url.startsWith('data:')
        ? dataUrlToFile(currentBackground.url, originalName)
        : await fileFromImageUrl(currentBackground.url, originalName);
      await uploadAttachment(originalFile, folderId, `${baseName} (cópia)`);

      const hasEdits =
        overlaysRef.current.length > 0 ||
        objectsRef.current.length > 0 ||
        markersRef.current.length > 0 ||
        shapesRef.current.length > 0 ||
        (currentBackground.scale ?? 1) !== 1;
      if (hasEdits) {
        const exported = await exportAmbienteCompositionToJpeg({
          background: currentBackground,
          overlays: overlaysRef.current,
          objects: objectsRef.current,
          markers: markersRef.current,
          shapes: shapesRef.current,
        });
        const composedFile = dataUrlToFile(exported.dataUrl, `${baseName}-ambiente.jpg`);
        await uploadAttachment(composedFile, folderId, `${baseName} (ambiente)`);
      }

      toast.success(
        folderId
          ? 'Cópia da foto e composição salvas na pasta. A original do lead não foi alterada.'
          : 'Cópia da foto e composição salvas nos anexos. A original do lead não foi alterada.',
      );
      setFolderPickerOpen(false);
    } catch (error) {
      toast.error('Não foi possível salvar a cópia', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSavingCopy(false);
    }
  }, [leadId, uploadAttachment]);

  const saveCopyToFolder = useCallback(async () => {
    if (!canSaveCopy) return;
    if (sourceFolderId) {
      await performSaveCopy(sourceFolderId, {
        fileName: sanitizeVisitFileBaseName(background?.label.replace(/\.[^.]+$/, '') || 'ambiente'),
        includeNotes: false,
      });
      return;
    }
    setFolderPickerOpen(true);
  }, [background?.label, canSaveCopy, performSaveCopy, sourceFolderId]);

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
        rotateSelectedObject(-15);
        return;
      }
      if (event.key === ']') {
        event.preventDefault();
        rotateSelectedObject(15);
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
        if (!selectedIdRef.current) return;
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSelected, redoLast, rotateSelectedObject, scaleSelectedObject, undoLast]);

  const hudScale = (() => {
    if (selectedId === 'background' || (!selectedId && background)) return background?.scale ?? 1;
    const overlay = overlays.find((item) => item.id === selectedId);
    if (overlay) return zoomFromOverlayWidth(overlay.width);
    const object = objects.find((item) => item.id === selectedId);
    if (object) return zoomFromObjectWidth(object.width);
    return background?.scale ?? 1;
  })();
  const showZoomHud = Boolean(background) || overlays.length > 0 || objects.length > 0 || shapes.length > 0;
  const selectedObject = objects.find((item) => item.id === selectedId) ?? null;
  const selectedShape = shapes.find((item) => item.id === selectedId) ?? null;
  const zoomPercent = Math.round(hudScale * 100);

  const composerBody = (
    <section
      id={isFullscreen ? 'lead-ai-ambiente-composer-fullscreen' : 'lead-ai-ambiente-composer'}
      className={cn(
        'overflow-hidden border bg-gradient-to-b from-mahogany-card/80 to-mahogany-elevated/40 shadow-inner shadow-black/10 transition-[box-shadow,border-color] duration-500',
        isFullscreen
          ? 'flex h-full min-h-0 w-full flex-col rounded-none border-0'
          : 'rounded-xl',
        photoPulse ? 'border-gold/70 shadow-[0_0_0_1px_rgba(242,216,146,0.35)]' : 'border-gold-border-subtle/30',
      )}
    >
      <div className="relative shrink-0 border-b border-gold-border-subtle/20 bg-mahogany-elevated/60 px-4 py-3 sm:px-5">
        <AmbienteAtmosphereFoil intensity={0.7} />
        <div className="relative flex items-start justify-between gap-3">
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
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
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
              aria-label="Salvar cópia na pasta do lead"
            >
              {isSavingCopy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Salvar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-gold-border-subtle/40 bg-mahogany-muted/40"
              onClick={() => setIsFullscreen((open) => !open)}
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
                onClick={() => setIsFullscreen(false)}
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
              isFullscreen ? 'min-h-0 flex-1' : catalogOpen ? 'h-[320px] max-h-[320px]' : 'max-h-[min(52vh,420px)]',
            )}
            style={isFullscreen ? undefined : { minHeight: 320 }}
          >
          <div
            ref={viewportRef}
            role="application"
            aria-label="Área de composição do ambiente"
            className={cn(
              'absolute inset-0 bg-muted/20 rounded-xl border border-border/60 shadow-inner',
              selectedObject || selectedShape ? 'overflow-visible' : 'overflow-hidden',
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
                  'absolute inset-0 h-full w-full object-contain transition-[transform] duration-150',
                  selectedId === 'background' && 'ring-1 ring-inset ring-gold/40',
                )}
                draggable={false}
                style={{
                  transform: `translate(${(background.offsetX - 0.5) * 40}%, ${(background.offsetY - 0.5) * 40}%) scale(${background.scale})`,
                  transformOrigin: 'center center',
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
            ) : (
              <div className="pointer-events-none absolute inset-0 z-[56] flex flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
                <div className="rounded-2xl bg-primary/10 p-4">
                  <ImageIcon className="h-10 w-10 text-primary/70" />
                </div>
                <p className="max-w-xs text-center text-sm font-medium">
                  Insira a foto do cômodo ou desenhe o ambiente na lousa. Depois você posiciona as peças na cena.
                </p>
                <div className="pointer-events-auto z-[60] flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    disabled={locked}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Inserir foto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={locked}
                    onClick={() => cameraCaptureRef.current?.requestCapture()}
                  >
                    <Camera className="h-4 w-4" />
                    Tirar foto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={locked}
                    onClick={() => setProjectPickerOpen(true)}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Do projeto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={locked}
                    onClick={toggleCatalog}
                  >
                    <Sofa className="h-4 w-4" />
                    Objetos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={!canUndo}
                    onClick={undoLast}
                  >
                    <Undo2 className="h-4 w-4" />
                    Desfazer
                  </Button>
                  {!isFullscreen && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setIsFullscreen(true)}
                    >
                      <Maximize2 className="h-4 w-4" />
                      Tela cheia
                    </Button>
                  )}
                </div>
              </div>
            )}

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
                  'absolute z-20 cursor-grab overflow-visible rounded-md border shadow-md active:cursor-grabbing',
                  selectedId === overlay.id ? 'border-gold ring-2 ring-gold/40' : 'border-gold/30',
                )}
                style={{
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                  width: `${overlay.width * 100}%`,
                  height: `${overlay.height * 100}%`,
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
                  className="h-full w-full rounded-md object-cover"
                  draggable={false}
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
              const payload = {
                kind: 'furniture_module' as const,
                moduleType: object.moduleType,
                a: { x: 50, y: 8 },
                b: { x: 50, y: 92 },
                widthOverride: 72,
                topDown: true,
                colorHex: object.colorHex,
                locked: true,
              };
              return (
                <div
                  key={object.id}
                  className={cn(
                    'absolute z-30 cursor-grab overflow-visible active:cursor-grabbing',
                    selectedId === object.id && 'drop-shadow-[0_0_12px_rgba(242,216,146,0.55)]',
                  )}
                  style={{
                    left: `${object.x * 100}%`,
                    top: `${object.y * 100}%`,
                    width: `${object.width * 100}%`,
                    height: `${object.height * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${object.rotation ?? 0}deg)`,
                  }}
                  onPointerDown={(event) => beginDrag('object', object.id, object.x, object.y, event)}
                >
                  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                    <FurnitureModuleGfx payload={payload} strokeColor="#f2d892" strokeWidth={1.6} selected={selectedId === object.id} />
                  </svg>
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
                onChangeType={changeSelectedObjectType}
                onRemove={() => removeById(selectedObject.id)}
              />
            )}

            {markers.map((marker) => (
              <div
                key={marker.id}
                className={cn(
                  'absolute z-40 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border px-2.5 py-1 text-[11px] font-semibold text-[#f2d892] active:cursor-grabbing',
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

            {background && (
              <div className="pointer-events-auto absolute left-3 top-3 z-[55] flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5" disabled={locked} onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5" />
                  Imagem
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5" disabled={locked} onClick={() => cameraCaptureRef.current?.requestCapture()}>
                  <Camera className="h-3.5 w-3.5" />
                  Foto
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5" disabled={locked} onClick={() => setProjectPickerOpen(true)}>
                  <FolderOpen className="h-3.5 w-3.5" />
                  Projeto
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5" disabled={locked} onClick={toggleCatalog}>
                  <Sofa className="h-3.5 w-3.5" />
                  Objetos
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5" disabled={!canUndo} onClick={undoLast}>
                  <Undo2 className="h-3.5 w-3.5" />
                  Desfazer
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5" disabled={!canSaveCopy} onClick={() => void saveCopyToFolder()}>
                  {isSavingCopy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
                {selectedId && selectedId !== 'background' && (
                  <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5" disabled={locked} onClick={removeSelected}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar
                  </Button>
                )}
                {!isFullscreen && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Tela cheia
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-cream-muted"
                  disabled={locked}
                  onClick={clearPhoto}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar foto
                </Button>
              </div>
            )}

            <WhiteboardProjectImagePicker
              leadId={leadId}
              open={projectPickerOpen}
              onOpenChange={setProjectPickerOpen}
              existingImageUrls={background ? [background.url, ...overlays.map((o) => o.url)] : []}
              onSelect={async (midia) => {
                try {
                  const preview = await urlToImagePreview(
                    midia.file_url,
                    midia.preview_label || midia.file_name || 'Foto do projeto',
                  );
                  await setPhotoAsBackgroundOrOverlay(preview);
                  if (midia.folder_id) setSourceFolderId(midia.folder_id);
                  setProjectPickerOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Não foi possível importar a foto');
                }
              }}
            />

            {showZoomHud && (
              <AmbienteZoomHud
                scale={hudScale}
                disabled={locked}
                onScaleChange={applySelectedScale}
                onZoomIn={() => nudgeSelectedScale(1)}
                onZoomOut={() => nudgeSelectedScale(-1)}
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
                  : 'mt-3 h-[min(22rem,46vh)] w-full',
              )}
            >
              <WhiteboardFurnitureCatalog
                selectedType={selectedFurnitureType}
                onSelect={handlePlaceFurniture}
                disabled={locked}
                variant="dock"
                hint="Digite o nome, escolha o modelo e clique para posicionar na cena."
                onClose={() => setCatalogOpen(false)}
              />
            </aside>
          )}
        </div>

        <TooltipProvider delayDuration={200}>
          <div
            data-ambiente-toolbar="true"
            className={cn(
              'flex flex-wrap items-center gap-1.5 rounded-xl border border-border/80 bg-[hsl(var(--card))] p-2 shadow-sm',
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
                  aria-label="Salvar cópia na pasta do lead"
                  onClick={() => void saveCopyToFolder()}
                >
                  {isSavingCopy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{saveDisabledReason ?? 'Salvar cópia na pasta do lead'}</TooltipContent>
            </Tooltip>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-cream-muted"
              disabled={locked || !hasComposition}
              onClick={() => {
                pushHistory();
                setObjects([]);
                setOverlays([]);
                setMarkers([]);
                setShapes([]);
                setDrawPreview(null);
                setSelectedId(background ? 'background' : null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar desenhos
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

        <div className={cn('flex flex-wrap gap-2', isFullscreen && 'shrink-0')}>
          <Button
            type="button"
            variant="outline"
            disabled={locked || !canAnalyze}
            onClick={() => void handleAnalyze()}
            className="border-gold-border-subtle/40 bg-mahogany-muted/40"
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
            disabled={locked || isBusy || !canRender}
            onClick={() => void handleRenderAmbiente()}
            className="relative overflow-hidden"
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
      </div>
    </section>
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
            onClick={() => setIsFullscreen(false)}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Voltar ao card
          </Button>
        </section>
      ) : (
        composerBody
      )}

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent
          overlayClassName="z-[80]"
          data-ambiente-composer-fullscreen=""
          className={cn(
            'z-[80] !fixed inset-0 left-0 top-0 !translate-x-0 !translate-y-0 max-w-none w-[100dvw] h-[100dvh] max-h-[100dvh] p-0 gap-0 !flex !flex-col rounded-none border-0 bg-mahogany-panel',
            '[&>button]:hidden data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 touch-manipulation',
          )}
          onOpenAutoFocus={(event) => {
            if (catalogOpen) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (folderPickerOpen) event.preventDefault();
            if (target?.closest('[data-furniture-catalog]')) event.preventDefault();
            if (target?.closest('[data-furniture-catalog-dock]')) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (folderPickerOpen) event.preventDefault();
            if (target?.closest('[data-whiteboard-viewport]')) event.preventDefault();
            if (target?.closest('[data-furniture-catalog]')) event.preventDefault();
            if (target?.closest('[data-furniture-catalog-dock]')) event.preventDefault();
            if (target?.closest('[data-whiteboard-project-picker]')) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (folderPickerOpen) event.preventDefault();
            if (target?.closest('[data-whiteboard-viewport]')) event.preventDefault();
            if (target?.closest('[data-furniture-catalog]')) event.preventDefault();
            if (target?.closest('[data-furniture-catalog-dock]')) event.preventDefault();
            if (target?.closest('[data-whiteboard-project-picker]')) event.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">Compor ambiente em tela cheia</DialogTitle>
          {isFullscreen ? composerBody : null}
        </DialogContent>
      </Dialog>

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
      <LeadFolderPickDialog
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        leadId={leadId}
        title="Salvar cópia em qual pasta?"
        description="A foto original do lead não muda. Na pasta entram uma cópia da foto e, se houver objetos, a composição do ambiente."
        confirmLabel="Salvar nesta pasta"
        previewUrl={background?.url}
        elevated={isFullscreen}
        coverItems={pdfs}
        askFileName
        defaultFileName={
          background?.label
            ? sanitizeVisitFileBaseName(background.label.replace(/\.[^.]+$/, ''))
            : 'ambiente'
        }
        onConfirm={(folderId, options) => performSaveCopy(folderId, options)}
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
}
