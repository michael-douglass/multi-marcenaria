import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { SidebarSearchAura } from '@/components/layout/SidebarSearchAura'

interface SidebarSearchFieldProps {
  value: string
  onChange: (value: string) => void
  collapsed: boolean
  onExpand: () => void
  disableAura?: boolean
}

export function SidebarSearchField({
  value,
  onChange,
  collapsed,
  onExpand,
  disableAura = false,
}: SidebarSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingFocus = useRef(false)

  useEffect(() => {
    if (collapsed || !pendingFocus.current) return
    pendingFocus.current = false
    inputRef.current?.focus()
  }, [collapsed])

  if (collapsed) {
    return (
      <button
        type="button"
        className="sidebar-search-icon-btn"
        aria-label="Buscar páginas ou leads"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          pendingFocus.current = true
          onExpand()
        }}
      >
        <Search className="h-4 w-4" />
      </button>
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
        placeholder="Buscar páginas ou leads…"
        aria-label="Buscar páginas do menu, nome ou telefone do lead"
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
  return <p className="sidebar-search-empty">Nenhuma página ou lead para “{query.trim()}”.</p>
}

