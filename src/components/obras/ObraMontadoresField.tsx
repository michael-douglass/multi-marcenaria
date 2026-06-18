import { User } from 'lucide-react'

interface MontadorOption {
  id: string
  nome?: string | null
  email: string
  perfil: string
}

interface ObraMontadoresFieldProps {
  montadores: MontadorOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

/** Seleção de vários montadores — todos verão a obra na agenda/calendário. */
export function ObraMontadoresField({ montadores, selectedIds, onChange }: ObraMontadoresFieldProps) {
  const options = montadores.filter(m => m.perfil === 'montador' || m.perfil === 'montador_admin')

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-[#edd9c4]">Nenhum montador cadastrado.</p>
    )
  }

  return (
    <div className="obra-montadores-field flex flex-col gap-2">
      {options.map(m => {
        const checked = selectedIds.includes(m.id)
        const label = `${m.nome ?? m.email}${m.perfil === 'montador_admin' ? ' (Admin)' : ''}`
        return (
          <label
            key={m.id}
            className={[
              'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
              checked
                ? 'border-[rgba(240,210,140,0.45)] bg-[rgba(240,210,140,0.1)]'
                : 'border-[rgba(240,210,140,0.15)] bg-[rgba(68,46,34,0.45)] hover:border-[rgba(240,210,140,0.28)]',
            ].join(' ')}
          >
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-[#f2d892]"
              checked={checked}
              onChange={() => toggle(m.id)}
            />
            <User size={14} className="shrink-0 text-[#f2d892]" aria-hidden />
            <span className="min-w-0 flex-1 text-sm text-cream">{label}</span>
          </label>
        )
      })}
      <p className="text-[0.65rem] leading-relaxed text-[#edd9c4]">
        Todos os montadores marcados verão esta obra no calendário e na agenda.
      </p>
    </div>
  )
}
