import { Sun } from 'lucide-react'

interface VisualizacaoObrasDoDiaButtonProps {
  onClick: () => void
  count?: number
  compact?: boolean
}

/** Abre o painel Obras do dia (hoje + amanhã) em tela cheia. */
export function VisualizacaoObrasDoDiaButton({
  onClick,
  count,
  compact = false,
}: VisualizacaoObrasDoDiaButtonProps) {
  return (
    <button
      type="button"
      className="viz-obras-dia-btn"
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      title="Obras de hoje e amanhã em tela cheia"
      aria-label="Abrir obras do dia em tela cheia"
    >
      <Sun size={14} strokeWidth={2.25} aria-hidden />
      {!compact ? <span>Obras do dia</span> : null}
      {count !== undefined && count > 0 ? (
        <span className="viz-obras-dia-btn__count">{count}</span>
      ) : null}
    </button>
  )
}
