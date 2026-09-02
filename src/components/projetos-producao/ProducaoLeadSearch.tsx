import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MIN_CARACTERES_BUSCA_PRODUCAO } from '@/lib/projetos-producao'
import { useProducaoBuscaLeads, type ObraProducao } from '@/hooks/useObraProducao'

type Escopo = 'quadro' | 'todos'

interface ProducaoLeadSearchProps {
  cards: ObraProducao[]
  onOpenLead: (leadId: number) => void
}

export function ProducaoLeadSearch({ cards, onOpenLead }: ProducaoLeadSearchProps) {
  const [escopo, setEscopo] = useState<Escopo>('quadro')
  const [value, setValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320 })
  const boardIds = useMemo(() => new Set(cards.map((c) => c.lead_id)), [cards])

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), 300)
    return () => window.clearTimeout(id)
  }, [value])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const box = el.getBoundingClientRect()
    setCoords({ top: box.bottom + 4, left: box.left, width: box.width })
  }, [value, escopo, debounced])

  const quadroResults = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (escopo !== 'quadro' || q.length < 1) return []
    return cards.filter((c) =>
      `${c.lead_nome} ${c.lead_empresa ?? ''} ${c.titular_nome ?? ''} ${c.obra_cliente_nome ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [debounced, escopo, cards])

  const remoteEnabled = escopo === 'todos' && debounced.trim().length >= MIN_CARACTERES_BUSCA_PRODUCAO
  const { data: remote = [], isFetching } = useProducaoBuscaLeads(remoteEnabled ? debounced : '')

  const results =
    escopo === 'quadro'
      ? quadroResults.map((c) => ({
          id: c.lead_id,
          nome: c.lead_nome,
          extra: c.titular_nome,
          onBoard: true,
        }))
      : remote.map((lead) => ({
          id: lead.id,
          nome: lead.nome,
          extra: lead.empresa,
          onBoard: boardIds.has(lead.id),
        }))

  const showPanel =
    value.trim().length > 0 &&
    (results.length > 0 || (escopo === 'todos' && debounced.trim().length >= MIN_CARACTERES_BUSCA_PRODUCAO))

  return (
    <div ref={wrapRef} className="relative max-w-md">
      <div className="mb-1.5 flex gap-1 text-[11px]">
        <button
          type="button"
          className={cn(
            'rounded-full px-2.5 py-0.5 transition-colors',
            escopo === 'quadro'
              ? 'bg-[#2d8c78]/12 font-medium text-[#1f5f52]'
              : 'text-[#6b7c76] hover:bg-[#2a3a36]/5',
          )}
          onClick={() => setEscopo('quadro')}
        >
          Neste quadro
        </button>
        <button
          type="button"
          className={cn(
            'rounded-full px-2.5 py-0.5 transition-colors',
            escopo === 'todos'
              ? 'bg-[#c9a35a]/18 font-medium text-[#7a5a1e]'
              : 'text-[#6b7c76] hover:bg-[#2a3a36]/5',
          )}
          onClick={() => setEscopo('todos')}
        >
          Todos os leads
        </button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#2d8c78]/80" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={escopo === 'quadro' ? 'Buscar no quadro…' : 'Buscar todos os leads…'}
          className="h-9 border-[#2a3a36]/15 bg-white/80 pl-8 text-sm text-[#24302c] shadow-sm placeholder:text-[#6b7c76]/70"
        />
      </div>
      {showPanel
        ? createPortal(
            <ul
              className="fixed z-[80] max-h-64 overflow-y-auto rounded-xl border border-[#2a3a36]/12 bg-[#fffcf7] shadow-xl"
              style={{ top: coords.top, left: coords.left, width: coords.width }}
            >
              {isFetching && escopo === 'todos' ? (
                <li className="px-3 py-2 text-xs text-[#6b7c76]">Buscando…</li>
              ) : null}
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#e8f6f1]"
                    onClick={() => {
                      onOpenLead(item.id)
                      setValue('')
                    }}
                  >
                    <span className="min-w-0 truncate font-medium text-[#1c2824]">{item.nome}</span>
                    <span className="shrink-0 text-[10px] text-[#6b7c76]">
                      {item.onBoard ? 'no quadro' : item.extra ?? 'lead'}
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 && !isFetching ? (
                <li className="px-3 py-2 text-xs text-[#6b7c76]">Nenhum resultado</li>
              ) : null}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
