import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface EvolucaoObservacaoProps {
  texto: string
  className?: string
}

/** Texto de observação com expansão quando ultrapassa 3 linhas. */
export function EvolucaoObservacao({ texto, className }: EvolucaoObservacaoProps) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || expanded) return

    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    check()

    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [texto, expanded])

  const canToggle = overflows || expanded

  return (
    <p
      ref={ref}
      role={canToggle ? 'button' : undefined}
      tabIndex={canToggle ? 0 : undefined}
      onClick={() => {
        if (canToggle) setExpanded(prev => !prev)
      }}
      onKeyDown={e => {
        if (!canToggle) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded(prev => !prev)
        }
      }}
      className={cn(
        'text-[0.7rem] leading-snug text-[#d4c4a8] whitespace-pre-wrap break-words transition-colors',
        !expanded && 'line-clamp-3',
        canToggle && 'cursor-pointer hover:text-[#e8d4b0]',
        className,
      )}
      title={
        !expanded && overflows
          ? 'Clique para ver o texto completo'
          : expanded
            ? 'Clique para recolher'
            : undefined
      }
    >
      {texto}
    </p>
  )
}
