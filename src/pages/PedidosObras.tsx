import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useObras } from '@/hooks/useObras'
import { useApp } from '@/context/AppContext'
import { useFinanceDataOptional } from '@/context/FinanceDataContext'
import { useFornecedores } from '@/hooks/useFornecedores'
import { useMarkupItensPorLeads } from '@/hooks/useMarkupItensPorLeads'
import { useMarkupCatalogo } from '@/hooks/useMarkupCatalogo'
import { usePedidosObras, type PedidoItemDraft } from '@/hooks/usePedidosObras'
import { ObraPageHeader } from '@/components/obras/ObraPageHeader'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import { KanbanPageToolbar, KanbanPageZoomShell, PageZoomProvider } from '@/components/page-zoom'
import { kanbanColHeaderClass, kanbanColHeaderStyle } from '@/components/obras/obra-kanban-layout'
import { PedidosShaderBackdrop } from '@/components/pedidos-obras/PedidosShaderBackdrop'
import { PedidoObraCard } from '@/components/pedidos-obras/PedidoObraCard'
import { PedidoObraDetalheModal } from '@/components/pedidos-obras/PedidoObraDetalheModal'
import { PedidoFazerModal } from '@/components/pedidos-obras/PedidoFazerModal'
import { PedidoAprovarSheet } from '@/components/pedidos-obras/PedidoAprovarSheet'
import { MarkupItensEditor } from '@/components/pedidos-obras/MarkupItensEditor'
import {
  montarCardsPedidos,
  PEDIDO_COLUNAS,
  totalMarkupDoCard,
  totalPrecoFeito,
  type PedidoColunaId,
  type PedidoObraCardModel,
} from '@/lib/pedidos-obras'
import { getPedidoAnexoSignedUrl, revokePendingAnexoUrls } from '@/lib/pedidos-obras-anexos'
import { canAprovarPedidoCompra } from '@/lib/obra-permissions'
import { canEditMarkupItens } from '@/lib/role-access'
import { fmtCur } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import type { MarkupLinhaProduto, PedidoAnexo, PendingContaPagarAnexo } from '@/types'

export function PedidosObras() {
  return (
    <PageZoomProvider pageKey="pedidos_obras">
      <PedidosObrasContent />
    </PageZoomProvider>
  )
}

