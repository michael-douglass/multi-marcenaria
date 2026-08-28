import { useMemo, useState } from 'react'
import { correspondeBuscaFlexivel } from '@/lib/markup-busca'
import type { EventoCatalogoItem } from '@/lib/evento-types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface EventoItemNomeAutocompleteProps {
  value: string
  catalogo: EventoCatalogoItem[]
  onChange: (value: string) => void
  onPick: (item: EventoCatalogoItem) => void
}

export function EventoItemNomeAutocomplete({
  value,
  catalogo,
  onChange,
  onPick,
}: EventoItemNomeAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const sugestoes = useMemo(() => {
    const termo = value.trim()
    if (termo.length < 1) return catalogo.slice(0, 8)
    return catalogo.filter((item) => correspondeBuscaFlexivel(item.nome, termo)).slice(0, 8)
  }, [catalogo, value])

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Nome do item"
        autoComplete="off"
      />
      {open && sugestoes.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gold-border bg-mahogany-elevated shadow-xl">
          {sugestoes.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gold/10',
                )}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onPick(item)
                  setOpen(false)
                }}
              >
                <span>{item.nome}</span>
                <span className="text-xs text-gold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
