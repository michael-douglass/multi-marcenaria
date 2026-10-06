import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, FileText, IdCard, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOUCH_OR_COMPACT_MQ } from '@/lib/viewport-ui';
import {
  filterLeadDetailsNav,
  filterLeadInfoNav,
  LEAD_IA_NAV,
  leadNavMenuToTab,
  type LeadIaSubtab,
  type LeadModalTabId,
  type LeadNavJumpItem,
  type LeadNavMenu,
  type LeadNavVisibility,
} from './lead-modal-nav';

interface LeadModalNavProps extends LeadNavVisibility {
  activeTab: LeadModalTabId;
  iaSubtab?: LeadIaSubtab;
  onJump: (item: LeadNavJumpItem) => void;
  onOpenMenu?: (menu: LeadNavMenu) => void;
  /** Avisa o card quando a lista do menu está aberta (para não colapsar o cabeçalho). */
  onMenuOpenChange?: (open: boolean) => void;
}

const unrollEase = [0.22, 1, 0.36, 1] as const;
/** Celular + tablet (inclui Galaxy Tab S9 Ultra em landscape). */
const COMPACT_NAV_MQ = TOUCH_OR_COMPACT_MQ;

const MENU_PANEL_LABEL: Record<LeadNavMenu, string> = {
  info: 'Ir para a ficha',
  detalhes: 'Ir para a seção',
  ia: 'Escolha o estúdio',
};

const MENU_SHORT_LABEL: Record<LeadNavMenu, string> = {
  info: 'Informações',
  detalhes: 'Detalhes',
  ia: 'IA',
};

const MENU_FULL_LABEL: Record<LeadNavMenu, string> = {
  info: 'Informações do lead',
  detalhes: 'Detalhes',
  ia: 'IA',
};

/** Adia setState do LeadModal para depois do commit do nav — evita o warning do React. */
function deferLeadModalUpdate(fn: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(fn);
    return;
  }
  setTimeout(fn, 0);
}

