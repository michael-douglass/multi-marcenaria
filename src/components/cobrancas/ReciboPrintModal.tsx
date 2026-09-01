import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { fmtCur, todayISO } from '@/lib/utils'
import {
  buildReciboCompleto,
  buildReciboPrintLayout,
  imprimirReciboLayout,
  type ReciboPrintOverrides,
} from '@/lib/recibo-print'
import { ReciboPrintPreview, type ReciboPrintPreviewHandle } from '@/components/cobrancas/ReciboPrintPreview'
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
  const previewRef = useRef<ReciboPrintPreviewHandle>(null)
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
    const forma = (conta.forma_pagamento as FormaPagamento) || 'pix'
    const data = conta.data_recebimento?.slice(0, 10) || todayISO()
    setChavePix(chavePixInicial)
    setFormaPagamento(forma)
    setDataPagamento(data)
    setTextoRecibo(
      buildReciboCompleto(
        conta,
        reciboConfig,
        {
          chavePix: chavePixInicial,
          formaPagamento: forma,
          dataPagamento: data,
          nomeBeneficiario,
        },
        PM_LABEL,
      ),
    )
  }, [open, conta, reciboConfig, chavePixInicial, nomeBeneficiario])

  const aplicarCamposAoTexto = () => {
    setTextoRecibo(gerarTextoDoModelo())
  }

  const layout = useMemo(() => {
    if (!conta) return null
    return buildReciboPrintLayout(conta, textoRecibo, {
      formaPagamentoLabel: PM_LABEL[formaPagamento],
      dataPagamento,
      cnpj: reciboConfig?.cnpj,
    })
  }, [conta, textoRecibo, formaPagamento, dataPagamento, reciboConfig?.cnpj])

  const handlePrint = () => {
    if (!conta || !textoRecibo.trim() || !layout) return
    const foilDataUrl = previewRef.current?.snapshotFoil() ?? null
    imprimirReciboLayout({ ...layout, foilDataUrl })
    onClose()
  }

  if (!conta) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="IMPRIMIR RECIBO"
      extraWide
      tall
      closeOnBackdrop={false}
    >
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[#edd9c4]">
        À esquerda você ajusta o texto. À direita aparece o recibo como vai sair no papel:
        com a logo da Garbo, a faixa dourada e os dados da cobrança.
      </p>

      <div className="mb-4 rounded-lg border border-[rgba(240,210,140,0.15)] bg-black/20 px-3 py-2 text-sm">
        <span className="font-semibold text-[#f2d892]">{conta.cliente_nome}</span>
        <span className="mx-2 text-[#d4bc9f]">·</span>
        <span className="text-[#4ade80]">{fmtCur(conta.valor_parcela)}</span>
        <span className="mx-2 text-[#d4bc9f]">·</span>
        <span className="text-[#edd9c4]">
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.92fr)]">
        <div>
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

          <Field label="Texto do recibo (miolo impresso)">
            <textarea
              className="glass-input min-h-[280px] resize-y font-mono text-[0.82rem] leading-relaxed"
              value={textoRecibo}
              onChange={e => setTextoRecibo(e.target.value)}
              spellCheck
            />
          </Field>
          <p className="mt-2 text-[0.72rem] text-[#d4bc9f]">
            A logo, o título e a ficha de valores entram automaticamente. O recibo sai em uma folha A4.
          </p>
        </div>

        <div className="rounded-[1.25rem] border border-[rgba(240,210,140,0.16)] bg-[rgba(20,10,4,0.45)] p-2 sm:p-3">
          <p className="mb-2 px-1 font-display text-[11px] tracking-[0.28em] text-[#f2d892]">
            PRÉVIA DO PAPEL
          </p>
          {layout ? <ReciboPrintPreview ref={previewRef} layout={layout} /> : null}
        </div>
      </div>

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={handlePrint}
        submitLabel="Imprimir recibo"
        submitDisabled={!textoRecibo.trim()}
      />
    </Modal>
  )
}
