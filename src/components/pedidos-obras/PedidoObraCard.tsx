import type { MouseEvent, PointerEvent } from 'react'
import { ArrowRight, Camera, Package } from 'lucide-react'
import { ObraPedidoMaterialBadge } from '@/components/obras/ObraPedidoMaterialBadge'
import {
  itemLabel,
  linhasAtivas,
  totalMarkupDoCard,
  totalPrecoFeito,
  type PedidoColunaId,
  type PedidoObraCardModel,
} from '@/lib/pedidos-obras'
import { fmtCur } from '@/lib/utils'
import { PedidoNfDropzone } from './PedidoNfDropzone'
import type { PedidoAnexo, PendingContaPagarAnexo } from '@/types'

interface PedidoObraCardProps {
  card: PedidoObraCardModel
  canApprove: boolean
  canEdit: boolean
  pendingAnexos?: PendingContaPagarAnexo[]
  savedPreviewUrls?: Record<string, string>
  onPendingAnexosChange?: (next: PendingContaPagarAnexo[]) => void
  onRemoveSavedAnexo?: (anexo: PedidoAnexo) => void
  onOpenAnexo?: (anexo: PedidoAnexo) => void
  onFazerPedido: () => void
  onAprovar: () => void
  onRecusar?: () => void
  onEditarMarkup?: () => void
  onOpenDetalhe: () => void
}

const COL_ACTIONS: Record<PedidoColunaId, string> = {
  a_fazer: 'Fazer pedido',
  preco_feito: 'Aprovar compra',
  enviado: 'Ver em Contas a Pagar',
}

export function PedidoObraCard({
  card,
  canApprove,
  canEdit,
  pendingAnexos = [],
  savedPreviewUrls,
  onPendingAnexosChange,
  onRemoveSavedAnexo,
  onOpenAnexo,
  onFazerPedido,
  onAprovar,
  onRecusar,
  onEditarMarkup,
  onOpenDetalhe,
}: PedidoObraCardProps) {
  const linhas = linhasAtivas(card.markup?.linhas ?? [])
  const totalMarkup = totalMarkupDoCard(card)
  const totalFeito = totalPrecoFeito(card.pedido)
  const fornecedor = card.pedido?.movelaria_fornecedores?.nome

  const stopOpen = (e: MouseEvent | PointerEvent) => {
    e.stopPropagation()
  }

  return (
    <article
      className="glass-card flex w-full min-w-0 cursor-pointer flex-col gap-2 overflow-hidden p-3 text-sm transition-colors hover:border-[#f2d892]/40"
      onClick={onOpenDetalhe}
      aria-label={`Abrir anotações e fotos de ${card.obra.cliente_nome}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-[#fffaf4]">{card.obra.cliente_nome}</h3>
          {card.obra.tipo_obra_nome && (
            <p className="truncate text-[0.65rem] text-[#c4a882]">{card.obra.tipo_obra_nome}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Camera size={13} className="text-[#f2d892]/80" aria-hidden />
          {card.coluna !== 'a_fazer' && (
            <ObraPedidoMaterialBadge obra={{ pedido_material_feito: true }} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-display text-[1.05rem] text-[#f2d892]">{fmtCur(totalMarkup)}</span>
        <span className="text-[0.62rem] uppercase tracking-wide text-[#c4a882]">custo markup</span>
        {card.coluna !== 'a_fazer' && (
          <>
            <span className="font-display text-[1.05rem] text-[#4ade80]">{fmtCur(totalFeito)}</span>
            <span className="text-[0.62rem] uppercase tracking-wide text-[#86efac]">preço feito</span>
          </>
        )}
      </div>

      {fornecedor && (
        <p className="truncate text-[0.7rem] text-[#edd9c4]">Fornecedor: {fornecedor}</p>
      )}

      <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-0.5">
        {linhas.length === 0 && (
          <li className="flex items-center gap-1.5 text-[0.7rem] text-[#c4a882]">
            <Package size={12} />
            Sem itens de material neste markup
          </li>
        )}
        {linhas.map((linha, idx) => (
          <li
            key={`${linha.produto_id ?? linha.descricao}-${idx}`}
            className="flex min-w-0 items-start justify-between gap-2 rounded bg-[rgba(240,210,140,0.06)] px-2 py-1"
          >
            <span className="min-w-0 truncate text-[0.68rem] text-[#edd9c4]">
              {itemLabel(linha)}
              <span className="ml-1 text-[#c4a882]">
                {linha.quantidade} {linha.unidade}
              </span>
            </span>
            <span className="shrink-0 text-[0.68rem] font-semibold text-[#f2d892]">
              {fmtCur(linha.valor_total)}
            </span>
          </li>
        ))}
      </ul>

      {card.coluna === 'preco_feito' && onPendingAnexosChange && (
        <div onClick={stopOpen} onMouseDown={stopOpen} onPointerDown={stopOpen}>
          <PedidoNfDropzone
            pending={pendingAnexos}
            saved={card.pedido?.movelaria_pedidos_anexos}
            savedPreviewUrls={savedPreviewUrls}
            onPendingChange={onPendingAnexosChange}
            onRemoveSaved={onRemoveSavedAnexo}
            onOpenSaved={onOpenAnexo}
          />
        </div>
      )}

      {card.coluna === 'enviado' && (card.pedido?.movelaria_pedidos_anexos?.length ?? 0) > 0 && (
        <p className="text-[0.65rem] text-[#86efac]">
          {card.pedido?.movelaria_pedidos_anexos?.length} nota(s) enviada(s) ao financeiro
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-1.5" onClick={stopOpen} onMouseDown={stopOpen}>
        {card.coluna === 'a_fazer' && (
          <button
            type="button"
            className="btn btn-gold btn-sm inline-flex items-center gap-1"
            onClick={e => {
              e.stopPropagation()
              onFazerPedido()
            }}
          >
            {COL_ACTIONS.a_fazer}
            <ArrowRight size={12} />
          </button>
        )}
        {card.coluna === 'preco_feito' && canApprove && (
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={e => {
              e.stopPropagation()
              onAprovar()
            }}
          >
            {COL_ACTIONS.preco_feito}
          </button>
        )}
        {card.coluna === 'preco_feito' && canEdit && onRecusar && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={e => {
              e.stopPropagation()
              onRecusar()
            }}
          >
            Recusar
          </button>
        )}
        {card.coluna === 'enviado' && (
          <a
            href="/contas-pagar"
            className="btn btn-outline btn-sm"
            onClick={e => e.stopPropagation()}
          >
            {COL_ACTIONS.enviado}
          </a>
        )}
        {canEdit && onEditarMarkup && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={e => {
              e.stopPropagation()
              onEditarMarkup()
            }}
          >
            Itens / markup
          </button>
        )}
      </div>
    </article>
  )
}