function PedidosObrasContent() {
  const { roles } = useApp()
  const obrasHook = useObras()
  const finance = useFinanceDataOptional()
  const fornecedoresHook = useFornecedores()
  const pedidosHook = usePedidosObras()
  const canApprove = canAprovarPedidoCompra(roles)
  const canEditMarkup = canEditMarkupItens(roles)

  const { itensByLead, loading: loadingItens, error: itensError, saveLinhas, createOrcamento, reload: reloadItens } =
    useMarkupItensPorLeads(obrasHook.data, true)
  const catalogo = useMarkupCatalogo(canEditMarkup)

  const fornecedores = finance?.fornecedores.data.length
    ? finance.fornecedores.data
    : fornecedoresHook.data

  const [busca, setBusca] = useState('')
  const [fazerCard, setFazerCard] = useState<PedidoObraCardModel | null>(null)
  const [aprovarCard, setAprovarCard] = useState<PedidoObraCardModel | null>(null)
  const [markupCard, setMarkupCard] = useState<PedidoObraCardModel | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingByPedido, setPendingByPedido] = useState<Record<string, PendingContaPagarAnexo[]>>({})
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null)
  const [detalheCard, setDetalheCard] = useState<PedidoObraCardModel | null>(null)
  const [fazerItensIniciais, setFazerItensIniciais] = useState<PedidoItemDraft[] | null>(null)

  const cards = useMemo(
    () => montarCardsPedidos(obrasHook.data, itensByLead, pedidosHook.data),
    [obrasHook.data, itensByLead, pedidosHook.data],
  )

  const cardsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return cards
    return cards.filter(c => {
      const hay = [
        c.obra.cliente_nome,
        c.obra.tipo_obra_nome,
        c.markup?.titulo,
        c.pedido?.movelaria_fornecedores?.nome,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [cards, busca])

  const porColuna = useMemo(() => {
    const map: Record<PedidoColunaId, PedidoObraCardModel[]> = {
      a_fazer: [],
      preco_feito: [],
      enviado: [],
    }
    for (const card of cardsFiltrados) map[card.coluna].push(card)
    return map
  }, [cardsFiltrados])

  const totais = useMemo(() => ({
    a_fazer: porColuna.a_fazer.reduce((s, c) => s + totalMarkupDoCard(c), 0),
    preco_feito: porColuna.preco_feito.reduce((s, c) => s + totalPrecoFeito(c.pedido), 0),
    enviado: porColuna.enviado.reduce((s, c) => s + totalPrecoFeito(c.pedido), 0),
  }), [porColuna])

  useEffect(() => {
    if (!detalheCard) return
    const fresh = cards.find(c => c.obra.id === detalheCard.obra.id)
    if (!fresh) {
      setDetalheCard(null)
      return
    }
    setDetalheCard(fresh)
  }, [cards, detalheCard?.obra.id])

  useEffect(() => {
    return () => {
      Object.values(pendingByPedido).forEach(revokePendingAnexoUrls)
    }
  }, [pendingByPedido])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      obrasHook.reload({ silent: true }),
      pedidosHook.reload({ silent: true }),
      reloadItens(),
    ])
  }, [obrasHook, pedidosHook, reloadItens])

  const handleFazerPedido = async (input: {
    fornecedorId: string
    itens: PedidoItemDraft[]
    numParcelas: number
    primeiroVencimento: string
    observacao: string
    anexos: PendingContaPagarAnexo[]
  }) => {
    if (!fazerCard) return
    setSaving(true)
    try {
      await pedidosHook.criarPedidoDaObra({
        obraId: fazerCard.obra.id,
        markupOrcamentoId:
          fazerCard.markup?.orcamento_id
          ?? itensByLead.get(fazerCard.obra.origem_lead_id?.trim() ?? '')?.orcamento_id
          ?? null,
        fornecedorId: input.fornecedorId,
        itens: input.itens,
        numParcelas: input.numParcelas,
        primeiroVencimento: input.primeiroVencimento,
        observacao: input.observacao,
        anexos: input.anexos,
      })
      showToast('Pedido enviado. O card da Agenda ficou como Pedido feito.')
      setFazerCard(null)
      setFazerItensIniciais(null)
      setDetalheCard(null)
      await refreshAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível criar o pedido.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const persistMarkupDoDetalhe = async (linhas: MarkupLinhaProduto[]) => {
    if (!detalheCard) return
    const leadId = detalheCard.obra.origem_lead_id?.trim()
    setSaving(true)
    try {
      if (detalheCard.markup?.orcamento_id) {
        await saveLinhas(detalheCard.markup.orcamento_id, linhas)
      } else {
        if (!leadId) throw new Error('Esta obra não tem lead de origem para criar o markup.')
        await createOrcamento(leadId, `Markup — ${detalheCard.obra.cliente_nome}`, linhas)
      }
      showToast('Itens salvos no markup. A Agenda usa o mesmo valor.')
      await refreshAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível salvar o markup.', 'error')
      throw e
    } finally {
      setSaving(false)
    }
  }

  const handleAprovar = async (numParcelas: number, primeiroVencimento: string) => {
    const pedido = aprovarCard?.pedido
    if (!pedido || !finance) return
    setSaving(true)
    try {
      const pending = pendingByPedido[pedido.id] ?? []
      if (pending.length) {
        await pedidosHook.anexarNf(pedido.id, pending)
        revokePendingAnexoUrls(pending)
        setPendingByPedido(prev => ({ ...prev, [pedido.id]: [] }))
      }
      await pedidosHook.aprovarPedido(pedido, {
        numParcelas,
        primeiroVencimento,
        gerarParcelas: finance.contasPagar.gerarParcelas,
      })
      showToast('Compra aprovada. As parcelas foram para Contas a Pagar.')
      setAprovarCard(null)
      await refreshAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível aprovar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openAnexo = async (anexo: PedidoAnexo) => {
    try {
      const path = anexo.preview_path || anexo.storage_path
      const url = await getPedidoAnexoSignedUrl(path)
      setLightbox({ url, title: anexo.nome_arquivo })
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível abrir a nota.', 'error')
    }
  }

  const loading = (obrasHook.loading && obrasHook.data.length === 0)
    || (pedidosHook.loading && pedidosHook.data.length === 0)
  const error = obrasHook.error || pedidosHook.error || itensError

  if (loading) return <LoadingState message="Carregando pedidos..." variant="page" />
  if (error) return <ErrorState message={error} />

  return (
    <div className="obra-page-shell obra-page-shell--agenda fade-in relative flex min-h-0 min-w-0 flex-none flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      <PedidosShaderBackdrop />

      <KanbanPageToolbar className="agenda-kanban-toolbar relative z-[1]">
        <ObraPageHeader
          title="Pedidos"
          subtitle={
            <>
              {cardsFiltrados.length} obra{cardsFiltrados.length !== 1 ? 's' : ''} neste fluxo
              {loadingItens && <span className="ml-1 text-[#c4a882]">· carregando itens</span>}
            </>
          }
          actions={
            <div className="obra-page-header__actions-inner">
              <div className="obra-page-header__badges flex flex-col items-start gap-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(245,158,11,0.38)] bg-[rgba(245,158,11,0.12)] px-2.5 py-1 text-[0.68rem] font-semibold text-[#fbbf24]">
                  A fazer: {fmtCur(totais.a_fazer)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(96,165,250,0.38)] bg-[rgba(37,99,235,0.14)] px-2.5 py-1 text-[0.68rem] font-semibold text-[#93c5fd]">
                  Preço feito: {fmtCur(totais.preco_feito)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(74,222,128,0.38)] bg-[rgba(34,197,94,0.12)] px-2.5 py-1 text-[0.68rem] font-semibold text-[#4ade80]">
                  Enviado: {fmtCur(totais.enviado)}
                </span>
              </div>
              <div className="obra-page-search relative min-w-0">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#edd9c4] pointer-events-none" />
                <input
                  className="glass-input w-full pl-8"
                  placeholder="Buscar obra, cliente ou fornecedor"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
                {busca && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#edd9c4]"
                    onClick={() => setBusca('')}
                    aria-label="Limpar busca"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          }
        />
      </KanbanPageToolbar>

      <KanbanPageZoomShell contentLayout="kanban" contentSignal={cardsFiltrados.length}>
        <div className="agenda-kanban-board obra-scroll-x-mobile relative z-[1] flex w-max min-w-full flex-col gap-4 pb-1 md:flex-row">
          {PEDIDO_COLUNAS.map(col => (
            <section
              key={col.id}
              className="flex w-full min-w-0 shrink-0 flex-col gap-2 md:w-[320px] md:max-w-[340px]"
            >
              <header
                className={kanbanColHeaderClass(false, col.color)}
                style={kanbanColHeaderStyle(false, col.color)}
              >
                <div className="min-w-0">
                  <h2 className="truncate text-[0.78rem] font-bold uppercase tracking-wide text-[#fffaf4]">
                    {col.title}
                  </h2>
                  <p className="truncate text-[0.62rem] text-[#c4a882]">{col.hint}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold" style={{ color: col.color }}>
                  {porColuna[col.id].length}
                </span>
              </header>
              <div className="flex min-h-[120px] flex-col gap-2 overflow-y-auto rounded-lg p-0.5">
                {porColuna[col.id].length === 0 && (
                  <p className="px-2 py-6 text-center text-[0.72rem] text-[#c4a882]">
                    Nada nesta coluna
                  </p>
                )}
                {porColuna[col.id].map(card => (
                  <PedidoObraCard
                    key={card.obra.id}
                    card={card}
                    canApprove={canApprove}
                    canEdit={canEditMarkup}
                    pendingAnexos={card.pedido ? pendingByPedido[card.pedido.id] ?? [] : []}
                    onPendingAnexosChange={next => {
                      if (!card.pedido) return
                      setPendingByPedido(prev => ({ ...prev, [card.pedido!.id]: next }))
                    }}
                    onRemoveSavedAnexo={anexo => {
                      void pedidosHook.removerAnexo(anexo).catch(e => {
                        showToast(e instanceof Error ? e.message : 'Erro ao remover nota.', 'error')
                      })
                    }}
                    onOpenAnexo={openAnexo}
                    onFazerPedido={() => {
                      setFazerItensIniciais(null)
                      setFazerCard(card)
                    }}
                    onAprovar={() => setAprovarCard(card)}
                    onRecusar={() => {
                      if (!card.pedido) return
                      if (!window.confirm('Recusar este pedido e devolver a obra para “a fazer”?')) return
                      void pedidosHook.recusarPedido(card.pedido).then(refreshAll).catch(e => {
                        showToast(e instanceof Error ? e.message : 'Não foi possível recusar.', 'error')
                      })
                    }}
                    onEditarMarkup={canEditMarkup ? () => setMarkupCard(card) : undefined}
                    onOpenDetalhe={() => setDetalheCard(card)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </KanbanPageZoomShell>

      <PedidoObraDetalheModal
        open={!!detalheCard}
        card={detalheCard}
        onClose={() => setDetalheCard(null)}
        canEditItens={canEditMarkup}
        catalogo={catalogo}
        savingItens={saving}
        onSalvarMarkup={persistMarkupDoDetalhe}
        onEnviarPedido={async itens => {
          if (!detalheCard) return
          setFazerItensIniciais(itens)
          setFazerCard(detalheCard)
        }}
      />

      <PedidoFazerModal
        open={!!fazerCard}
        card={fazerCard}
        fornecedores={fornecedores}
        saving={saving}
        itensIniciais={fazerItensIniciais}
        onClose={() => {
          setFazerCard(null)
          setFazerItensIniciais(null)
        }}
        onSubmit={handleFazerPedido}
      />

      <PedidoAprovarSheet
        open={!!aprovarCard}
        pedido={aprovarCard?.pedido ?? null}
        clienteNome={aprovarCard?.obra.cliente_nome}
        saving={saving}
        onClose={() => setAprovarCard(null)}
        onSubmit={handleAprovar}
      />

      <MarkupItensEditor
        open={!!markupCard}
        card={markupCard}
        catalogo={catalogo}
        saving={saving}
        onClose={() => setMarkupCard(null)}
        onSaveLinhas={async (orcamentoId, linhas) => {
          setSaving(true)
          try {
            await saveLinhas(orcamentoId, linhas)
            showToast('Itens do markup atualizados. A Agenda usa o mesmo valor.')
            setMarkupCard(null)
            await refreshAll()
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'Não foi possível salvar.', 'error')
          } finally {
            setSaving(false)
          }
        }}
        onCreateOrcamento={async (leadId, titulo, linhas) => {
          setSaving(true)
          try {
            const id = await createOrcamento(leadId, titulo, linhas)
            showToast('Markup criado para esta obra.')
            setMarkupCard(null)
            await refreshAll()
            return id
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'Não foi possível criar o markup.', 'error')
            throw e
          } finally {
            setSaving(false)
          }
        }}
      />

      <AnexoLightbox
        open={!!lightbox}
        imageUrl={lightbox?.url ?? ''}
        title={lightbox?.title ?? 'Nota fiscal'}
        onClose={() => setLightbox(null)}
      />
    </div>
  )
}
