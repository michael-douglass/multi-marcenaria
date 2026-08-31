import { useEffect, useState } from 'react';
import * as THREE from 'three';
import {
  Camera,
  ChevronRight,
  FolderOpen,
  ImagePlus,
  Loader2,
  PanelRight,
  Redo2,
  Save,
  Sofa,
  Trash2,
  Undo2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GARBO_WOOD_TEXTURE_URL } from '@/lib/furniture-catalog-banks';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AmbienteSceneDockProps {
  locked?: boolean;
  catalogOpen?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  canSave?: boolean;
  isSaving?: boolean;
  hasBackground?: boolean;
  hasSelection?: boolean;
  onInsertPhoto: () => void;
  onCapture: () => void;
  onProject: () => void;
  onToggleCatalog: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onRemoveSelected?: () => void;
  onClearPhoto?: () => void;
}

interface DockAction {
  id: string;
  label: string;
  hint: string;
  icon: typeof ImagePlus;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function useWoodStrip(): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    THREE.Cache.enabled = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      GARBO_WOOD_TEXTURE_URL,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const image = texture.image as HTMLImageElement | undefined;
        if (!image || cancelled) return;
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 420;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setSrc(GARBO_WOOD_TEXTURE_URL);
          return;
        }
        ctx.fillStyle = '#1a100c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        const wash = ctx.createLinearGradient(0, 0, canvas.width, 0);
        wash.addColorStop(0, 'rgba(26,16,12,0.35)');
        wash.addColorStop(0.45, 'rgba(242,216,146,0.08)');
        wash.addColorStop(1, 'rgba(26,16,12,0.55)');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!cancelled) setSrc(canvas.toDataURL('image/jpeg', 0.82));
      },
      undefined,
      () => {
        if (!cancelled) setSrc(GARBO_WOOD_TEXTURE_URL);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return src;
}

/**
 * Ferramentas da lousa — ícone no canto direito, abre e fecha para não cobrir a foto.
 */
export function AmbienteSceneDock({
  locked = false,
  catalogOpen = false,
  canUndo = false,
  canRedo = false,
  canSave = false,
  isSaving = false,
  hasBackground = false,
  hasSelection = false,
  onInsertPhoto,
  onCapture,
  onProject,
  onToggleCatalog,
  onUndo,
  onRedo,
  onSave,
  onRemoveSelected,
  onClearPhoto,
}: AmbienteSceneDockProps) {
  const [open, setOpen] = useState(false);
  const woodSrc = useWoodStrip();

  const actions: DockAction[] = [
    { id: 'photo', label: 'Inserir', hint: 'Inserir foto do computador', icon: ImagePlus, onClick: onInsertPhoto, disabled: locked },
    { id: 'camera', label: 'Tirar foto', hint: 'Fotografar o cômodo', icon: Camera, onClick: onCapture, disabled: locked },
    { id: 'project', label: 'Do projeto', hint: 'Foto já anexada no lead', icon: FolderOpen, onClick: onProject, disabled: locked },
    { id: 'objects', label: 'Objetos', hint: catalogOpen ? 'Fechar catálogo' : 'Abrir catálogo de móveis', icon: Sofa, onClick: onToggleCatalog, disabled: locked },
    { id: 'undo', label: 'Desfazer', hint: 'Desfazer — Ctrl+Z', icon: Undo2, onClick: onUndo, disabled: !canUndo },
    { id: 'redo', label: 'Refazer', hint: 'Refazer — Ctrl+Y', icon: Redo2, onClick: onRedo, disabled: !canRedo },
    { id: 'save', label: 'Salvar', hint: 'Salvar cópia na pasta do lead', icon: Save, onClick: onSave, disabled: !canSave },
  ];

  return (
    <div
      data-ambiente-scene-dock=""
      className="pointer-events-auto absolute right-2 top-1/2 z-[70] -translate-y-1/2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {!open ? (
        <button
          type="button"
          aria-expanded={false}
          aria-label="Abrir ferramentas da lousa"
          title="Ferramentas"
          className={cn(
            'group relative flex h-14 w-11 flex-col items-center justify-center overflow-hidden',
            'rounded-l-2xl rounded-r-md border border-[rgba(240,210,140,0.42)]',
            'shadow-[0_10px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(242,216,146,0.18)]',
            'transition hover:border-[rgba(242,216,146,0.7)] hover:brightness-110',
          )}
          style={{
            backgroundColor: '#1a100c',
            backgroundImage: woodSrc ? `url(${woodSrc})` : undefined,
            backgroundSize: 'cover',
          }}
          onClick={() => setOpen(true)}
        >
          <span className="absolute inset-y-2 left-0 w-px bg-gradient-to-b from-transparent via-[#f2d892]/70 to-transparent" />
          <PanelRight className="h-4 w-4 text-[#f2d892]" />
          <Wrench className="mt-0.5 h-3 w-3 text-[#fff6ea]/80" />
        </button>
      ) : (
        <div
          className={cn(
            'relative w-[9.75rem] overflow-hidden rounded-2xl',
            'border border-[rgba(240,210,140,0.4)]',
            'shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(242,216,146,0.16)]',
          )}
          style={{ backgroundColor: '#140c0a' }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: woodSrc ? `url(${woodSrc})` : undefined,
              backgroundSize: 'cover',
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#f2d892]/12 via-transparent to-black/40" aria-hidden />

          <div className="relative">
            <div className="flex items-center justify-between gap-2 border-b border-[rgba(240,210,140,0.18)] px-2.5 py-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f2d892]"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Ferramentas
              </p>
              <button
                type="button"
                aria-label="Minimizar ferramentas"
                title="Minimizar"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(240,210,140,0.28)] text-[#f2d892] hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-0.5 p-1.5">
              {actions.map((action) => {
                const Icon = action.icon;
                const busy = action.id === 'save' && isSaving;
                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={action.disabled || busy}
                        aria-label={action.label}
                        aria-pressed={action.id === 'objects' ? catalogOpen : undefined}
                        className={cn(
                          'flex h-9 items-center gap-2 rounded-lg px-2 text-left text-[11px] font-semibold',
                          'text-[#fff6ea] transition-colors',
                          action.id === 'objects' && catalogOpen
                            ? 'bg-[#f2d892]/18 text-[#f2d892] ring-1 ring-[#f2d892]/45'
                            : 'hover:bg-white/6',
                          'disabled:opacity-35',
                        )}
                        onClick={action.onClick}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Icon className="h-3.5 w-3.5 shrink-0 text-[#f2d892]" />}
                        <span className="truncate">{action.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">{action.hint}</TooltipContent>
                  </Tooltip>
                );
              })}

              {hasSelection && onRemoveSelected && (
                <button
                  type="button"
                  disabled={locked}
                  className="mt-0.5 flex h-9 items-center gap-2 rounded-lg px-2 text-left text-[11px] font-semibold text-[#f3c4b8] hover:bg-red-950/50 disabled:opacity-35"
                  onClick={onRemoveSelected}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  Apagar peça
                </button>
              )}
              {hasBackground && onClearPhoto && (
                <button
                  type="button"
                  disabled={locked}
                  className="flex h-9 items-center gap-2 rounded-lg px-2 text-left text-[11px] font-semibold text-[#d4bc9f] hover:bg-white/5 disabled:opacity-35"
                  onClick={onClearPhoto}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  Limpar foto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
