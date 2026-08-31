import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingCalendarIconProps {
  count: number
  onClick: () => void
  isActive?: boolean
}

export function FloatingCalendarIcon({ count, onClick, isActive = false }: FloatingCalendarIconProps) {
  const hasOpenTasks = count > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-14 w-14 items-center justify-center rounded-full border-2',
        'bg-gradient-to-br from-[rgba(28,12,6,0.98)] to-[rgba(8,3,1,0.98)]',
        'shadow-[0_8px_28px_rgba(0,0,0,0.5)] transition-all duration-300',
        'hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(240,210,140,0.55)]',
        isActive && 'scale-105',
      )}
      style={{
        borderColor: isActive ? '#f5e0a8' : hasOpenTasks ? 'rgba(248,113,113,0.7)' : 'rgba(240,210,140,0.5)',
        boxShadow: isActive
          ? '0 0 28px rgba(240,210,140,0.38)'
          : hasOpenTasks
            ? '0 0 22px rgba(248,113,113,0.28)'
            : undefined,
      }}
      title={
        isActive
          ? 'Fechar Agenda'
          : hasOpenTasks
            ? `${count} ${count > 1 ? 'tarefas' : 'tarefa'} pendente${count > 1 ? 's' : ''} hoje`
            : 'Abrir Agenda'
      }
      aria-label={isActive ? 'Fechar Agenda' : 'Abrir Agenda'}
      aria-pressed={isActive}
    >
      <Calendar className="h-6 w-6 text-white" />

      {hasOpenTasks ? (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-5 h-5 px-1.5',
            'flex items-center justify-center',
            'bg-[#f5e0a8] text-[#3a1408]',
            'text-xs font-bold rounded-full',
            'border-2 border-[rgba(10,4,2,0.9)]',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  )
}
