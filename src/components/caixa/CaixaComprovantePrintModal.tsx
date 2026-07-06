import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import {
  buildCaixaComprovanteTexto,
  imprimirCaixaComprovante,
  type CaixaComprovanteInput,
} from '@/lib/caixa-comprovante-print'
import type { ReciboConfig } from '@/hooks/useReciboConfig'
import type { ReservaConsolidada } from '@/types'
import { fmtCur, todayISO } from '@/lib/utils'

interface CaixaComprovantePrintModalProps {
  open: boolean
  reserva: ReservaConsolidada | null
  reciboConfig: ReciboConfig | null
  onClose: () => void
}

export function CaixaComprovantePrintModal({
  open,
  reserva,
  reciboConfig,
  onClose,
}: CaixaComprovantePrintModalProps) {
  const [valor, setValor] = useState('')
  const [dataPagamento, setDataPagamento] = useState(todayISO())
  const [descricao, setDescricao] = useState('')
  const [textoComprovante, setTextoComprovante] = useState('')

  const montarInput = useCallback((): CaixaComprovanteInput | null => {
    if (!reserva) return null
    const valorNum = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(valorNum) || valorNum <= 0) return null
    return {
      destinatarioNome: reserva.destinatario_nome,
      valor: valorNum,
      dataPagamento,
      descricao: descricao.trim() || `Pagamento ref. ${reserva.mes_referencia}/${reserva.ano_referencia}`,
      mesReferencia: reserva.mes_referencia,
      anoReferencia: reserva.ano_referencia,
    }
  }, [reserva, valor, dataPagamento, descricao])

  const gerarTexto = useCallback(() => {
    const input = montarInput()
    if (!input) return ''
    return buildCaixaComprovanteTexto(input, reciboConfig)
  }, [montarInput, reciboConfig])

  useEffect(() => {
    if (!open || !reserva) return
    const valorPadrao = reserva.total_pago > 0
      ? reserva.total_pago
      : Math.max(0, reserva.valor_total_real - reserva.total_pago)
    setValor(valorPadrao.toFixed(2).replace('.', ','))
    setDataPagamento(todayISO())
    setDescricao(`Pagamento ref. ${reserva.mes_referencia}/${reserva.ano_referencia}`)
  }, [open, reserva])

  useEffect(() => {
    if (!open || !reserva) return
    setTextoComprovante(gerarTexto())
  }, [open, reserva, gerarTexto, valor, dataPagamento, descricao, reciboConfig])

  const handlePrint = () => {
    const input = montarInput()
    if (!input || !textoComprovante.trim()) return
    imprimirCaixaComprovante(input, textoComprovante, reciboConfig)
    onClose()
  }

  if (!reserva) return null

  return (
    <Modal open={open} onClose={onClose} title="Comprovante de pagamento" wide>
      <p className="mb-4 text-[0.78rem] leading-relaxed text-[#d4bc9f]">
        Documento que comprova que a <span className="text-cream">GARBO Movelaria</span> pagou
        o destinatário abaixo. Não é recibo de cobrança de cliente.
      </p>

      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">Pagamos a</p>
        <p className="text-sm font-semibold text-cream">{reserva.destinatario_nome}</p>
        <p className="mt-1 text-[0.72rem] text-[#d4bc9f]">
          Total já pago no período: {reserva.total_pago > 0 ? fmtCur(reserva.total_pago) : '—'}
        </p>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Field label="Valor pago *">
          <input
            className="glass-input w-full"
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Data do pagamento *">
          <input
            type="date"
            className="glass-input w-full"
            value={dataPagamento}
            onChange={e => setDataPagamento(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Descrição / referência do pagamento">
        <input
          className="glass-input w-full"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
        />
      </Field>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setTextoComprovante(gerarTexto())}
        >
          Atualizar texto do comprovante
        </button>
      </div>

      <Field label="Texto do comprovante (impresso com logo e assinatura da empresa)">
        <textarea
          className="glass-input mt-1 min-h-[180px] w-full font-mono text-sm"
          value={textoComprovante}
          onChange={e => setTextoComprovante(e.target.value)}
        />
      </Field>

      {!reciboConfig?.cnpj?.trim() && (
        <p className="mt-2 text-[0.72rem] text-amber-400/90">
          CNPJ não configurado — configure em Cobranças → ⚙️ para aparecer no comprovante.
        </p>
      )}

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={handlePrint}
        submitLabel="Imprimir comprovante"
        submitDisabled={!textoComprovante.trim() || !montarInput()}
      />
    </Modal>
  )
}
