import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field, FieldRow } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import type { useMarkupCatalogo } from '@/hooks/useMarkupCatalogo'
import { itemLabel, linhaFromCatalogo, type PedidoObraCardModel } from '@/lib/pedidos-obras'
import { fmtCur } from '@/lib/utils'
import type { MarkupLinhaProduto } from '@/types'

type CatalogoApi = ReturnType<typeof useMarkupCatalogo>

interface MarkupItensEditorProps {
  open: boolean
  card: PedidoObraCardModel | null
  catalogo: CatalogoApi
  saving: boolean
  onClose: () => void
  onSaveLinhas: (orcamentoId: string, linhas: MarkupLinhaProduto[]) => Promise<void>
  onCreateOrcamento: (leadId: string, titulo: string, linhas: MarkupLinhaProduto[]) => Promise<string>
}

export function MarkupItensEditor({
  open,
  card,
  catalogo,
  saving,
  onClose,
  onSaveLinhas,
  onCreateOrcamento,
}: MarkupItensEditorProps) {
  const [tab, setTab] = useState<'itens' | 'catalogo'>('itens')
  const [linhas, setLinhas] = useState<MarkupLinhaProduto[]>([])
  const [produtoNome, setProdutoNome] = useState('')
  const [produtoPreco, setProdutoPreco] = useState('')
  const [produtoUnidade, setProdutoUnidade] = useState('un')
  const [produtoCategoria, setProdutoCategoria] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('')

  useEffect(() => {
    if (!open) return
    setTab('itens')
    setLinhas(card?.markup?.linhas ?? [])
  }, [open, card?.obra.id, card?.markup?.orcamento_id])

  const total = useMemo(
    () => linhas.filter(l => l.ativo).reduce((s, l) => s + l.quantidade * l.valor_unitario, 0),
    [linhas],
  )

  const updateLinha = (idx: number, patch: Partial<MarkupLinhaProduto>) => {
    setLinhas(prev => prev.map((linha, i) => {
      if (i !== idx) return linha
      const next = { ...linha, ...patch }
      next.valor_total = next.quantidade * next.valor_unitario
      return next
    }))
  }

  const handleSaveItens = async () => {
    if (!card) return
    const leadId = card.obra.origem_lead_id?.trim()
    if (card.markup?.orcamento_id) {
      await onSaveLinhas(card.markup.orcamento_id, linhas)
      return
    }
    if (!leadId) throw new Error('Esta obra não tem lead de origem para criar o markup.')
    await onCreateOrcamento(leadId, `Markup — ${card.obra.cliente_nome}`, linhas)
  }

  const handleSaveProduto = async () => {
    if (!produtoNome.trim()) return
    await catalogo.saveProduto({
      categoria_id: produtoCategoria || null,
      nome: produtoNome.trim(),
      preco_unitario: parseFloat(produtoPreco) || 0,
      unidade: produtoUnidade || 'un',
      ativo: true,
    })
    setProdutoNome('')
    setProdutoPreco('')
  }

  return (
    <Modal open={open} onClose={onClose} title="MARKUP E ITENS" wide closeOnBackdrop={!saving}>
      {card && (
        <>
          <p className="mb-3 text-sm text-[#edd9c4]">
            {card.obra.cliente_nome}
            {card.markup?.titulo ? ` · ${card.markup.titulo}` : ''}
          </p>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              className={tab === 'itens' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => setTab('itens')}
            >
              Itens do pedido
            </button>
            <button
              type="button"
              className={tab === 'catalogo' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => setTab('catalogo')}
            >
              Catálogo
            </button>
          </div>

          {tab === 'itens' && (
            <>
              <div className="mb-3 max-h-64 overflow-auto">
                {linhas.length === 0 && (
                  <p className="text-sm text-[#c4a882]">Nenhum item ainda. Adicione pelo catálogo.</p>
                )}
                {linhas.map((linha, idx) => (
                  <div
                    key={`${linha.produto_id}-${idx}`}
                    className="mb-2 grid grid-cols-12 gap-2 rounded-lg border border-[rgba(240,210,140,0.14)] p-2"
                  >
                    <label className="col-span-12 flex items-center gap-2 text-[0.75rem] text-[#edd9c4] sm:col-span-5">
                      <input
                        type="checkbox"
                        checked={linha.ativo}
                        onChange={e => updateLinha(idx, { ativo: e.target.checked })}
                      />
                      <span className="min-w-0 truncate">{itemLabel(linha)}</span>
                    </label>
                    <input
                      className="glass-input col-span-4 sm:col-span-2"
                      type="number"
                      min="0"
                      step="0.01"
                      value={linha.quantidade}
                      onChange={e => updateLinha(idx, { quantidade: parseFloat(e.target.value) || 0 })}
                      aria-label="Quantidade"
                    />
                    <input
                      className="glass-input col-span-5 sm:col-span-3"
                      type="number"
                      min="0"
                      step="0.01"
                      value={linha.valor_unitario}
                      onChange={e => updateLinha(idx, { valor_unitario: parseFloat(e.target.value) || 0 })}
                      aria-label="Valor unitário"
                    />
                    <span className="col-span-3 flex items-center justify-end text-[0.75rem] font-semibold text-[#f2d892] sm:col-span-2">
                      {fmtCur(linha.quantidade * linha.valor_unitario)}
                    </span>
                  </div>
                ))}
              </div>

              {catalogo.produtos.length > 0 && (
                <Field label="Adicionar do catálogo">
                  <select
                    className="glass-input"
                    defaultValue=""
                    onChange={e => {
                      const produto = catalogo.produtos.find(p => p.id === e.target.value)
                      if (produto) setLinhas(prev => [...prev, linhaFromCatalogo(produto)])
                      e.target.value = ''
                    }}
                  >
                    <option value="">Escolher produto…</option>
                    {catalogo.produtos.filter(p => p.ativo).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome}{p.variacao ? ` · ${p.variacao}` : ''} — {fmtCur(Number(p.preco_unitario))}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <div className="mb-2 flex justify-between text-sm">
                <span className="text-[#c4a882]">Total materiais</span>
                <span className="font-display text-lg text-[#f2d892]">{fmtCur(total)}</span>
              </div>

              <ModalFormFooter
                onCancel={onClose}
                onSubmit={() => void handleSaveItens()}
                submitLabel="Salvar itens"
                submitting={saving}
                submitDisabled={!card.obra.origem_lead_id && !card.markup}
              />
            </>
          )}

          {tab === 'catalogo' && (
            <>
              <FieldRow>
                <Field label="Nova categoria" half>
                  <div className="flex gap-2">
                    <input
                      className="glass-input flex-1"
                      value={novaCategoria}
                      onChange={e => setNovaCategoria(e.target.value)}
                      placeholder="Ex.: Ferragens"
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        if (!novaCategoria.trim()) return
                        void catalogo.saveCategoria({ nome: novaCategoria.trim() }).then(() => setNovaCategoria(''))
                      }}
                    >
                      Criar
                    </button>
                  </div>
                </Field>
                <Field label="Categoria do produto" half>
                  <select
                    className="glass-input"
                    value={produtoCategoria}
                    onChange={e => setProdutoCategoria(e.target.value)}
                  >
                    <option value="">Sem categoria</option>
                    {catalogo.categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </Field>
              </FieldRow>
              <Field label="Nome do produto">
                <input className="glass-input" value={produtoNome} onChange={e => setProdutoNome(e.target.value)} />
              </Field>
              <FieldRow>
                <Field label="Preço unitário" half>
                  <input
                    className="glass-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={produtoPreco}
                    onChange={e => setProdutoPreco(e.target.value)}
                  />
                </Field>
                <Field label="Unidade" half>
                  <input className="glass-input" value={produtoUnidade} onChange={e => setProdutoUnidade(e.target.value)} />
                </Field>
              </FieldRow>
              <ModalFormFooter
                onCancel={onClose}
                onSubmit={() => void handleSaveProduto()}
                submitLabel="Cadastrar produto"
                submitting={catalogo.loading}
                submitDisabled={!produtoNome.trim()}
              />

              <ul className="mt-4 max-h-48 overflow-auto text-[0.75rem] text-[#edd9c4]">
                {catalogo.produtos.slice(0, 40).map(p => (
                  <li key={p.id} className="flex justify-between border-b border-[rgba(240,210,140,0.1)] py-1">
                    <span className="truncate">
                      {p.nome}{p.variacao ? ` · ${p.variacao}` : ''}
                    </span>
                    <span className="shrink-0 text-[#f2d892]">{fmtCur(Number(p.preco_unitario))}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
