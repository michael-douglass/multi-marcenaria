import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import {
  getNavBadge,
  getVisibleNavMainItems,
  sectionFromPath,
  type NavMainItem,
} from '@/lib/app-navigation'
import { distributeAngles } from '@/lib/utils'
import { cn } from '@/lib/utils'

const MAIN_R = 155
const MAIN_SZ = 62
const SUB_R = 90
const SUB_SZ = 50
const CENTER_SZ = 76

const NAV_RADIAL_STYLES = `
@keyframes nav-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nav-center-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes nav-slot-burst {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes nav-ring-breathe {
  0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.55; transform: translate(-50%, -50%) scale(1.03); }
}
@keyframes nav-trigger-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(240,210,140,0.35); }
  50% { box-shadow: 0 0 0 10px rgba(240,210,140,0); }
}
@keyframes nav-glow-breathe {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.75; }
}
.nav-backdrop-in { animation: nav-backdrop-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.nav-center-in { animation: nav-center-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.nav-slot-burst { animation: nav-slot-burst 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; animation-delay: calc(var(--i, 0) * 0.04s); }
.nav-ring-breathe { animation: nav-ring-breathe 4s ease-in-out infinite; }
.nav-trigger-pulse { animation: nav-trigger-pulse 2.8s ease-in-out infinite; }
.nav-glow-breathe { animation: nav-glow-breathe 3s ease-in-out infinite; }
`

function CompassRose() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
      <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(240,210,140,0.35)" strokeWidth="0.75" />
      <circle cx="24" cy="24" r="8" fill="none" stroke="rgba(240,210,140,0.5)" strokeWidth="0.75" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const rad = (deg * Math.PI) / 180
        const x2 = 24 + Math.cos(rad) * 18
        const y2 = 24 + Math.sin(rad) * 18
        return (
          <line
            key={deg}
            x1="24"
            y1="24"
            x2={x2}
            y2={y2}
            stroke="rgba(240,210,140,0.45)"
            strokeWidth="0.75"
          />
        )
      })}
      <circle cx="24" cy="24" r="2.5" fill="rgba(240,210,140,0.85)" />
    </svg>
  )
}

interface RadialSlotProps {
  angle: number
  radius: number
  size: number
  color: string
  label: string
  icon: LucideIcon
  isActive: boolean
  index: number
  onClick: () => void
}

function RadialSlot({
  angle,
  radius,
  size,
  color,
  label,
  icon: Icon,
  isActive,
  index,
  onClick,
}: RadialSlotProps) {
  const rad = (angle * Math.PI) / 180
  const cx = Math.cos(rad) * radius
  const cy = -Math.sin(rad) * radius

  return (
    <button
      type="button"
      className="nav-slot-burst absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center outline-none"
      style={
        {
          left: `calc(50% + ${cx}px)`,
          top: `calc(50% + ${cy}px)`,
          '--i': index,
        } as React.CSSProperties
      }
      onClick={onClick}
      aria-label={label}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full border-2 transition-all duration-200',
          'hover:scale-[1.14]',
          isActive ? 'scale-105' : '',
        )}
        style={{
          width: size,
          height: size,
          borderColor: isActive ? color : `${color.replace(/[\d.]+\)$/, '0.55)')}`,
          background: isActive
            ? `radial-gradient(circle at 30% 30%, ${color.replace(/[\d.]+\)$/, '0.35)')}, rgba(10,4,2,0.92))`
            : 'rgba(10,4,2,0.88)',
          boxShadow: isActive ? `0 0 24px ${color.replace(/[\d.]+\)$/, '0.45)')}` : undefined,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </span>
      <span
        className="mt-1.5 max-w-[72px] truncate text-center font-raleway text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: 'rgba(244,228,214,0.85)' }}
      >
        {label}
      </span>
    </button>
  )
}

interface AppNavRadialMenuProps {
  pendingOrders: number
}

