import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Box, Home, Search, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FurnitureModuleThumb } from '@/components/leads/whiteboard/FurnitureModuleGfx';
import { ChecklistGoldFoil } from '@/components/leads/whiteboard/ChecklistGoldFoil';
import { RealisticFurniturePreview } from '@/components/leads/ambiente/RealisticFurniturePreview';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import {
  FURNITURE_CATALOG_GROUPS,
  getFurnitureModuleMeta,
  type FurnitureCatalogGroupId,
} from '@/lib/furniture-modules';
import {
  FURNITURE_CATALOG_BANKS,
  searchCatalogBank,
  type FurnitureCatalogBankId,
  type FurnitureViewMode,
} from '@/lib/furniture-catalog-banks';

interface WhiteboardFurnitureCatalogProps {
  selectedType: FurnitureModuleType;
  onSelect: (moduleType: FurnitureModuleType, viewMode: FurnitureViewMode) => void;
  disabled?: boolean;
  isFullscreen?: boolean;
  bottomOffsetPx?: number;
  onClose?: () => void;
  /** Ancora o painel no botão (sobe para o body e não é cortado pela foto). */
  anchorRef?: RefObject<HTMLElement | null>;
  floating?: boolean;
  hint?: string;
  /** Portal para dentro do dialog aberto — senão a busca não recebe teclado. */
  portalContainer?: HTMLElement | null;
  /** Painel encaixado (tela cheia / compositor) — fica no fluxo e a busca funciona. */
  variant?: 'overlay' | 'dock';
}

const PANEL_HEIGHT_PX = 520;
const PANEL_WIDTH_PX = 360;

const BANK_ICONS: Record<FurnitureCatalogBankId, typeof Square> = {
  reto: Square,
  '3d': Box,
  realista: Home,
};

interface FloatingBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

function computeFloatingBox(
  anchor: HTMLElement | null,
  container: HTMLElement | null,
): FloatingBox {
  const width = Math.min(PANEL_WIDTH_PX, Math.max(280, window.innerWidth - 24));
  const maxHeight = Math.min(PANEL_HEIGHT_PX, window.innerHeight - 24);
  const anchorRect = anchor?.getBoundingClientRect();
  const containerRect = container && container !== document.body ? container.getBoundingClientRect() : null;

  let top: number;
  let left: number;
  if (!anchorRect) {
    top = Math.max(12, (window.innerHeight - maxHeight) / 2);
    left = Math.max(12, (window.innerWidth - width) / 2);
  } else {
    const gap = 8;
    top = anchorRect.bottom + gap;
    if (top + maxHeight > window.innerHeight - 12) {
      const above = anchorRect.top - gap - maxHeight;
      top = above >= 12 ? above : Math.max(12, window.innerHeight - maxHeight - 12);
    }
    left = anchorRect.left;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    left = Math.max(12, left);
  }

  if (containerRect) {
    return {
      top: top - containerRect.top,
      left: left - containerRect.left,
      width,
      height: maxHeight,
    };
  }

  return { top, left, width, height: maxHeight };
}

