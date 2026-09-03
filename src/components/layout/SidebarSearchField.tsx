import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { SidebarSearchAura } from '@/components/layout/SidebarSearchAura'
import { cn } from '@/lib/utils'

interface SidebarSearchFieldProps {
  value: string
  onChange: (value: string) => void
  collapsed: boolean
  onExpand: () => void
  disableAura?: boolean
  /** Menu lateral em Sheet (celular): sempre campo cheio, nunca flyout de ícone. */
  mobileSheet?: boolean
}

interface FlyoutPos {
  top: number
  left: number
  width: number
  mode: 'dock' | 'sheet'
}

export function SidebarSearchField({
  value,
  onChange,
  collapsed,
  onExpand,
  disableAura = false,
  mobileSheet = false,
}: SidebarSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const flyoutInputRef = useRef<HTMLInputElement>(null)
  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState<FlyoutPos>({
    top: 0,
    left: 0,
    width: 280,
    mode: 'dock',
  })

  // No Sheet mobile o campo deve ser sempre expandido (o menu já está aberto).
  const showCollapsed = collapsed && !mobileSheet

  useEffect(() => {
    if (showCollapsed || !pendingFocus.current) return
    pendingFocus.current = false
    setFlyoutOpen(false)
    inputRef.current?.focus()
  }, [showCollapsed])

  useLayoutEffect(() => {
    if (!showCollapsed || !flyoutOpen || !iconBtnRef.current) return

    const place = () => {
      const rect = iconBtnRef.current?.getBoundingClientRect()
      if (!rect) return

      const narrow = window.innerWidth < 768
      if (narrow) {
        const side = 12
        const width = Math.min(window.innerWidth - side * 2, 420)
        setFlyoutPos({
          top: Math.max(
            12,
            Math.min(rect.bottom + 8, window.innerHeight - 140),
          ),
          left: Math.max(side, Math.round((window.innerWidth - width) / 2)),
          width,
          mode: 'sheet',
        })
        return
      }

      const width = 280
      const gap = 10
      const left = Math.min(rect.right + gap, window.innerWidth - width - 12)
      setFlyoutPos({
        top: Math.max(8, rect.top),
        left: Math.max(8, left),
        width,
        mode: 'dock',
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [showCollapsed, flyoutOpen])

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

  if (showCollapsed) {
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
              <>
                {flyoutPos.mode === 'sheet' ? (
                  <button
                    type="button"
                    className="sidebar-search-flyout-scrim"
                    aria-label="Fechar busca"
                    onClick={() => setFlyoutOpen(false)}
                  />
                ) : null}
                <div
                  ref={flyoutRef}
                  className={cn(
                    'sidebar-search-flyout',
                    flyoutPos.mode === 'sheet' && 'sidebar-search-flyout--sheet',
                  )}
                  role="dialog"
                  aria-label="Busca do menu"
                  style={{
                    top: flyoutPos.top,
                    left: flyoutPos.left,
                    width: flyoutPos.width,
                  }}
                  onClick={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                >
                  <div className="sidebar-search sidebar-search--flyout">
                    {disableAura ? null : <SidebarSearchAura />}
                    <Search className="sidebar-search-glyph" aria-hidden />
                    <input
                      ref={flyoutInputRef}
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
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
                </div>
              </>,
              document.body,
            )
          : null}
      </>
    )
  }

  return (
    <div
      className={cn('sidebar-search', mobileSheet && 'sidebar-search--mobile')}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      {disableAura ? null : <SidebarSearchAura />}
      <Search className="sidebar-search-glyph" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
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
