import { Shield, User } from 'lucide-react'
import type { ObraFull, StatusKanbanObra } from '@/types'
import { getObraMontadorNomes } from '@/lib/obra-montadores'
import { ObraMontadoresConclusao } from '@/components/obras/ObraMontadoresConclusao'
import { ObraPedidoMaterialBadge } from '@/components/obras/ObraPedidoMaterialBadge'

const STATUS_SHORT: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

interface ObraWeekCardRosterProps {
  obra: ObraFull
  status: StatusKanbanObra
  statusColor: string
  canViewMontadoresConclusao?: boolean
}

/**
 * Bloco da visão semana: andamento + admin + ajudantes.
 * Colunas largas → nomes em chips lado a lado (menos altura, mais legível).
 */
export function ObraWeekCardRoster({
  obra,
  status,
  statusColor,
  canViewMontadoresConclusao = true,
}: ObraWeekCardRosterProps) {
  const adminNome = obra.montador_admin_nome?.trim() || null
  const ajudantes = getObraMontadorNomes(obra)

  return (
    <div className="cal-week-card__roster">
      <div className="cal-week-card__roster-top">
        <span
          className="cal-week-card__status"
          style={{
            backgroundColor: `${statusColor}22`,
            color: statusColor,
            borderColor: `${statusColor}55`,
          }}
          title={STATUS_SHORT[status]}
        >
          {STATUS_SHORT[status]}
        </span>
        <ObraPedidoMaterialBadge obra={obra} compact />
        {adminNome && (
          <span className="cal-week-card__admin-chip" title={`Montador admin: ${adminNome}`}>
            <Shield size={9} aria-hidden />
            <span className="cal-week-card__admin-chip-text">{adminNome}</span>
          </span>
        )}
      </div>

      {ajudantes.length > 0 ? (
        <div
          className="cal-week-card__person-block"
          title={`Ajudantes / montadores: ${ajudantes.join(', ')}`}
        >
          <div className="cal-week-card__person-head">
            <User size={10} className="cal-week-card__person-icon" aria-hidden />
            <span className="cal-week-card__person-label">
              {ajudantes.length === 1 ? 'Montador' : 'Ajudantes'}
            </span>
          </div>
          <ul className="cal-week-card__person-list">
            {ajudantes.map(nome => (
              <li key={nome} className="cal-week-card__person-name">
                {nome}
              </li>
            ))}
          </ul>
        </div>
      ) : !adminNome ? (
        <div className="cal-week-card__person-block cal-week-card__person-block--empty">
          <div className="cal-week-card__person-head">
            <User size={10} className="cal-week-card__person-icon" aria-hidden />
            <span className="cal-week-card__person-label">Montadores</span>
          </div>
          <p className="cal-week-card__person-empty">Sem montadores</p>
        </div>
      ) : null}

      <ObraMontadoresConclusao
        obra={obra}
        dense
        visible={canViewMontadoresConclusao}
      />
    </div>
  )
}
