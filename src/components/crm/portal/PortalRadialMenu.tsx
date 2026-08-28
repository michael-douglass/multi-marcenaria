import { useState, useEffect, useRef } from 'react';
import { Home, User, Wallet, Users } from 'lucide-react';

export type PrestadorSection = 'portal' | 'perfil' | 'saldo' | 'clientes';

interface MenuItem {
  id: PrestadorSection;
  icon: typeof Home;
  label: string;
  angle: number; // degrees from positive x-axis (counterclockwise)
  color: string;
}

const ITEMS: MenuItem[] = [
  { id: 'portal',   icon: Home,   label: 'Portal',   angle: 152, color: 'rgba(240,210,140,0.9)' },
  { id: 'perfil',   icon: User,   label: 'Perfil',   angle: 112, color: 'rgba(168,212,255,0.9)' },
  { id: 'saldo',    icon: Wallet, label: 'Saldo',    angle:  68, color: 'rgba(134,239,172,0.9)' },
  { id: 'clientes', icon: Users,  label: 'Clientes', angle:  28, color: 'rgba(196,181,253,0.9)' },
];

const ICON_RADIUS = 108;
/** Títulos mais afastados no mesmo ângulo do ícone — evita sobreposição no arco */
const LABEL_RADIUS = ICON_RADIUS + 56;
const ICON_SIZE = 48;

/** Botão central do menu — maior em mobile e desktop */
const TRIGGER_SIZES = {
  mobile: { button: 80, icon: 34, ring: 96, label: 12 },
  desktop: { button: 96, icon: 42, ring: 112, label: 13 },
} as const;

function useTriggerSizes() {
  const [sizes, setSizes] = useState(TRIGGER_SIZES.mobile);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setSizes(mq.matches ? TRIGGER_SIZES.desktop : TRIGGER_SIZES.mobile);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return sizes;
}

function deg2xy(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.round(radius * Math.cos(rad)), y: Math.round(-radius * Math.sin(rad)) };
}

const css = `
  @keyframes radial-pop {
    0%   { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3); }
    70%  { transform: translate(var(--tx), var(--ty)) scale(1.08); }
    100% { opacity: 1; transform: translate(var(--tx), var(--ty)) scale(1); }
  }
  @keyframes radial-collapse {
    0%   { opacity: 1; transform: translate(var(--tx), var(--ty)) scale(1); }
    100% { opacity: 0; transform: translate(0, 0) scale(0.3); }
  }
  @keyframes radial-label-in {
    from {
      opacity: 0;
      transform: translate(calc(-50% + var(--lx)), calc(-50% + var(--ly))) scale(0.88);
    }
    to {
      opacity: 1;
      transform: translate(calc(-50% + var(--lx)), calc(-50% + var(--ly))) scale(1);
    }
  }
  @keyframes radial-item-pop {
    0%   { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.35); }
    70%  { transform: translate(var(--tx), var(--ty)) scale(1.06); }
    100% { opacity: 1; transform: translate(var(--tx), var(--ty)) scale(1); }
  }
  @keyframes radial-ring-pulse {
    0%, 100% { transform: scale(1); opacity: 0.15; }
    50%       { transform: scale(1.12); opacity: 0.25; }
  }
  @keyframes radial-trigger-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(45deg); }
  }
  @keyframes radial-trigger-unspin {
    from { transform: rotate(45deg); }
    to   { transform: rotate(0deg); }
  }
  @keyframes radial-trigger-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(240,210,140,0.25), 0 6px 28px rgba(0,0,0,0.55); }
    50%       { box-shadow: 0 0 0 6px rgba(240,210,140,0.12), 0 8px 32px rgba(0,0,0,0.6); }
  }
  @keyframes radial-menu-label-pulse {
    0%, 100% { opacity: 0.55; text-shadow: 0 0 0 transparent; }
    50%       { opacity: 1; text-shadow: 0 0 14px rgba(240,210,140,0.5); }
  }
  .radial-trigger-open  { animation: radial-trigger-spin   0.25s cubic-bezier(.34,1.56,.64,1) forwards; }
  .radial-trigger-close { animation: radial-trigger-unspin 0.2s ease forwards; }
  .radial-ring-pulse { animation: radial-ring-pulse 3s ease-in-out infinite; }
  .radial-trigger-idle { animation: radial-trigger-glow 2.8s ease-in-out infinite; }
  .radial-menu-label-pulse { animation: radial-menu-label-pulse 2.2s ease-in-out infinite; }
`;

interface PrestadorRadialMenuProps {
  active: PrestadorSection;
  onChange: (section: PrestadorSection) => void;
}

const AUTO_PEEK_INTERVAL_MS = 4000;
const AUTO_PEEK_OPEN_MS = 1000;

