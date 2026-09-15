import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MIN_CARACTERES_BUSCA_PROJETOS } from '@/lib/projetos-atelie'
import { useProjetosBuscaLeads, type LeadProjeto } from '@/hooks/useLeadProjetos'

type Escopo = 'quadro' | 'todos'

interface ProjetosLeadSearchProps {
  projetos: LeadProjeto[]
  onOpenLead: (leadId: number) => void
  onPuxarLead: (leadId: number) => void
}

export function ProjetosLeadSearch({ projetos, onOpenLead, onPuxarLead }: ProjetosLeadSearchProps) {
  const [escopo, setEscopo] = useState<Escopo>('quadro')
  const [value, setValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320 })
  const boardIds = useMemo(() => new Set(projetos.map((p) => p.lead_id)), [projetos])

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
    return projetos.filter((p) =>
      `${p.lead_nome} ${p.lead_empresa ?? ''} ${p.titular_nome ?? ''}`.toLowerCase().includes(q),
    )
  }, [debounced, escopo, projetos])

  const remoteEnabled = escopo === 'todos' && debounced.trim().length >= MIN_CARACTERES_BUSCA_PROJETOS
  const { data: remote = [], isFetching } = useProjetosBuscaLeads(remoteEnabled ? debounced : '')

  const results =
    escopo === 'quadro'
      ? quadroResults.map((p) => ({ id: p.lead_id, nome: p.lead_nome, extra: p.titular_nome, onBoard: true }))
      : remote.map((lead) => ({
          id: lead.id,
          nome: lead.nome,
          extra: lead.empresa,
          onBoard: boardIds.has(lead.id),
        }))

  const showPanel =
    value.trim().length > 0 &&
    (results.length > 0 || (escopo === 'todos' && debounced.trim().length >= MIN_CARACTERES_BUSCA_PROJETOS))

  return (
    <div ref={wrapRef} className="relative max-w-md">
      <div className="mb-1 flex gap-1 text-[10px]">
        <button
          type="button"
          className={cn(
            'rounded-full px-2 py-0.5',
            escopo === 'quadro' ? 'bg-[#8d5e22]/15 text-[#8d5e22]' : 'text-[#6b5244]',
          )}
          onClick={() => setEscopo('quadro')}
        >
          Neste quadro
        </button>
        <button
          type="button"
          className={cn(
            'rounded-full px-2 py-0.5',
            escopo === 'todos' ? 'bg-sky-700/10 text-sky-800' : 'text-[#6b5244]',
          )}
          onClick={() => setEscopo('todos')}
        >
          Todos os leads
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a7060]" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={escopo === 'quadro' ? 'Buscar neste quadro' : 'Buscar todos os leads'}
          className="h-9 border-[rgba(42,24,18,0.16)] bg-[#fffcf8] pl-9 text-sm text-[#2a1812] shadow-[0_8px_18px_rgba(42,24,18,0.06)] placeholder:text-[#8a7060]"
        />
        {isFetching ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#8a7060]">…</span>
        ) : null}
      </div>
      {typeof document !== 'undefined' && showPanel
        ? createPortal(
            <div
              className="fixed z-[80] max-h-72 overflow-y-auto rounded-xl border border-[#8d5e22]/20 bg-[#fffcf8] p-1 shadow-xl"
              style={{ top: coords.top, left: coords.left, width: Math.max(coords.width, 240) }}
            >
              {results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#8a7060]">Nenhum lead encontrado.</p>
              ) : (
                results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-[#8d5e22]/10"
                    onClick={() => {
                      if (item.onBoard) onOpenLead(item.id)
                      else onPuxarLead(item.id)
                      setValue('')
                    }}
                  >
                    <span className="truncate text-sm text-[#2a1812]">{item.nome}</span>
                    <span className="truncate text-[11px] text-[#8a7060]">
                      {item.onBoard ? 'Neste quadro' : 'Puxar para o ateliê'}
                      {item.extra ? ` · ${item.extra}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
