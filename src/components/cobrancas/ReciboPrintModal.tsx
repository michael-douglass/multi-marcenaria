import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { fmtCur, todayISO } from '@/lib/utils'
import { buildReciboCompleto, imprimirReciboTexto, type ReciboPrintOverrides } from '@/lib/recibo-print'
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
  const [textoRecibo, setTextoRecibo] = useState('')

  const getOverrides = useCallback((): ReciboPrintOverrides => ({
    chavePix,
    formaPagamento,
    dataPagamento,
    nomeBeneficiario,
  }), [chavePix, formaPagamento, dataPagamento, nomeBeneficiario])

  const gerarTextoDoModelo = useCallback(() => {
    if (!conta || !reciboConfig) return ''
    return buildReciboCompleto(conta, reciboConfig, getOverrides(), PM_LABEL)
  }, [conta, reciboConfig, getOverrides])

  useEffect(() => {
    if (!open || !conta || !reciboConfig) return
    setChavePix(chavePixInicial)
    setFormaPagamento((conta.forma_pagamento as FormaPagamento) || 'pix')
    setDataPagamento(conta.data_recebimento?.slice(0, 10) || todayISO())
  }, [open, conta, chavePixInicial, reciboConfig])

  useEffect(() => {
    if (!open || !conta || !reciboConfig) return
    setTextoRecibo(gerarTextoDoModelo())
  }, [open, conta, reciboConfig, chavePixInicial, gerarTextoDoModelo])

  const aplicarCamposAoTexto = () => {
    setTextoRecibo(gerarTextoDoModelo())
  }

  const handlePrint = () => {
    if (!conta || !textoRecibo.trim()) return
    imprimirReciboTexto(conta, textoRecibo)
    onClose()
  }

  if (!conta) return null

  return (
    <Modal open={open} onClose={onClose} title="IMPRIMIR RECIBO" wide closeOnBackdrop={false}>
      <p className="mb-4 text-sm text-[#8a6a55]">
        Edite o texto completo do recibo antes de imprimir. Os campos abaixo servem para preencher
        automaticamente — use &quot;Atualizar texto&quot; para aplicá-los sem perder edições manuais
        até você clicar no botão.
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Chave PIX">
          <input
            className="glass-input"
            value={chavePix}
            onChange={e => setChavePix(e.target.value)}
            placeholder="Chave PIX"
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
      </div>

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={aplicarCamposAoTexto}
          disabled={!reciboConfig}
        >
          Atualizar texto com os campos acima
        </button>
      </div>

      <Field label="Texto do recibo (será impresso exatamente assim)">
        <textarea
          className="glass-input min-h-[280px] resize-y font-mono text-[0.82rem] leading-relaxed"
          value={textoRecibo}
          onChange={e => setTextoRecibo(e.target.value)}
          spellCheck
        />
      </Field>

      <p className="mt-2 text-[0.72rem] text-[#6b5544]">
        O recibo será impresso em uma única folha A4.
      </p>

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={handlePrint}
        submitLabel="Imprimir recibo"
        submitDisabled={!textoRecibo.trim()}
      />
    </Modal>
  )
}
