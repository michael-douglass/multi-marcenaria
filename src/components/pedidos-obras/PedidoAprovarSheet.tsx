import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field, FieldRow } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { fmtCur, todayISO } from '@/lib/utils'
import type { Pedido } from '@/types'

interface PedidoAprovarSheetProps {
  open: boolean
  pedido: Pedido | null
  clienteNome?: string
  saving: boolean
  onClose: () => void
  onSubmit: (numParcelas: number, primeiroVencimento: string) => Promise<void>
}

export function PedidoAprovarSheet({
  open,
  pedido,
  clienteNome,
  saving,
  onClose,
  onSubmit,
}: PedidoAprovarSheetProps) {
  const [inst, setInst] = useState('1')
  const [venc, setVenc] = useState(todayISO())

  useEffect(() => {
    if (!open || !pedido) return
    setInst(String(pedido.num_parcelas || 1))
    setVenc(pedido.primeiro_vencimento || todayISO())
  }, [open, pedido?.id])

  const n = Math.max(1, parseInt(inst, 10) || 1)
  const parcela = pedido ? pedido.total / n : 0

  return (
    <Modal open={open} onClose={onClose} title="APROVAR COMPRA" closeOnBackdrop={!saving}>
      {pedido && (
        <>
          <div className="mb-3 rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(240,210,140,0.07)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#fffaf4]">
                {pedido.movelaria_fornecedores?.nome ?? 'Fornecedor'}
              </span>
              <span className="font-display text-xl text-[#f2d892]">{fmtCur(pedido.total)}</span>
            </div>
            {clienteNome && (
              <p className="mt-1 text-[0.72rem] text-[#c4a882]">Obra: {clienteNome}</p>
            )}
          </div>

          <FieldRow>
            <Field label="Número de parcelas" half>
              <input
                className="glass-input"
                type="number"
                min="1"
                max="60"
                value={inst}
                onChange={e => setInst(e.target.value)}
              />
            </Field>
            <Field label="Vencimento da 1ª parcela" half>
              <input
                className="glass-input"
                type="date"
                value={venc}
                onChange={e => setVenc(e.target.value)}
              />
            </Field>
          </FieldRow>

          <p className="mb-3 rounded-md border border-[rgba(74,222,128,0.22)] bg-[rgba(34,197,94,0.08)] px-3 py-2 text-sm text-[#bbf7d0]">
            {n} parcela{n > 1 ? 's' : ''} de cerca de {fmtCur(parcela)}. Elas entram em Contas a Pagar.
          </p>

          <ModalFormFooter
            onCancel={onClose}
            onSubmit={() => void onSubmit(n, venc)}
            submitLabel="Aprovar e enviar a pagar"
            submittingLabel="Aprovando..."
            submitting={saving}
          />
        </>
      )}
    </Modal>
  )
}
