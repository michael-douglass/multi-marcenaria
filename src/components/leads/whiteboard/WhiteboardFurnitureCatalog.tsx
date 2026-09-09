import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Box, Home, Search, Square, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FurnitureModuleThumb } from '@/components/leads/whiteboard/FurnitureModuleGfx';
import { ChecklistGoldFoil } from '@/components/leads/whiteboard/ChecklistGoldFoil';
import { RealisticFurniturePreview } from '@/components/leads/ambiente/RealisticFurniturePreview';
import { useFurnitureFavorites } from '@/hooks/useFurnitureFavorites';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import {
  FURNITURE_CATALOG_GROUPS,
  FURNITURE_FAMILIES,
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
  const { favorites, toggle, isFavorite } = useFurnitureFavorites();
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
    () => searchCatalogBank(bank, query, group as FurnitureCatalogGroupId | string, favorites),
    [bank, query, group, favorites],
  );

  const groupedResults = useMemo(() => {
    const buckets = new Map<string, typeof results>();
    for (const mod of results) {
      const list = buckets.get(mod.family) ?? [];
      list.push(mod);
      buckets.set(mod.family, list);
    }
    return FURNITURE_FAMILIES.map((family) => ({
      family,
      items: buckets.get(family.id) ?? [],
    })).filter((entry) => entry.items.length > 0);
  }, [results]);

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
                  placeholder="Ex.: armário de banheiro, mesa de cozinha, guarda-roupa, sofá…"
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
            <div className="flex flex-col gap-3 p-2">
              {groupedResults.map(({ family, items }) => (
                <section key={family.id} aria-label={family.label}>
                  <header className="sticky top-0 z-10 mb-1.5 flex items-baseline justify-between gap-2 rounded-md bg-[#120c08]/92 px-1 py-1 backdrop-blur-sm">
                    <h4
                      className="text-[11px] tracking-[0.14em] text-[#f2d892]"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {family.label}
                    </h4>
                    <span className="text-[9px] text-[#d4bc9f]/80">
                      {items.length} modelo{items.length === 1 ? '' : 's'}
                    </span>
                  </header>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((mod) => {
                      const active = selectedType === mod.type;
                      const fav = isFavorite(mod.type);
                      return (
                        <div key={`${bank}-${mod.type}`} className="relative">
                          <button
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
                              'flex w-full items-center gap-2 rounded-xl border px-2 py-2 pr-8 text-left transition-colors',
                              active
                                ? 'border-[#f2d892] bg-[#f2d892]/20 text-[#fff6ea] shadow-[0_0_14px_rgba(242,216,146,0.22)]'
                                : 'border-[rgba(240,210,140,0.28)] bg-black/25 text-[#fff6ea] hover:border-[rgba(240,210,140,0.5)] hover:bg-white/8',
                            )}
                          >
                            <FurnitureModuleThumb
                              moduleType={mod.type}
                              flatFront={bank === 'reto'}
                              className="h-14 w-11 shrink-0 text-[#f2d892]"
                            />
                            <span className="min-w-0">
                              <span className="block text-[12px] font-semibold leading-tight text-[#fff6ea]">
                                {mod.label}
                              </span>
                              <span className="mt-0.5 block text-[10px] leading-tight text-[#e2c9a8] line-clamp-2">
                                {bank === 'reto' ? 'Frontal' : bank === '3d' ? 'Volume 3D' : mod.description}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            title={fav ? 'Remover dos favoritos' : 'Marcar como favorito'}
                            aria-label={fav ? `Desmarcar ${mod.label} como favorito` : `Marcar ${mod.label} como favorito`}
                            aria-pressed={fav}
                            disabled={disabled}
                            className={cn(
                              'absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full',
                              fav ? 'text-[#f2d892]' : 'text-[#d4bc9f]/80 hover:text-[#f2d892]',
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              toggle(mod.type);
                            }}
                          >
                            <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {results.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-[#d4bc9f]">
                {group === 'favoritos'
                  ? 'Nenhum favorito ainda. Toque na estrela de um móvel para ele aparecer primeiro na busca.'
                  : `Nenhum item para “${query}”. Tente banheiro, mesa de cozinha, guarda-roupa ou sofá.`}
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
