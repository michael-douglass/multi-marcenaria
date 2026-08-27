import { useMemo, useState } from 'react'
import { Camera, FileText, Folder, Loader2, MessageSquareText, Package } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { ObraLeadMidiasStrip } from '@/components/obras/ObraLeadMidiasStrip'
import { PedidoItensAPedirEditor } from '@/components/pedidos-obras/PedidoItensAPedirEditor'
import { EvolucaoObservacao } from '@/components/obras/EvolucaoObservacao'
import { useLeadMidiasPorObras } from '@/hooks/useLeadMidiasPorObras'
import { useObraEvolucao } from '@/hooks/useObraEvolucao'
import { getObraLeadMidias, leadMidiasTemPastas } from '@/lib/obra-lead-midias'
import {
  evolucaoLightboxPages,
  evolucaoThumbUrl,
  groupEvolucaoPorDia,
} from '@/lib/obra-evolucao'
import {
  itemLabel,
  linhasAtivas,
  totalMarkupDoCard,
  totalPrecoFeito,
  type PedidoObraCardModel,
} from '@/lib/pedidos-obras'
import { draftsFromMarkup, type PedidoItemDraft } from '@/hooks/usePedidosObras'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { EvolucaoItemComUrl } from '@/lib/obra-evolucao'
import type { MarkupLinhaProduto, PedidoItem } from '@/types'
import type { useMarkupCatalogo } from '@/hooks/useMarkupCatalogo'

interface PedidoObraDetalheModalProps {
  open: boolean
  card: PedidoObraCardModel | null
  onClose: () => void
  canEditItens?: boolean
  catalogo?: ReturnType<typeof useMarkupCatalogo>
  savingItens?: boolean
  onSalvarMarkup?: (linhas: MarkupLinhaProduto[]) => Promise<void>
  onEnviarPedido?: (itens: PedidoItemDraft[]) => Promise<void>
}

