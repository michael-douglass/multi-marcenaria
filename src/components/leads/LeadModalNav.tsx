import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  filterLeadDetailsNav,
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
}: LeadModalNavProps) {
  const [openMenu, setOpenMenu] = useState<LeadNavMenu | null>(null);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const detailsItems = filterLeadDetailsNav({
    hideContratos,
    hideOrcamentos,
    hideMarkup,
    hideWhatsapp,
  });
  const iaItems = showIa ? LEAD_IA_NAV : [];
  const openItems = openMenu === 'ia' ? iaItems : openMenu === 'detalhes' ? detailsItems : [];

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

  return (
    <nav
      ref={rootRef}
      className="lead-modal-nav relative z-[3] shrink-0 border-b px-3 sm:px-4 py-2"
      aria-label="Índice do card do lead"
    >
      <div className="flex items-center gap-1">
        <NavTrigger
          label="Detalhes"
          icon={FileText}
          open={openMenu === 'detalhes'}
          active={activeTab === 'detalhes'}
          controls={`${panelId}-detalhes`}
          onClick={() => toggleMenu('detalhes')}
        />
        {showIa && (
          <NavTrigger
            label="IA"
            srLabel="Análise IA"
            icon={Sparkles}
            open={openMenu === 'ia'}
            active={activeTab === 'analise-ia'}
            controls={`${panelId}-ia`}
            onClick={() => toggleMenu('ia')}
          />
        )}
      </div>

      <AnimatePresence initial={false}>
        {openMenu && openItems.length > 0 && (
          <motion.div
            key={openMenu}
            id={openMenu === 'ia' ? `${panelId}-ia` : `${panelId}-detalhes`}
            className="lead-modal-nav__panel mt-2 overflow-hidden"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.38, ease: unrollEase }}
          >
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--lead-muted)]">
              {openMenu === 'ia' ? 'Escolha o estúdio' : 'Ir para a seção'}
            </p>
            <div className="lead-modal-nav__scroller -mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {openItems.map((item, index) => {
                const isCurrent =
                  item.tab === activeTab &&
                  (!item.iaSubtab || item.iaSubtab === iaSubtab);
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    className={cn(
                      'lead-modal-nav__item shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                      isCurrent && 'border-[color:var(--lead-line-strong)]',
                    )}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.28,
                      delay: reduceMotion ? 0 : 0.04 * index,
                      ease: unrollEase,
                    }}
                    onClick={() => handleJump(item)}
                  >
                    <span className="block text-[11px] font-semibold leading-none tracking-wide">
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="mt-1 block max-w-[9.5rem] truncate text-[10px] text-[color:var(--lead-muted)]">
                        {item.hint}
                      </span>
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
}: {
  label: string;
  srLabel?: string;
  icon: typeof FileText;
  open: boolean;
  active: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'lead-modal-nav__trigger inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lead-gold)]/45',
      )}
      data-active={active ? 'true' : 'false'}
      aria-label={srLabel}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      <ChevronDown
        className={cn('h-3.5 w-3.5 transition-transform duration-300', open && 'rotate-180')}
        aria-hidden
      />
    </button>
  );
}