export function PrestadorRadialMenu({ active, onChange }: PrestadorRadialMenuProps) {
  const [open, setOpen] = useState(false);
  const [autoPeekEnabled, setAutoPeekEnabled] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const trigger = useTriggerSizes();

  openRef.current = open;

  const closeMenu = (manual = false) => {
    if (manual) setAutoPeekEnabled(false);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu(true);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  /** A cada 4s abre por 1s; para se o prestador recolher manualmente */
  useEffect(() => {
    if (!autoPeekEnabled) return;

    let collapseTimer: ReturnType<typeof setTimeout> | undefined;

    const interval = setInterval(() => {
      if (openRef.current) return;
      setOpen(true);
      collapseTimer = setTimeout(() => setOpen(false), AUTO_PEEK_OPEN_MS);
    }, AUTO_PEEK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (collapseTimer) clearTimeout(collapseTimer);
    };
  }, [autoPeekEnabled]);

  const handleToggle = () => {
    setOpen((prev) => {
      if (prev) setAutoPeekEnabled(false);
      return !prev;
    });
  };

  const handleSelect = (id: PrestadorSection) => {
    setOpen(false);
    onChange(id);
  };

  return (
    <>
      <style>{css}</style>

      <div
        ref={containerRef}
        className="fixed z-50"
        style={{ bottom: '2rem', left: '50%', transform: 'translateX(-50%)', overflow: 'visible' }}
      >
        {/* Outer pulse ring */}
        <div
          className="absolute radial-ring-pulse rounded-full pointer-events-none"
          style={{
            width: trigger.ring,
            height: trigger.ring,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: '1.5px solid rgba(240,210,140,0.45)',
          }}
        />

        {/* Títulos — posição no arco, fora dos ícones */}
        {open &&
          ITEMS.map((item, i) => {
            const { x: lx, y: ly } = deg2xy(item.angle, LABEL_RADIUS);
            const isActive = active === item.id;
            const delay = i * 45 + 90;

            return (
              <span
                key={`label-${item.id}`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  '--lx': `${lx}px`,
                  '--ly': `${ly}px`,
                  color: isActive ? item.color : 'rgba(255,255,255,0.85)',
                  fontSize: 9,
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.78)',
                  border: `1px solid ${isActive ? item.color.replace('0.9', '0.45') : 'rgba(255,255,255,0.14)'}`,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.55)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                  pointerEvents: 'none',
                  zIndex: 3,
                  opacity: 0,
                  animation: `radial-label-in 0.32s cubic-bezier(.34,1.2,.64,1) ${delay}ms forwards`,
                } as React.CSSProperties}
              >
                {item.label}
              </span>
            );
          })}

        {/* Ícones do menu */}
        {ITEMS.map((item, i) => {
          const { x, y } = deg2xy(item.angle, ICON_RADIUS);
          const Icon = item.icon;
          const isActive = active === item.id;
          const delay = i * 45;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-label={item.label}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: ICON_SIZE,
                height: ICON_SIZE,
                marginTop: -ICON_SIZE / 2,
                marginLeft: -ICON_SIZE / 2,
                borderRadius: '50%',
                border: `1px solid ${isActive ? item.color : 'rgba(255,255,255,0.12)'}`,
                background: isActive
                  ? item.color.replace('0.9', '0.15')
                  : 'rgba(8,8,8,0.85)',
                backdropFilter: 'blur(16px)',
                color: isActive ? item.color : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.2s, background 0.2s, color 0.2s',
                pointerEvents: open ? 'auto' : 'none',
                zIndex: 2,
                ...(open
                  ? {
                      '--tx': `${x}px`,
                      '--ty': `${y}px`,
                      animation: `radial-item-pop 0.38s cubic-bezier(.34,1.56,.64,1) ${delay}ms forwards`,
                      opacity: 0,
                    }
                  : {
                      '--tx': '0px',
                      '--ty': '0px',
                      opacity: 0,
                      transform: 'translate(0, 0) scale(0.3)',
                    }),
              } as React.CSSProperties}
            >
              <Icon size={16} />
            </button>
          );
        })}

        {/* Central trigger */}
        <button
          onClick={handleToggle}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          className={open ? undefined : 'radial-trigger-idle'}
          style={{
            position: 'relative',
            zIndex: 1,
            width: trigger.button,
            height: trigger.button,
            borderRadius: '50%',
            background: open
              ? 'rgba(240,210,140,0.28)'
              : 'rgba(12,10,6,0.95)',
            border: `2px solid ${open ? 'rgba(240,210,140,0.85)' : 'rgba(240,210,140,0.55)'}`,
            backdropFilter: 'blur(20px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.2s',
            boxShadow: open
              ? '0 0 32px rgba(240,210,140,0.4), 0 6px 28px rgba(0,0,0,0.65)'
              : '0 0 20px rgba(240,210,140,0.22), 0 6px 28px rgba(0,0,0,0.55)',
          }}
        >
          {/* Disc icon (amber centered dot + ring marks) */}
          <svg width={trigger.icon} height={trigger.icon} viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" stroke="rgba(240,210,140,0.65)" strokeWidth="1.1" />
            <circle cx="11" cy="11" r="6"  stroke="rgba(240,210,140,0.45)" strokeWidth="0.85" />
            <circle cx="11" cy="11" r="2.5" fill="rgba(240,210,140,0.95)" />
            {/* Tick marks at 4 quadrants */}
            {[0,90,180,270].map((a) => {
              const r = (a * Math.PI) / 180;
              const x1 = 11 + 7.5 * Math.cos(r), y1 = 11 + 7.5 * Math.sin(r);
              const x2 = 11 + 9.5 * Math.cos(r), y2 = 11 + 9.5 * Math.sin(r);
              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(240,210,140,0.75)" strokeWidth="1.1" strokeLinecap="round" />;
            })}
          </svg>
        </button>

        {/* Label fixo acima do botão */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '100%',
            left: '50%',
            marginBottom: 10,
            opacity: open ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          <span
            className={open ? undefined : 'radial-menu-label-pulse'}
            style={{
              display: 'inline-block',
              fontSize: trigger.label,
              fontWeight: 700,
              color: 'rgba(240,210,140,0.95)',
              fontFamily: 'Raleway, sans-serif',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              transform: 'translateX(-50%)',
            }}
          >
            Menu
          </span>
        </div>
      </div>
    </>
  );
}