export function PedidoObraDetalheModal({
  open,
  card,
  onClose,
  canEditItens = false,
  catalogo,
  savingItens = false,
  onSalvarMarkup,
  onEnviarPedido,
}: PedidoObraDetalheModalProps) {
  const obra = card?.obra ?? null
  const { midiasByLead, loading: loadingLeadMidias } = useLeadMidiasPorObras(
    open && obra ? [obra] : [],
    open && !!obra,
  )
  const evolHook = useObraEvolucao(open && obra ? obra.id : null)
  const [evolLightbox, setEvolLightbox] = useState<{
    url: string
    pages: string[]
    title: string
    description?: string | null
    kind: 'image' | 'pdf' | 'video'
  } | null>(null)

  const leadMidias = obra ? getObraLeadMidias(obra, midiasByLead) : []
  const temPastas = leadMidiasTemPastas(leadMidias)
  const diasEvolucao = useMemo(
    () => groupEvolucaoPorDia(evolHook.data, obra?.iniciado_em),
    [evolHook.data, obra?.iniciado_em],
  )
  const linhasMarkup = useMemo(
    () => linhasAtivas(card?.markup?.linhas ?? []),
    [card],
  )
  const itensAPedir = useMemo<(PedidoItem | PedidoItemDraft)[]>(() => {
    if (!card) return []
    const doPedido = card.pedido?.movelaria_pedidos_itens ?? []
    if (doPedido.length > 0) return doPedido
    return draftsFromMarkup(linhasMarkup)
  }, [card, linhasMarkup])

  if (!obra || !card) return null

  const observacaoCrm = obra.lousa?.trim() ?? ''
  const totalMarkup = totalMarkupDoCard(card)
  const totalPedido = card.pedido ? totalPrecoFeito(card.pedido) : totalMarkup
  const tituloItensPedido = card.coluna === 'a_fazer'
    ? 'Itens a serem pedidos'
    : 'Itens do pedido'
  const podeMontarPedido = card.coluna === 'a_fazer' && canEditItens && !!catalogo && !!onSalvarMarkup && !!onEnviarPedido
  const hintItensPedido = podeMontarPedido
    ? 'Monte a lista, defina o markup e envie para o pedido'
    : card.coluna === 'a_fazer'
      ? 'Materiais do markup que ainda vão para compra'
      : card.pedido?.movelaria_fornecedores?.nome
        ? `Fornecedor: ${card.pedido.movelaria_fornecedores.nome}`
        : 'Já registrados neste pedido'

  return (
    <Modal open={open} onClose={onClose} title="Ficha do lead" wide>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#f2d892] font-display leading-tight">
          {obra.cliente_nome}
        </h2>
        {obra.tipo_obra_nome && (
          <p className="mt-1 text-[0.72rem] text-[#c4a882]">{obra.tipo_obra_nome}</p>
        )}
      </div>

      {obra.descricao?.trim() && (
        <div
          className="mb-5 rounded-lg p-4"
          style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <FileText size={13} className="text-emerald-400" />
            <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-emerald-400 m-0">
              Descrição do projeto
            </p>
          </div>
          <p className="text-sm text-cream leading-relaxed whitespace-pre-wrap">{obra.descricao.trim()}</p>
        </div>
      )}

      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Package size={13} className="text-[#f2d892]" />
            <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#f2d892] m-0">
              Itens do markup
            </p>
          </div>
          <span className="shrink-0 text-[0.78rem] font-semibold text-[#f2d892]">{fmtCur(totalMarkup)}</span>
        </div>
        {card.markup?.titulo && (
          <p className="mb-2 text-[0.68rem] text-[#c4a882]">{card.markup.titulo}</p>
        )}
        <ItensMarkupLista linhas={linhasMarkup} />
      </section>

      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Package size={13} className="text-[#4ade80]" />
              <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#4ade80] m-0">
                {tituloItensPedido}
              </p>
            </div>
            <p className="text-[0.62rem] text-[#c4a882] m-0">{hintItensPedido}</p>
          </div>
          {!podeMontarPedido && (
            <span className="shrink-0 text-[0.78rem] font-semibold text-[#4ade80]">{fmtCur(totalPedido)}</span>
          )}
        </div>
        {podeMontarPedido && catalogo && onSalvarMarkup && onEnviarPedido ? (
          <PedidoItensAPedirEditor
            key={card.obra.id}
            linhasIniciais={card.markup?.linhas ?? []}
            catalogo={catalogo}
            canEdit={canEditItens}
            saving={savingItens}
            onSalvarMarkup={onSalvarMarkup}
            onEnviarPedido={onEnviarPedido}
          />
        ) : (
          <ItensPedidoLista itens={itensAPedir} />
        )}
      </section>

      <section className="mb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquareText size={13} className="text-[#f2d892]" />
          <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#f2d892] m-0">
            Anotações
          </p>
        </div>

        {observacaoCrm ? (
          <div
            className="mb-3 rounded-md p-3"
            style={{ backgroundColor: 'rgba(240,210,140,0.07)', border: '1px solid rgba(240,210,140,0.18)' }}
          >
            <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4] mb-1.5">
              Observação do CRM
            </p>
            <p className="text-sm text-cream leading-relaxed whitespace-pre-wrap">{observacaoCrm}</p>
          </div>
        ) : (
          <p className="mb-3 text-[0.72rem] text-[#c4a882]">Nenhuma observação escrita neste lead.</p>
        )}
      </section>

      <section className="mb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <Folder size={13} className="text-[#f2d892]" />
          <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#f2d892] m-0">
            Pastas e fotos do lead
          </p>
        </div>
        {loadingLeadMidias && leadMidias.length === 0 ? (
          <div className="flex items-center gap-1.5 text-[0.72rem] text-[#c4a882]">
            <Loader2 size={12} className="animate-spin" />
            Carregando fotos do lead…
          </div>
        ) : leadMidias.length === 0 ? (
          <p className="text-[0.72rem] text-[#c4a882]">
            Este lead ainda não tem fotos ou pastas no CRM.
          </p>
        ) : (
          <>
            {!temPastas && (
              <p className="mb-2 text-[0.68rem] text-[#c4a882]">
                As fotos estão soltas — este lead não usa pastas.
              </p>
            )}
            <ObraLeadMidiasStrip
              midias={leadMidias}
              loading={loadingLeadMidias}
              variant="detail"
            />
          </>
        )}
      </section>

      <section>
        <div className="flex items-center gap-1.5 mb-2">
          <Camera size={13} className="text-[#f2d892]" />
          <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-[#f2d892] m-0">
            Fotos tiradas na obra
            {evolHook.data.length > 0 && (
              <span className="ml-2 font-normal normal-case text-[#edd9c4]">
                ({evolHook.data.length})
              </span>
            )}
          </p>
        </div>

        {evolHook.loading ? (
          <div className="flex items-center gap-1.5 py-3 text-[0.72rem] text-[#c4a882]">
            <Loader2 size={12} className="animate-spin" />
            Carregando fotos da obra…
          </div>
        ) : evolHook.data.length === 0 ? (
          <p className="text-[0.72rem] text-[#c4a882]">
            Nenhuma foto de evolução registrada nesta obra.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {diasEvolucao.map(dia => (
              <div key={dia.data} className="flex flex-col gap-2">
                <p className="text-[0.68rem] text-[#edd9c4] m-0">
                  Dia {String(dia.diaNumero).padStart(2, '0')} · {fmtDate(dia.data)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {dia.fotos.map(item => (
                    <EvolucaoPedidoItem
                      key={item.id}
                      item={item}
                      onOpen={setEvolLightbox}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {evolLightbox && (
        <AnexoLightbox
          open
          imageUrl={evolLightbox.url}
          pages={evolLightbox.pages}
          title={evolLightbox.title}
          description={evolLightbox.description}
          kind={evolLightbox.kind}
          onClose={() => setEvolLightbox(null)}
        />
      )}
    </Modal>
  )
}

function ItensMarkupLista({ linhas }: { linhas: MarkupLinhaProduto[] }) {
  if (linhas.length === 0) {
    return (
      <p className="text-[0.72rem] text-[#c4a882]">Sem itens de material neste markup.</p>
    )
  }

  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-0.5">
      {linhas.map((linha, idx) => (
        <li
          key={`${linha.produto_id ?? linha.descricao}-${idx}`}
          className="flex min-w-0 items-start justify-between gap-2 rounded bg-[rgba(240,210,140,0.06)] px-2 py-1.5"
        >
          <span className="min-w-0 text-[0.72rem] text-[#edd9c4]">
            <span className="block truncate font-medium text-[#fffaf4]">{itemLabel(linha)}</span>
            <span className="text-[#c4a882]">
              {linha.quantidade} {linha.unidade}
              {linha.categoria ? ` · ${linha.categoria}` : ''}
              {' · '}
              {fmtCur(linha.valor_unitario)} / un
            </span>
          </span>
          <span className="shrink-0 text-[0.72rem] font-semibold text-[#f2d892]">
            {fmtCur(linha.valor_total)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ItensPedidoLista({ itens }: { itens: Array<PedidoItem | PedidoItemDraft> }) {
  if (itens.length === 0) {
    return (
      <p className="text-[0.72rem] text-[#c4a882]">Nenhum item para pedir neste lead.</p>
    )
  }

  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-0.5">
      {itens.map((item, idx) => {
        const qtd = Number(item.quantidade) || 0
        const unitMarkup = 'valor_unitario_markup' in item
          ? Number(item.valor_unitario_markup) || 0
          : 0
        const unitFeito = 'valor_unitario_feito' in item
          ? Number(item.valor_unitario_feito) || Number(item.valor_unitario) || 0
          : Number((item as PedidoItem).valor_unitario) || 0
        const total = 'valor_total' in item && item.valor_total != null
          ? Number(item.valor_total) || qtd * unitFeito
          : qtd * unitFeito
        const descricao = item.descricao?.trim() || 'Item'
        const key = 'id' in item ? item.id : `${item.markup_produto_id ?? descricao}-${idx}`

        return (
          <li
            key={key}
            className="flex min-w-0 items-start justify-between gap-2 rounded bg-[rgba(74,222,128,0.08)] px-2 py-1.5"
          >
            <span className="min-w-0 text-[0.72rem] text-[#edd9c4]">
              <span className="block truncate font-medium text-[#fffaf4]">{descricao}</span>
              <span className="text-[#c4a882]">
                {qtd} un
                {unitMarkup > 0 ? ` · markup ${fmtCur(unitMarkup)}` : ''}
                {unitFeito > 0 ? ` · pedido ${fmtCur(unitFeito)}` : ''}
              </span>
            </span>
            <span className="shrink-0 text-[0.72rem] font-semibold text-[#4ade80]">
              {fmtCur(total)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function EvolucaoPedidoItem({
  item,
  onOpen,
}: {
  item: EvolucaoItemComUrl
  onOpen: (next: {
    url: string
    pages: string[]
    title: string
    description?: string | null
    kind: 'image' | 'pdf' | 'video'
  }) => void
}) {
  if (item.kind === 'text') {
    return (
      <div className="min-w-[min(100%,16rem)] max-w-full flex-1 rounded-lg border border-[rgba(240,210,140,0.18)] bg-black/25 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[#f2d892]">
          <MessageSquareText size={13} />
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Observação</span>
        </div>
        {item.observacao?.trim() && (
          <EvolucaoObservacao
            texto={item.observacao.trim()}
            className="text-[0.75rem] text-[#c4a882]"
          />
        )}
      </div>
    )
  }

  const thumb = evolucaoThumbUrl(item)
  const pages = evolucaoLightboxPages(item)
  const kind = item.kind === 'video' ? 'video' : item.kind === 'pdf' ? 'pdf' : 'image'

  return (
    <AnexoThumb
      previewUrl={thumb ?? ''}
      nome={item.nome_arquivo}
      kind={kind}
      pageCount={pages.length}
      onOpenFullscreen={() => {
        const url = pages[0] || thumb
        if (!url) return
        onOpen({
          url,
          pages,
          title: item.nome_arquivo,
          description: item.observacao,
          kind,
        })
      }}
    />
  )
}
