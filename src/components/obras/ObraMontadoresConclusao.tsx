import { CheckCircle2, CircleDashed } from 'lucide-react'
import type { ObraFull } from '@/types'
import {
  getObraMontadoresConclusao,
  obraFechadaPeloAdministrador,
  type ObraMontadorConclusaoStatus,
} from '@/lib/obra-montadores'

interface ObraMontadoresConclusaoProps {
  obra?: Pick<
    ObraFull,
    | 'montador_id'
    | 'montador_ids'
    | 'montador_nome'
    | 'montador_nomes'
    | 'montadores_execucao'
    | 'status_kanban'
    | 'finalizado_em'
  >
  montadores?: ObraMontadorConclusaoStatus[]
  fechadaPeloAdmin?: boolean
  compact?: boolean
  visible?: boolean
}

/** Quem já marcou conclusão individual e quem ainda está pendente. */
export function ObraMontadoresConclusao({
  obra,
  montadores: montadoresProp,
  fechadaPeloAdmin: fechadaPeloAdminProp,
  compact,
  visible = true,
}: ObraMontadoresConclusaoProps) {
  if (!visible) return null
  if (obra?.status_kanban === 'cancelada') return null

  const montadores = montadoresProp ?? (obra ? getObraMontadoresConclusao(obra) : [])
  if (montadores.length === 0) return null

  const fechadaPeloAdmin = fechadaPeloAdminProp ?? (obra ? obraFechadaPeloAdministrador(obra) : false)
  const concluidos = montadores.filter(m => m.concluiu).length

  return (
    <div
      className={[
        'min-w-0 w-full rounded-md border border-[rgba(240,210,140,0.14)]',
        compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
        'bg-[rgba(10,4,2,0.35)]',
      ].join(' ')}
    >
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <p
          className={[
            'font-semibold uppercase tracking-wide text-[#edd9c4]',
            compact ? 'text-[0.52rem]' : 'text-[0.58rem]',
          ].join(' ')}
        >
          Conclusão montadores
        </p>
        <span
          className={[
            'shrink-0 tabular-nums text-[#f2d892]',
            compact ? 'text-[0.52rem]' : 'text-[0.58rem]',
          ].join(' ')}
        >
          {concluidos}/{montadores.length}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap gap-1">
        {montadores.map(m => (
          <span
            key={m.montador_id}
            className={[
              'inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border font-medium',
              compact ? 'px-1.5 py-0.5 text-[0.52rem]' : 'px-2 py-0.5 text-[0.6rem]',
              m.concluiu
                ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300'
                : 'border-amber-500/35 bg-amber-500/10 text-amber-300',
            ].join(' ')}
            title={
              m.concluiu
                ? `${m.nome} marcou como concluída`
                : `${m.nome} ainda não marcou conclusão`
            }
          >
            {m.concluiu
              ? <CheckCircle2 size={compact ? 9 : 10} className="shrink-0" />
              : <CircleDashed size={compact ? 9 : 10} className="shrink-0" />}
            <span className="truncate min-w-0">{m.nome}</span>
          </span>
        ))}
      </div>

      {fechadaPeloAdmin && (
        <p
          className={[
            'mt-1 text-[#edd9c4]/85 leading-snug',
            compact ? 'text-[0.5rem]' : 'text-[0.58rem]',
          ].join(' ')}
        >
          Obra concluída pelo administrador
        </p>
      )}
    </div>
  )
}
