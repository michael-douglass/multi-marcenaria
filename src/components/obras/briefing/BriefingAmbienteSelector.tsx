import { Plus, X } from 'lucide-react'
import type { BriefingModelo } from '@/types'

interface BriefingAmbienteSelectorProps {
  modelos: BriefingModelo[]
  selectedIds: string[]
  readOnly?: boolean
  loading?: boolean
  error?: string | null
  onChange: (ids: string[]) => void
}

export function BriefingAmbienteSelector({
  modelos,
  selectedIds,
  readOnly = false,
  loading = false,
  error = null,
  onChange,
}: BriefingAmbienteSelectorProps) {
  const ativos = modelos
    .filter(m => m.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
  const selected = ativos.filter(m => selectedIds.includes(m.id))
  const available = ativos.filter(m => !selectedIds.includes(m.id))

  const add = (id: string) => {
    onChange([...selectedIds, id])
  }

  const remove = (id: string) => {
    onChange(selectedIds.filter(s => s !== id))
  }

  if (loading) {
    return (
              <p className="text-[0.72rem] text-[#e4cbb0]/70">
        Carregando ambientes disponíveis...
      </p>
    )
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[0.75rem] text-red-300">
        {error}
      </p>
    )
  }

  if (!readOnly && ativos.length === 0) {
    return (
              <p className="text-[0.72rem] text-[#e4cbb0]/70">
        Nenhum ambiente cadastrado. Configure em Agenda → Configurações → Briefings Pré-Obra.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(m => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(246,220,154,0.45)] bg-[rgba(246,220,154,0.16)] px-3 py-1 text-[0.75rem] text-[#f6dc9a]"
            >
              {m.nome}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="text-[#e4cbb0] hover:text-red-400"
                  aria-label={`Remover ${m.nome}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!readOnly && available.length > 0 && (
        <div className="space-y-2 rounded-lg border border-dashed border-[rgba(246,220,154,0.38)] bg-[rgba(16,8,6,0.4)] p-2.5">
          <p className="text-[0.68rem] font-medium uppercase tracking-wider text-[#f6dc9a]">
            Escolha os ambientes desta obra
          </p>
          <div className="flex flex-wrap gap-2">
            {available.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => add(m.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(246,220,154,0.32)] bg-[rgba(42,24,16,0.65)] px-3 py-1.5 text-[0.75rem] text-[#fff8ee] transition-colors hover:border-[#f6dc9a]/70 hover:bg-[rgba(246,220,154,0.16)]"
              >
                <Plus size={12} className="shrink-0 text-[#f6dc9a]" />
                {m.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {readOnly && selected.length === 0 && (
              <p className="text-[0.72rem] text-[#e4cbb0]/70">
          Nenhum briefing vinculado a esta obra.
        </p>
      )}

      {!readOnly && selected.length === 0 && available.length > 0 && (
              <p className="text-[0.72rem] text-[#e4cbb0]/70">
          Toque nos ambientes acima para vincular o briefing a esta obra.
        </p>
      )}

      {!readOnly && available.length === 0 && selected.length > 0 && (
              <p className="text-[0.72rem] text-[#e4cbb0]/70">
          Todos os ambientes disponíveis já estão vinculados.
        </p>
      )}
    </div>
  )
}
