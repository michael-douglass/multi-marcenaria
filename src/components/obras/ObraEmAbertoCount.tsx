import { Layers } from 'lucide-react'

interface ObraEmAbertoCountProps {
  count: number
  compact?: boolean
}

/** Resumo: quantidade de obras ativas (não concluídas nem canceladas). */
export function ObraEmAbertoCount({ count, compact = false }: ObraEmAbertoCountProps) {
  return (
    <div
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-semibold text-[#93c5fd]',
        'border-[rgba(59,130,246,0.38)] bg-[rgba(59,130,246,0.12)]',
        compact ? 'px-2.5 py-1 text-[0.68rem]' : 'px-3 py-2 text-[0.78rem] rounded-lg',
      ].join(' ')}
      role="status"
      title="Obras em aberto (não concluídas nem canceladas)"
    >
      <Layers size={compact ? 14 : 16} className="shrink-0" aria-hidden />
      <span>
        {count} em aberto
      </span>
    </div>
  )
}
