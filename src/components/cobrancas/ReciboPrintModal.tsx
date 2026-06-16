import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { fmtCur, todayISO } from '@/lib/utils'
import { imprimirRecibo } from '@/lib/recibo-print'
import type { ReciboConfig } from '@/hooks/useReciboConfig'
import type { ContaReceber, FormaPagamento } from '@/types'

const FORMAS_RECIBO: FormaPagamento[] = ['pix', 'dinheiro', 'cheque', 'boleto', 'cartao']

const PM_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  boleto: 'Boleto',
  cartao: 'Cartão',
}

interface ReciboPrintModalProps {
  open: boolean
  conta: ContaReceber | null
  reciboConfig: ReciboConfig | null
  chavePixInicial?: string
  nomeBeneficiario?: string | null
  onClose: () => void
}

export function ReciboPrintModal({
  open,
  conta,
  reciboConfig,
  chavePixInicial = '',
  nomeBeneficiario,
  onClose,
}: ReciboPrintModalProps) {
  const [chavePix, setChavePix] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix')
  const [dataPagamento, setDataPagamento] = useState(todayISO())

  useEffect(() => {
    if (!open || !conta) return
    setChavePix(chavePixInicial)
    setFormaPagamento((conta.forma_pagamento as FormaPagamento) || 'pix')
    setDataPagamento(conta.data_recebimento?.slice(0, 10) || todayISO())
  }, [open, conta, chavePixInicial])

  const handlePrint = () => {
    if (!conta || !reciboConfig) return
    imprimirRecibo(
      conta,
      reciboConfig,
      {
        chavePix,
        formaPagamento,
        dataPagamento,
        nomeBeneficiario,
      },
      PM_LABEL,
    )
    onClose()
  }

  if (!conta) return null

  return (
    <Modal open={open} onClose={onClose} title="IMPRIMIR RECIBO" closeOnBackdrop={false}>
      <p className="mb-4 text-sm text-[#8a6a55]">
        Revise os dados abaixo antes de imprimir. Tudo vem preenchido, mas você pode alterar.
      </p>

      <div className="mb-4 rounded-lg border border-[rgba(212,168,83,0.15)] bg-black/20 px-3 py-2 text-sm">
        <span className="text-[#d4a853] font-semibold">{conta.cliente_nome}</span>
        <span className="mx-2 text-[#6b5544]">·</span>
        <span className="text-[#4ade80]">{fmtCur(conta.valor_parcela)}</span>
        <span className="mx-2 text-[#6b5544]">·</span>
        <span className="text-[#8a6a55]">
          Parcela {conta.numero_parcela}/{conta.total_parcelas}
        </span>
      </div>

      <Field label="Chave PIX">
        <input
          className="glass-input"
          value={chavePix}
          onChange={e => setChavePix(e.target.value)}
          placeholder="Informe a chave PIX"
        />
      </Field>

      <Field label="Forma de pagamento">
        <select
          className="glass-input"
          value={formaPagamento}
          onChange={e => setFormaPagamento(e.target.value as FormaPagamento)}
        >
          {FORMAS_RECIBO.map(f => (
            <option key={f} value={f}>
              {PM_LABEL[f]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Data do pagamento">
        <input
          type="date"
          className="glass-input"
          value={dataPagamento}
          onChange={e => setDataPagamento(e.target.value)}
        />
      </Field>

      <p className="mt-2 text-[0.72rem] text-[#6b5544]">
        O recibo será impresso em uma única folha A4.
      </p>

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={handlePrint}
        submitLabel="Imprimir recibo"
        submitDisabled={!reciboConfig || !dataPagamento}
      />
    </Modal>
  )
}