export function LeadModalNav({
  activeTab,
  iaSubtab,
  onJump,
  onOpenMenu,
  onMenuOpenChange,
  showIa = true,
  hideContratos,
  hideOrcamentos,
  hideMarkup,
  hideWhatsapp,
  hidePontuaGarbo,
}: LeadModalNavProps) {
  const [openMenu, setOpenMenu] = useState<LeadNavMenu | null>(null);
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_NAV_MQ).matches : false,
  );
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const onOpenMenuRef = useRef(onOpenMenu);
  const onJumpRef = useRef(onJump);
  const onMenuOpenChangeRef = useRef(onMenuOpenChange);
  onOpenMenuRef.current = onOpenMenu;
  onJumpRef.current = onJump;
  onMenuOpenChangeRef.current = onMenuOpenChange;
  const panelId = useId();
  const infoItems = filterLeadInfoNav({ hidePontuaGarbo });
  const detailsItems = filterLeadDetailsNav({
    hideContratos,
    hideOrcamentos,
    hideMarkup,
    hideWhatsapp,
  });
  const iaItems = showIa ? LEAD_IA_NAV : [];
  const openItems =
    openMenu === 'info'
      ? infoItems
      : openMenu === 'ia'
        ? iaItems
        : openMenu === 'detalhes'
          ? detailsItems
          : [];

  useEffect(() => {
    const mql = window.matchMedia(COMPACT_NAV_MQ);
    const onChange = () => setCompact(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    onMenuOpenChangeRef.current?.(openMenu != null);
  }, [openMenu]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const goToPage = (menu: LeadNavMenu) => {
    deferLeadModalUpdate(() => onOpenMenuRef.current?.(menu));
  };

  const toggleSectionList = (menu: LeadNavMenu) => {
    const willOpen = openMenu !== menu;
    setOpenMenu(willOpen ? menu : null);
    if (willOpen) {
      deferLeadModalUpdate(() => onOpenMenuRef.current?.(menu));
    }
  };

  /** Celular/tablet: toque na aba só troca a página. Desktop: abre a lista junto. */
  const handlePageClick = (menu: LeadNavMenu) => {
    const targetTab = leadNavMenuToTab(menu);
    const alreadyOnPage = activeTab === targetTab;

    if (compact) {
      if (!alreadyOnPage) {
        setOpenMenu(null);
        goToPage(menu);
        return;
      }
      toggleSectionList(menu);
      return;
    }

    if (!alreadyOnPage) goToPage(menu);
    toggleSectionList(menu);
  };

  const handleChevronClick = (menu: LeadNavMenu, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const targetTab = leadNavMenuToTab(menu);
    if (activeTab !== targetTab) goToPage(menu);
    toggleSectionList(menu);
  };

  const handleJump = (item: LeadNavJumpItem) => {
    setOpenMenu(null);
    deferLeadModalUpdate(() => onJumpRef.current?.(item));
  };

  const menus: LeadNavMenu[] = showIa ? ['info', 'detalhes', 'ia'] : ['info', 'detalhes'];
  const icons = { info: IdCard, detalhes: FileText, ia: Sparkles } as const;

  return (
    <nav
      ref={rootRef}
      className={cn(
        'lead-modal-nav relative z-[3] shrink-0 border-b px-2.5 sm:px-5 py-2 sm:py-2.5',
        compact && 'lead-modal-nav--compact',
      )}
      aria-label="Índice do card do lead"
      data-compact={compact ? 'true' : 'false'}
    >
      <div
        className={cn(
          compact
            ? 'lead-modal-nav__tabs grid gap-1'
            : 'flex flex-wrap items-center gap-2 sm:gap-2.5',
        )}
        style={compact ? { gridTemplateColumns: `repeat(${menus.length}, minmax(0, 1fr))` } : undefined}
        role={compact ? 'tablist' : undefined}
        aria-label={compact ? 'Páginas do card' : undefined}
      >
        {menus.map((menu) => {
          const tab = leadNavMenuToTab(menu);
          const active = activeTab === tab;
          const open = openMenu === menu;
          return (
            <NavTrigger
              key={menu}
              label={compact ? MENU_SHORT_LABEL[menu] : MENU_FULL_LABEL[menu]}
              srLabel={
                menu === 'info'
                  ? 'Informações do lead — Contato, Negócio, Equipe e Pontua Garbo'
                  : menu === 'ia'
                    ? 'Análise IA'
                    : 'Detalhes'
              }
              icon={icons[menu]}
              open={open}
              active={active}
              controls={`${panelId}-panel`}
              emphasis={menu === 'info'}
              compact={compact}
              role={compact ? 'tab' : undefined}
              ariaSelected={compact ? active : undefined}
              onClick={() => handlePageClick(menu)}
              onChevronClick={compact ? (event) => handleChevronClick(menu, event) : undefined}
            />
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {openMenu && openItems.length > 0 && (
          <motion.div
            key={openMenu}
            id={`${panelId}-panel`}
            role="listbox"
            aria-label={MENU_PANEL_LABEL[openMenu]}
            className={cn(
              'lead-modal-nav__panel mt-2 sm:mt-3 overflow-hidden rounded-xl border',
              openMenu === 'info' && 'lead-modal-nav__panel--info',
            )}
            initial={reduceMotion || compact ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion || compact ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion || compact ? 0 : 0.32, ease: unrollEase }}
          >
            <div
              className={cn(
                'lead-modal-nav__list overflow-y-auto p-1.5 [scrollbar-width:thin]',
                compact ? 'max-h-[min(14rem,32vh)]' : 'max-h-[min(22rem,42vh)]',
              )}
            >
              <p className="lead-modal-nav__menu-label px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                {MENU_PANEL_LABEL[openMenu]}
              </p>
              {openItems.map((item, index) => {
                const isCurrent =
                  item.tab === activeTab &&
                  (!item.iaSubtab || item.iaSubtab === iaSubtab);
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    className={cn(
                      'lead-modal-nav__item flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                      compact && 'min-h-11 py-3',
                      isCurrent && 'is-current',
                    )}
                    initial={reduceMotion || compact ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduceMotion || compact ? 0 : 0.2,
                      delay: reduceMotion || compact ? 0 : 0.025 * index,
                      ease: unrollEase,
                    }}
                    onClick={() => handleJump(item)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold leading-tight tracking-wide">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="mt-0.5 block text-[11px] leading-snug opacity-75">
                          {item.hint}
                        </span>
                      )}
                    </span>
                    {isCurrent && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--lead-gold)]" aria-hidden />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function NavTrigger({
  label,
  srLabel,
  icon: Icon,
  open,
  active,
  controls,
  onClick,
  onChevronClick,
  emphasis = false,
  compact = false,
  role,
  ariaSelected,
}: {
  label: string;
  srLabel?: string;
  icon: typeof FileText;
  open: boolean;
  active: boolean;
  controls: string;
  onClick: () => void;
  onChevronClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  emphasis?: boolean;
  compact?: boolean;
  role?: string;
  ariaSelected?: boolean;
}) {
  if (compact) {
    return (
      <div
        className={cn(
          'lead-modal-nav__trigger lead-modal-nav__trigger--compact inline-flex h-11 min-w-0 items-stretch overflow-hidden rounded-lg border transition-colors',
          emphasis && 'lead-modal-nav__trigger--info',
        )}
        data-active={active ? 'true' : 'false'}
        data-state={open ? 'open' : 'closed'}
      >
        <button
          type="button"
          role={role}
          aria-selected={ariaSelected}
          aria-label={srLabel}
          aria-expanded={open}
          aria-controls={controls}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1.5 text-[12px] font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--lead-gold)]/40"
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
        <button
          type="button"
          aria-label={`Abrir seções de ${label}`}
          aria-expanded={open}
          aria-controls={controls}
          className="inline-flex w-9 shrink-0 items-center justify-center border-l border-[color:var(--lead-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--lead-gold)]/40"
          onClick={onChevronClick}
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 opacity-70 transition-transform duration-300', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'lead-modal-nav__trigger inline-flex h-9 items-center justify-between gap-2 rounded-lg border px-3 text-[13px] font-semibold tracking-wide transition-colors',
        emphasis ? 'min-w-[11.5rem] sm:min-w-[13rem]' : 'min-w-[7.5rem]',
        emphasis && 'lead-modal-nav__trigger--info',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lead-gold)]/40',
      )}
      data-active={active ? 'true' : 'false'}
      data-state={open ? 'open' : 'closed'}
      aria-label={srLabel}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-[1.05rem] w-[1.05rem]" aria-hidden />
        {label}
      </span>
      <ChevronDown
        className={cn('h-4 w-4 shrink-0 opacity-70 transition-transform duration-300', open && 'rotate-180')}
        aria-hidden
      />
    </button>
  );
}
