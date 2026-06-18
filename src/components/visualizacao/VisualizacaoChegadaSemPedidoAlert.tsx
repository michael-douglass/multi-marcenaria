import { AlertTriangle } from 'lucide-react'
import { obraPrecisaPedidoMaterial } from '@/lib/obra-pedido-material'
import type { ObraFull } from '@/types'

interface VisualizacaoChegadaSemPedidoAlertProps {
  obras: ObraFull[]
}

/** Aviso em destaque: obras ativas ainda sem pedido de material confirmado. */
export function VisualizacaoChegadaSemPedidoAlert({ obras }: VisualizacaoChegadaSemPedidoAlertProps) {
  const semPedido = obras
    .filter(obraPrecisaPedidoMaterial)
    .sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome))

  if (semPedido.length === 0) return null

  const count = semPedido.length
  const obraLabel = count === 1 ? 'obra sem pedido feito' : 'obras sem pedidos feitos'

  return (
    <div
      className="viz-chegada-sem-pedido"
      role="alert"
      aria-live="polite"
    >
      <div className="viz-chegada-sem-pedido__veil" aria-hidden />
      <div className="viz-chegada-sem-pedido__card">
        <div className="viz-chegada-sem-pedido__glow" aria-hidden />
        <div className="viz-chegada-sem-pedido__icon-wrap">
          <AlertTriangle className="viz-chegada-sem-pedido__icon" aria-hidden />
        </div>
        <p className="viz-chegada-sem-pedido__headline">
          Temos{' '}
          <span className="viz-chegada-sem-pedido__count">{count}</span>
          {' '}
          {obraLabel}:
        </p>
        <ul className="viz-chegada-sem-pedido__list">
          {semPedido.map(obra => (
            <li key={obra.id} className="viz-chegada-sem-pedido__item">
              <span className="viz-chegada-sem-pedido__dot" aria-hidden />
              <span className="viz-chegada-sem-pedido__name">{obra.cliente_nome}</span>
              {obra.lousa ? (
                <span className="viz-chegada-sem-pedido__meta">{obra.lousa}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
