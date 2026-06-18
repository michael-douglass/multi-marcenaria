import { AlertTriangle } from 'lucide-react'
import { obraPrecisaPedidoMaterial } from '@/lib/obra-pedido-material'
import type { ObraFull } from '@/types'

interface VisualizacaoChegadaSemPedidoAlertProps {
  obras: ObraFull[]
}

/** Aviso compacto no cabeçalho: obras ativas sem pedido de material confirmado. */
export function VisualizacaoChegadaSemPedidoAlert({ obras }: VisualizacaoChegadaSemPedidoAlertProps) {
  const semPedido = obras
    .filter(obraPrecisaPedidoMaterial)
    .sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome))

  if (semPedido.length === 0) return null

  const count = semPedido.length
  const obraLabel = count === 1 ? 'obra sem pedido feito' : 'obras sem pedidos feitos'
  const nomesResumo = semPedido.map(o => o.cliente_nome).join(', ')
  const marqueeDuration = Math.max(14, Math.round(nomesResumo.length * 0.32))

  return (
    <div
      className="viz-chegada-sem-pedido"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="viz-chegada-sem-pedido__icon" aria-hidden />
      <div className="viz-chegada-sem-pedido__copy min-w-0">
        <p className="viz-chegada-sem-pedido__headline">
          Temos{' '}
          <span className="viz-chegada-sem-pedido__count">{count}</span>
          {' '}
          {obraLabel}:
        </p>
        <div
          className="viz-chegada-sem-pedido__marquee"
          aria-label={nomesResumo}
        >
          <div
            className="viz-chegada-sem-pedido__marquee-track"
            style={{ ['--viz-marquee-duration' as string]: `${marqueeDuration}s` }}
          >
            <span className="viz-chegada-sem-pedido__names">{nomesResumo}</span>
            <span className="viz-chegada-sem-pedido__names" aria-hidden>
              {nomesResumo}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