export function AppNavRadialMenu({ pendingOrders }: AppNavRadialMenuProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { roles } = useApp()
  const [open, setOpen] = useState(false)
  const [submenuParent, setSubmenuParent] = useState<NavMainItem | null>(null)

  const activeSection = sectionFromPath(location.pathname)
  const items = getVisibleNavMainItems({ roles, pendingOrders })

  const closeAll = useCallback(() => {
    setOpen(false)
    setSubmenuParent(null)
  }, [])

  const goTo = useCallback(
    (url: string) => {
      navigate(url)
      closeAll()
    },
    [navigate, closeAll],
  )

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (submenuParent) {
        setSubmenuParent(null)
        return
      }
      if (open) closeAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submenuParent, closeAll])

  const displayItems = submenuParent?.children?.length
    ? submenuParent.children.map(c => ({
        id: c.id,
        title: c.title,
        url: c.url,
        icon: c.icon,
        radialColor: c.radialColor,
      }))
    : items

  const radius = submenuParent ? SUB_R : MAIN_R
  const size = submenuParent ? SUB_SZ : MAIN_SZ
  const angles = distributeAngles(displayItems.length, 90, true)

  const overlay = open
    ? createPortal(
        <div
          className="nav-backdrop-in fixed inset-0 z-[200]"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação radial"
        >
          <style>{NAV_RADIAL_STYLES}</style>
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(4,2,1,0.93)] backdrop-blur-[26px]"
            onClick={closeAll}
            aria-label="Fechar menu"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          <div
            className="nav-glow-breathe pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[120vh] w-[120vw] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(240,210,140,0.18) 0%, transparent 70%)',
            }}
          />

          <div
            className="nav-center-in pointer-events-none absolute"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="nav-ring-breathe absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(240,210,140,0.12)]"
            />
            <div
              className="nav-ring-breathe absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(240,210,140,0.08)]"
              style={{ animationDelay: '0.5s' }}
            />

            <div className="pointer-events-auto relative h-[340px] w-[340px]">
              {displayItems.map((item, i) => {
                const navItem = submenuParent
                  ? null
                  : items.find(n => n.id === item.id)
                const Icon = item.icon ?? navItem?.icon ?? items[0]?.icon
                if (!Icon) return null
                const color = item.radialColor ?? navItem?.radialColor ?? 'rgba(240,210,140,0.92)'
                const hasChildren =
                  !submenuParent && !!navItem?.children && navItem.children.length > 0

                return (
                  <RadialSlot
                    key={item.id}
                    angle={angles[i]}
                    radius={radius}
                    size={size}
                    color={color}
                    label={item.title}
                    icon={Icon}
                    isActive={activeSection === item.id}
                    index={i}
                    onClick={() => {
                      if (hasChildren && navItem) {
                        setSubmenuParent(navItem)
                        return
                      }
                      goTo(item.url)
                    }}
                  />
                )
              })}

              <button
                type="button"
                className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-[rgba(240,210,140,0.5)] bg-[rgba(10,4,2,0.95)] transition-transform hover:scale-105"
                style={{ width: CENTER_SZ, height: CENTER_SZ }}
                onClick={() => {
                  if (submenuParent) setSubmenuParent(null)
                  else closeAll()
                }}
                aria-label={submenuParent ? 'Voltar' : 'Fechar'}
              >
                {submenuParent ? (
                  <span className="text-lg text-[#f5e0a8]">←</span>
                ) : (
                  <X className="h-6 w-6 text-[#f5e0a8]" />
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <style>{NAV_RADIAL_STYLES}</style>
      <div className="fixed bottom-6 right-6 z-[201] flex flex-col items-center gap-1">
        <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[rgba(240,210,140,0.65)]">
          Menu
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full border-2 border-[rgba(240,210,140,0.55)] bg-gradient-to-br from-[rgba(20,8,4,0.98)] to-[rgba(8,3,1,0.98)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all',
            !open && 'nav-trigger-pulse',
            open && 'border-[#f5e0a8] shadow-[0_0_28px_rgba(240,210,140,0.35)]',
          )}
          aria-label="Abrir menu radial"
          aria-expanded={open}
        >
          <CompassRose />
        </button>
      </div>
      {overlay}
    </>
  )
}
