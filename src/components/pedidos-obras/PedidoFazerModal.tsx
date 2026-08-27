import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field, FieldRow } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { PedidoNfDropzone } from './PedidoNfDropzone'
import { draftsFromMarkup, type PedidoItemDraft } from '@/hooks/usePedidosObras'
import { linhasAtivas, type PedidoObraCardModel } from '@/lib/pedidos-obras'
import { fmtCur, todayISO } from '@/lib/utils'
import type { Fornecedor, PendingContaPagarAnexo } from '@/types'

interface PedidoFazerModalProps {
  open: boolean
  card: PedidoObraCardModel | null
  fornecedores: Fornecedor[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: {
    fornecedorId: string
    itens: PedidoItemDraft[]
    numParcelas: number
    primeiroVencimento: string
    observacao: string
    anexos: PendingContaPagarAnexo[]
  }) => Promise<void>
  itensIniciais?: PedidoItemDraft[] | null
}

export function PedidoFazerModal({
  open,
  card,
  fornecedores,
  saving,
  onClose,
  onSubmit,
  itensIniciais,
}: PedidoFazerModalProps) {
  const linhas = useMemo(() => linhasAtivas(card?.markup?.linhas ?? []), [card])
  const [fornecedorId, setFornecedorId] = useState('')
  const [itens, setItens] = useState<PedidoItemDraft[]>([])
  const [numParcelas, setNumParcelas] = useState('1')
  const [primeiroVencimento, setPrimeiroVencimento] = useState(todayISO())
  const [observacao, setObservacao] = useState('')
  const [anexos, setAnexos] = useState<PendingContaPagarAnexo[]>([])

  useEffect(() => {
    if (!open || !card) return
    setFornecedorId('')
    setItens(itensIniciais?.length ? itensIniciais : draftsFromMarkup(linhas))
    setNumParcelas('1')
    setPrimeiroVencimento(todayISO())
    setObservacao('')
    setAnexos([])
  }, [open, card?.obra.id, linhas, itensIniciais])

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_feito, 0)

  const handleSubmit = async () => {
    if (!fornecedorId || itens.length === 0) return
    await onSubmit({
      fornecedorId,
      itens,
      numParcelas: Math.max(1, parseInt(numParcelas, 10) || 1),
      primeiroVencimento,
      observacao,
      anexos,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="FAZER PEDIDO"
      wide
      closeOnBackdrop={!saving}
    >
      {card && (
        <>
          <p className="mb-3 text-sm text-[#edd9c4]">
            Obra de <strong className="text-[#fffaf4]">{card.obra.cliente_nome}</strong>
            {' · '}custo markup {fmtCur(card.markup?.custo_materiais ?? 0)}
          </p>

          <Field label="Fornecedor *">
            <select
              className="glass-input"
              value={fornecedorId}
              onChange={e => setFornecedorId(e.target.value)}
            >
              <option value="">Selecione</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </Field>

          <div className="mb-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[0.75rem]">
              <thead>
                <tr className="text-[#c4a882]">
                  <th className="pb-1 font-medium">Item</th>
                  <th className="pb-1 font-medium">Qtd</th>
                  <th className="pb-1 font-medium">Markup</th>
                  <th className="pb-1 font-medium">Preço feito</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => (
                  <tr key={`${item.markup_produto_id}-${idx}`} className="border-t border-[rgba(240,210,140,0.12)]">
                    <td className="py-1.5 pr-2 text-[#edd9c4]">{item.descricao}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        className="glass-input w-20"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantidade}
                        onChange={e => {
                          const quantidade = parseFloat(e.target.value) || 0
                          setItens(prev => prev.map((x, i) => i === idx ? { ...x, quantidade } : x))
                        }}
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-[#c4a882]">{fmtCur(item.valor_unitario_markup)}</td>
                    <td className="py-1.5">
                      <input
                        className="glass-input w-28"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.valor_unitario_feito}
                        onChange={e => {
                          const valor_unitario_feito = parseFloat(e.target.value) || 0
                          setItens(prev => prev.map((x, i) => i === idx ? { ...x, valor_unitario_feito } : x))
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <FieldRow>
            <Field label="Parcelas previstas" half>
              <input
                className="glass-input"
                type="number"
                min="1"
                max="60"
                value={numParcelas}
                onChange={e => setNumParcelas(e.target.value)}
              />
            </Field>
            <Field label="1º vencimento" half>
              <input
                className="glass-input"
                type="date"
                value={primeiroVencimento}
                onChange={e => setPrimeiroVencimento(e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Observação">
            <textarea
              className="glass-input min-h-[64px]"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </Field>

          <div className="mb-3">
            <div className="section-label mb-1.5">Notas fiscais</div>
            <PedidoNfDropzone pending={anexos} onPendingChange={setAnexos} />
          </div>

          <div className="mb-2 flex justify-between rounded-lg border border-[rgba(74,222,128,0.28)] bg-[rgba(34,197,94,0.08)] px-3 py-2">
            <span className="text-sm text-[#edd9c4]">Total preço feito</span>
            <span className="font-display text-lg text-[#4ade80]">{fmtCur(total)}</span>
          </div>

          <ModalFormFooter
            onCancel={onClose}
            onSubmit={() => void handleSubmit()}
            submitLabel="Enviar para Preço feito"
            submittingLabel="Salvando..."
            submitting={saving}
            submitDisabled={!fornecedorId || itens.length === 0}
          />
        </>
      )}
    </Modal>
  )
}