export function WhiteboardFurnitureCatalog({
  selectedType,
  onSelect,
  disabled = false,
  isFullscreen = false,
  bottomOffsetPx,
  onClose,
  anchorRef,
  floating = false,
  hint,
  portalContainer = null,
  variant = 'overlay',
}: WhiteboardFurnitureCatalogProps) {
  const [query, setQuery] = useState('');
  const [bank, setBank] = useState<FurnitureCatalogBankId>('3d');
  const [group, setGroup] = useState<string>('todos');
  const [previewType, setPreviewType] = useState<FurnitureModuleType>(selectedType);
  const [box, setBox] = useState<FloatingBox | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = getFurnitureModuleMeta(selectedType);
  const isDock = variant === 'dock';
  const usePortal = !isDock && (floating || Boolean(anchorRef));
  const portalTarget = portalContainer ?? (typeof document !== 'undefined' ? document.body : null);
  const anchoredInDialog = Boolean(portalContainer && portalContainer !== document.body);
  const activeBank = FURNITURE_CATALOG_BANKS.find((item) => item.id === bank) ?? FURNITURE_CATALOG_BANKS[1];
  const groupChips = FURNITURE_CATALOG_GROUPS;

  const results = useMemo(
    () => searchCatalogBank(bank, query, group as FurnitureCatalogGroupId | string),
    [bank, query, group],
  );

  useEffect(() => {
    setPreviewType(selectedType);
  }, [selectedType]);

  useEffect(() => {
    if (!FURNITURE_CATALOG_GROUPS.some((item) => item.id === group)) {
      setGroup('todos');
    }
  }, [group]);

  useEffect(() => {
    const id = window.setTimeout(() => searchRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, []);

  const updateBox = () => {
    setBox(computeFloatingBox(anchorRef?.current ?? null, portalContainer ?? null));
  };

  useLayoutEffect(() => {
    if (!usePortal) return;
    updateBox();
  }, [usePortal, anchorRef, portalContainer]);

  useEffect(() => {
    if (!usePortal) return;
    const onReposition = () => updateBox();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [usePortal, anchorRef, portalContainer]);

  useEffect(() => {
    if (!usePortal || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [usePortal, onClose]);

  const helpText = hint ?? activeBank.hint;

  const panel = (
    <div
      ref={panelRef}
      data-furniture-catalog
      data-furniture-bank={bank}
      className={cn(
        'pointer-events-auto flex flex-col items-start',
        isDock && 'relative h-full w-full min-h-[18rem]',
        !isDock && usePortal && (anchoredInDialog ? 'absolute z-[110]' : 'fixed z-[110]'),
        !isDock && !usePortal && cn('absolute z-[9800]', isFullscreen ? 'left-3' : 'bottom-3 left-3'),
      )}
      style={
        isDock
          ? undefined
          : usePortal && box
            ? { top: box.top, left: box.left, width: box.width }
            : isFullscreen
              ? { bottom: bottomOffsetPx ?? 88 }
              : undefined
      }
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'border border-[rgba(240,210,140,0.38)]',
          'shadow-[0_18px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(242,216,146,0.12)]',
          usePortal || isDock ? 'w-full' : 'w-[min(94vw,22.5rem)]',
        )}
        style={{
          height: isDock ? '100%' : usePortal && box ? box.height : PANEL_HEIGHT_PX,
          background:
            'radial-gradient(120% 80% at 0% 0%, rgba(242,216,146,0.18), transparent 48%), linear-gradient(180deg, rgba(62,38,28,0.98), rgba(32,18,14,0.98))',
        }}
      >
        <ChecklistGoldFoil />

        <div className="relative flex h-full flex-col">
          <header className="shrink-0 border-b border-[rgba(240,210,140,0.18)] px-3 pb-2.5 pt-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f2d892]"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.18em' }}
                >
                  {activeBank.kicker}
                </p>
                <h3
                  className="truncate text-[1.35rem] font-semibold leading-none text-[#fff6ea]"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {bank === 'realista' ? 'Projetos na casa' : 'Móveis e utensílios'}
                </h3>
                <p className="mt-1 text-[11px] text-[#d4bc9f]">{helpText}</p>
              </div>
              {onClose && (
                <button
                  type="button"
                  aria-label="Fechar catálogo"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(240,210,140,0.28)] text-[#f2d892] hover:bg-white/5"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div
              role="tablist"
              aria-label="Bancos de objetos"
              className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-[rgba(240,210,140,0.22)] bg-black/30 p-1"
            >
              {FURNITURE_CATALOG_BANKS.map((item) => {
                const active = bank === item.id;
                const Icon = BANK_ICONS[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={disabled}
                    onClick={() => {
                      setBank(item.id);
                      setGroup('todos');
                      setQuery('');
                    }}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors',
                      active
                        ? 'bg-[#f2d892]/18 text-[#fff6ea] shadow-[0_0_12px_rgba(242,216,146,0.2)]'
                        : 'text-[#d4bc9f] hover:bg-white/5',
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      <span
                        className="text-[11px] font-semibold tracking-wide"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {item.label}
                      </span>
                    </span>
                    <span className="text-[9px] leading-none text-[#d4bc9f]/90">{item.kicker}</span>
                  </button>
                );
              })}
            </div>

            {bank === 'realista' && (
              <div className="mt-3">
                <RealisticFurniturePreview moduleType={previewType} />
              </div>
            )}

            <label className="mt-3 block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f2d892]">
                Buscar objeto
              </span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f2d892]/80" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Ex.: espelho, sofá, geladeira, cama…"
                  aria-label="Buscar objeto no catálogo"
                  disabled={disabled}
                  className="h-10 border-[rgba(240,210,140,0.35)] bg-black/35 pl-9 text-sm text-[#fff6ea] placeholder:text-[#d4bc9f]/75"
                />
              </span>
            </label>

            <div className="mt-2 flex flex-wrap gap-1">
              {groupChips.map((item) => {
                const active = group === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => setGroup(item.id)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors',
                      active
                        ? 'border-[#f2d892] bg-[#f2d892]/18 text-[#fff6ea] shadow-[0_0_10px_rgba(242,216,146,0.22)]'
                        : 'border-[rgba(240,210,140,0.22)] text-[#d4bc9f] hover:bg-white/5',
                    )}
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="grid grid-cols-2 gap-1.5 p-2">
              {results.map((mod) => {
                const active = selectedType === mod.type;
                return (
                  <button
                    key={`${bank}-${mod.type}`}
                    type="button"
                    title={mod.description}
                    disabled={disabled}
                    data-furniture-item={mod.type}
                    aria-label={`${mod.label} — ${activeBank.label}`}
                    aria-pressed={active}
                    onMouseEnter={() => setPreviewType(mod.type)}
                    onFocus={() => setPreviewType(mod.type)}
                    onClick={() => onSelect(mod.type, bank)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-1.5 py-1.5 text-left transition-colors',
                      active
                        ? 'border-[#f2d892] bg-[#f2d892]/16 text-[#fff6ea] shadow-[0_0_14px_rgba(242,216,146,0.18)]'
                        : 'border-[rgba(240,210,140,0.16)] bg-black/15 text-[#fff6ea] hover:border-[rgba(240,210,140,0.4)] hover:bg-white/5',
                    )}
                  >
                    <FurnitureModuleThumb
                      moduleType={mod.type}
                      flatFront={bank === 'reto'}
                      className="h-11 w-9 shrink-0 text-[#f2d892]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold leading-tight">
                        {mod.label}
                      </span>
                      <span className="mt-0.5 block text-[9px] leading-tight text-[#d4bc9f] line-clamp-2">
                        {bank === 'reto' ? 'Frontal' : bank === '3d' ? 'Volume 3D' : mod.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {results.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-[#d4bc9f]">
                Nenhum item para “{query}”. Tente espelho, sofá, cadeira, fogão ou nicho.
              </p>
            )}
          </ScrollArea>

          <footer className="flex shrink-0 items-center gap-2 border-t border-[rgba(240,210,140,0.16)] px-3 py-2">
            <FurnitureModuleThumb
              moduleType={selected.type}
              flatFront={bank === 'reto'}
              className="h-8 w-7 text-[#f2d892]"
            />
            <p className="min-w-0 flex-1 text-[10px] leading-tight text-[#d4bc9f]">
              Selecionado:{' '}
              <span className="font-semibold text-[#fff6ea]">{selected.label}</span>
              <span className="mt-0.5 block">
                {results.length} modelo{results.length === 1 ? '' : 's'} · {activeBank.label}
              </span>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );

  if (!usePortal || !portalTarget) {
    return panel;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar catálogo de objetos"
        data-furniture-catalog-overlay=""
        className={cn(anchoredInDialog ? 'absolute inset-0 z-[100]' : 'fixed inset-0 z-[100]', 'bg-black/45')}
        onClick={onClose}
      />
      {panel}
    </>,
    portalTarget,
  );
}
