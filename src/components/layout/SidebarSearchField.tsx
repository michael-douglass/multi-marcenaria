import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { SidebarSearchAura } from '@/components/layout/SidebarSearchAura'

interface SidebarSearchFieldProps {
  value: string
  onChange: (value: string) => void
  collapsed: boolean
  onExpand: () => void
  disableAura?: boolean
}

interface FlyoutPos {
  top: number
  left: number
}

export function SidebarSearchField({
  value,
  onChange,
  collapsed,
  onExpand,
  disableAura = false,
}: SidebarSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const flyoutInputRef = useRef<HTMLInputElement>(null)
  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState<FlyoutPos>({ top: 0, left: 0 })

  useEffect(() => {
    if (collapsed || !pendingFocus.current) return
    pendingFocus.current = false
    setFlyoutOpen(false)
    inputRef.current?.focus()
  }, [collapsed])

  useLayoutEffect(() => {
    if (!collapsed || !flyoutOpen || !iconBtnRef.current) return

    const place = () => {
      const rect = iconBtnRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = 280
      const gap = 10
      const left = Math.min(rect.right + gap, window.innerWidth - width - 12)
      setFlyoutPos({
        top: Math.max(8, rect.top),
        left: Math.max(8, left),
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [collapsed, flyoutOpen])

  useEffect(() => {
    if (!flyoutOpen) return
    const id = window.requestAnimationFrame(() => flyoutInputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [flyoutOpen])

  useEffect(() => {
    if (!flyoutOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (flyoutRef.current?.contains(target)) return
      if (iconBtnRef.current?.contains(target)) return
      setFlyoutOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setFlyoutOpen(false)
        if (!value.trim()) onChange('')
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [flyoutOpen, onChange, value])

  const openFlyout = () => {
    setFlyoutOpen(true)
  }

  const handleFlyoutChange = (next: string) => {
    onChange(next)
    if (next.trim()) {
      pendingFocus.current = true
      onExpand()
    }
  }

  if (collapsed) {
    return (
      <>
        <button
          ref={iconBtnRef}
          type="button"
          className="sidebar-search-icon-btn"
          aria-label="Buscar páginas, leads, obras e financeiro"
          aria-expanded={flyoutOpen}
          aria-haspopup="dialog"
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            if (flyoutOpen) {
              setFlyoutOpen(false)
              return
            }
            openFlyout()
          }}
        >
          <Search className="h-4 w-4" />
        </button>

        {flyoutOpen
          ? createPortal(
              <div
                ref={flyoutRef}
                className="sidebar-search-flyout"
                role="dialog"
                aria-label="Busca do menu"
                style={{ top: flyoutPos.top, left: flyoutPos.left }}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              >
                <div className="sidebar-search sidebar-search--flyout">
                  {disableAura ? null : <SidebarSearchAura />}
                  <Search className="sidebar-search-glyph" aria-hidden />
                  <input
                    ref={flyoutInputRef}
                    type="search"
                    value={value}
                    onChange={e => handleFlyoutChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setFlyoutOpen(false)
                        if (!value.trim()) onChange('')
                      }
                      if (e.key === 'Enter' && value.trim()) {
                        e.preventDefault()
                        pendingFocus.current = true
                        onExpand()
                      }
                    }}
                    placeholder="Buscar páginas, leads, obras…"
                    aria-label="Buscar páginas do menu, leads, agenda de obras e financeiro"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {value ? (
                    <button
                      type="button"
                      className="sidebar-search-clear"
                      aria-label="Limpar busca"
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        onChange('')
                        flyoutInputRef.current?.focus()
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <p className="sidebar-search-flyout-hint">Digite para filtrar o menu</p>
              </div>,
              document.body,
            )
          : null}
      </>
    )
  }

  return (
    <div
      className="sidebar-search"
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      {disableAura ? null : <SidebarSearchAura />}
      <Search className="sidebar-search-glyph" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onChange('')
            inputRef.current?.blur()
          }
        }}
        placeholder="Buscar páginas, leads, obras…"
        aria-label="Buscar páginas do menu, leads, agenda de obras e financeiro"
        autoComplete="off"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          className="sidebar-search-clear"
          aria-label="Limpar busca"
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export function SidebarSearchEmpty({ query }: { query: string }) {
  return <p className="sidebar-search-empty">Nada encontrado para “{query.trim()}”.</p>
}
