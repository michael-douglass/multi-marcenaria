import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, FileText, IdCard, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  filterLeadDetailsNav,
  filterLeadInfoNav,
  LEAD_IA_NAV,
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
}

const unrollEase = [0.22, 1, 0.36, 1] as const;

const MENU_PANEL_LABEL: Record<LeadNavMenu, string> = {
  info: 'Ir para a ficha',
  detalhes: 'Ir para a seção',
  ia: 'Escolha o estúdio',
};

export function LeadModalNav({
  activeTab,
  iaSubtab,
  onJump,
  onOpenMenu,
  showIa = true,
  hideContratos,
  hideOrcamentos,
  hideMarkup,
  hideWhatsapp,
  hidePontuaGarbo,
}: LeadModalNavProps) {
  const [openMenu, setOpenMenu] = useState<LeadNavMenu | null>(null);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
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

  const toggleMenu = (menu: LeadNavMenu) => {
    setOpenMenu((current) => {
      const next = current === menu ? null : menu;
      if (next) onOpenMenu?.(next);
      return next;
    });
  };

  const handleJump = (item: LeadNavJumpItem) => {
    setOpenMenu(null);
    onJump(item);
  };

  const infoActive = activeTab === 'info';
  const detailsActive = activeTab === 'detalhes';

  return (
    <nav
      ref={rootRef}
      className="lead-modal-nav relative z-[3] shrink-0 border-b px-3 sm:px-5 py-2 sm:py-2.5"
      aria-label="Índice do card do lead"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <NavTrigger
          label="Informações do lead"
          srLabel="Informações do lead — Contato, Negócio, Equipe e Pontua Garbo"
          icon={IdCard}
          open={openMenu === 'info'}
          active={infoActive}
          controls={`${panelId}-panel`}
          emphasis
          onClick={() => toggleMenu('info')}
        />
        <NavTrigger
          label="Detalhes"
          icon={FileText}
          open={openMenu === 'detalhes'}
          active={detailsActive}
          controls={`${panelId}-panel`}
          onClick={() => toggleMenu('detalhes')}
        />
        {showIa && (
          <NavTrigger
            label="IA"
            srLabel="Análise IA"
            icon={Sparkles}
            open={openMenu === 'ia'}
            active={activeTab === 'analise-ia'}
            controls={`${panelId}-panel`}
            onClick={() => toggleMenu('ia')}
          />
        )}
      </div>

      <AnimatePresence initial={false}>
        {openMenu && openItems.length > 0 && (
          <motion.div
            key={openMenu}
            id={`${panelId}-panel`}
            role="listbox"
            aria-label={MENU_PANEL_LABEL[openMenu]}
            className={cn(
              'lead-modal-nav__panel mt-3 overflow-hidden rounded-xl border',
              openMenu === 'info' && 'lead-modal-nav__panel--info',
            )}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: unrollEase }}
          >
            <div className="lead-modal-nav__list max-h-[min(22rem,42vh)] overflow-y-auto p-1.5 [scrollbar-width:thin]">
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
                      isCurrent && 'is-current',
                    )}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.22,
                      delay: reduceMotion ? 0 : 0.03 * index,
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
  emphasis = false,
}: {
  label: string;
  srLabel?: string;
  icon: typeof FileText;
  open: boolean;
  active: boolean;
  controls: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
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
