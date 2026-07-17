import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Cliente, ClienteInput } from '@/types'

/** Ignora maiúsculas, acentos e espaços na comparação. */
export function normalizeClienteBusca(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '')
}

interface ClienteSearchSelectProps {
  clientes: Cliente[]
  value: string
  onChange: (clienteId: string) => void
  /** Cria o cliente e devolve o registro (já incluído na lista pelo hook pai). */
  onCreateCliente?: (input: ClienteInput) => Promise<Cliente>
  placeholder?: string
  disabled?: boolean
}

export function ClienteSearchSelect({
  clientes,
  value,
  onChange,
  onCreateCliente,
  placeholder = 'Buscar cliente…',
  disabled,
}: ClienteSearchSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)

  const selected = useMemo(
    () => clientes.find(c => c.id === value) ?? null,
    [clientes, value],
  )

  useEffect(() => {
    if (selected) setPendingLabel(null)
  }, [selected])

  const displayNome = selected?.nome ?? (value && pendingLabel ? pendingLabel : null)

  const filtered = useMemo(() => {
    const q = normalizeClienteBusca(query)
    if (!q) return clientes
    return clientes.filter(c => normalizeClienteBusca(c.nome).includes(q))
  }, [clientes, query])

  const exactMatch = useMemo(() => {
    const q = normalizeClienteBusca(query)
    if (!q) return false
    return clientes.some(c => normalizeClienteBusca(c.nome) === q)
  }, [clientes, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setCreateMode(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open && !createMode) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open, createMode])

  const pick = (id: string, label?: string) => {
    onChange(id)
    if (label) setPendingLabel(label)
    setOpen(false)
    setQuery('')
    setCreateMode(false)
  }

  const clear = () => {
    onChange('')
    setPendingLabel(null)
    setQuery('')
    setOpen(true)
    setCreateMode(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const startCreate = (nomeInicial = '') => {
    setCreateMode(true)
    setOpen(true)
    setNovoNome(nomeInicial.trim())
    setNovoTelefone('')
    setCreateError(null)
  }

  const handleCreate = async () => {
    if (!onCreateCliente) return
    const nome = novoNome.trim()
    if (!nome) {
      setCreateError('Informe o nome do cliente.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const criado = await onCreateCliente({
        nome,
        telefone: novoTelefone.trim() || undefined,
        origem: 'Manual',
      })
      pick(criado.id, criado.nome)
      setCreateMode(false)
      setNovoNome('')
      setNovoTelefone('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar cliente.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      {!open && displayNome && !createMode ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'glass-input flex min-w-0 flex-1 items-center justify-between gap-2 text-left',
              disabled && 'opacity-60',
            )}
            onClick={() => !disabled && setOpen(true)}
          >
            <span className="truncate text-[#fffaf4]">{displayNome}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#b8957f]" />
          </button>
          {!disabled && (
            <button
              type="button"
              className="rounded-lg border border-[rgba(240,210,140,0.2)] p-2 text-[#b8957f] transition hover:border-[rgba(240,210,140,0.4)] hover:text-[#f2d892]"
              title="Limpar cliente"
              onClick={clear}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : createMode ? (
        <div className="space-y-2 rounded-lg border border-[rgba(240,210,140,0.25)] bg-[rgba(36,16,8,0.55)] p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[#f2d892]">
            Novo cliente
          </p>
          <input
            className="glass-input w-full"
            placeholder="Nome completo *"
            value={novoNome}
            disabled={creating}
            autoFocus
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleCreate()
              }
              if (e.key === 'Escape') {
                setCreateMode(false)
                setOpen(true)
              }
            }}
          />
          <input
            className="glass-input w-full"
            placeholder="Telefone (opcional)"
            value={novoTelefone}
            disabled={creating}
            onChange={e => setNovoTelefone(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleCreate()
              }
            }}
          />
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-gold btn-sm"
              disabled={creating || !novoNome.trim()}
              onClick={() => void handleCreate()}
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? 'Salvando…' : 'Cadastrar e selecionar'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={creating}
              onClick={() => {
                setCreateMode(false)
                setOpen(true)
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b8957f]" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className="glass-input w-full pl-9"
            placeholder={placeholder}
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (!open) setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setOpen(false)
                setQuery('')
              }
              if (e.key === 'Enter' && filtered[0]) {
                e.preventDefault()
                pick(filtered[0].id)
              }
            }}
            autoComplete="off"
          />
        </div>
      )}

      {open && !disabled && !createMode && (
        <ul
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[rgba(240,210,140,0.25)] bg-[rgba(28,16,10,0.98)] py-1 shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#b8957f]">Nenhum cliente encontrado.</li>
          ) : (
            filtered.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.id === value}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition hover:bg-[rgba(240,210,140,0.1)]',
                    c.id === value ? 'text-[#f2d892]' : 'text-[#fffaf4]',
                  )}
                  onClick={() => pick(c.id)}
                >
                  {c.nome}
                </button>
              </li>
            ))
          )}

          {onCreateCliente && (
            <li className="border-t border-[rgba(240,210,140,0.15)]">
              {query.trim() && !exactMatch ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#f2d892] transition hover:bg-[rgba(240,210,140,0.1)]"
                  onClick={() => startCreate(query)}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Criar &quot;{query.trim()}&quot;
                </button>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#f2d892] transition hover:bg-[rgba(240,210,140,0.1)]"
                  onClick={() => startCreate(query)}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Novo cliente
                </button>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
