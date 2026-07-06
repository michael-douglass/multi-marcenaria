import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import {
  buildCaixaReciboTexto,
  imprimirCaixaReciboTexto,
  type CaixaReciboInput,
} from '@/lib/caixa-recibo-print'
import type { ReciboConfig } from '@/hooks/useReciboConfig'
import type { ReservaConsolidada } from '@/types'
import { fmtCur, todayISO } from '@/lib/utils'

interface CaixaReciboPrintModalProps {
  open: boolean
  reserva: ReservaConsolidada | null
  reciboConfig: ReciboConfig | null
  onClose: () => void
}

export function CaixaReciboPrintModal({
  open,
  reserva,
  reciboConfig,
  onClose,
}: CaixaReciboPrintModalProps) {
  const [valor, setValor] = useState('')
  const [dataPagamento, setDataPagamento] = useState(todayISO())
  const [descricao, setDescricao] = useState('')
  const [textoRecibo, setTextoRecibo] = useState('')

  const montarInput = useCallback((): CaixaReciboInput | null => {
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
    return buildCaixaReciboTexto(input, reciboConfig)
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
    setTextoRecibo(gerarTexto())
  }, [open, reserva, gerarTexto, valor, dataPagamento, descricao, reciboConfig])

  const handlePrint = () => {
    const input = montarInput()
    if (!input || !textoRecibo.trim()) return
    imprimirCaixaReciboTexto(input, textoRecibo, reciboConfig)
    onClose()
  }

  if (!reserva) return null

  return (
    <Modal open={open} onClose={onClose} title="Gerar recibo de pagamento" wide>
      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">Destinatário</p>
        <p className="text-sm font-semibold text-cream">{reserva.destinatario_nome}</p>
        <p className="mt-1 text-[0.72rem] text-[#d4bc9f]">
          Já pago no período: {reserva.total_pago > 0 ? fmtCur(reserva.total_pago) : '—'}
        </p>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Field label="Valor do recibo *">
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

      <Field label="Descrição / referência">
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
          onClick={() => setTextoRecibo(gerarTexto())}
        >
          Atualizar texto do recibo
        </button>
      </div>

      <Field label="Texto do recibo (será impresso com logo e assinatura da empresa)">
        <textarea
          className="glass-input mt-1 min-h-[180px] w-full font-mono text-sm"
          value={textoRecibo}
          onChange={e => setTextoRecibo(e.target.value)}
        />
      </Field>

      {!reciboConfig && (
        <p className="mt-2 text-[0.72rem] text-amber-400/90">
          Recibo não configurado em Cobranças — usando modelo padrão. Configure o CNPJ em Cobranças → ⚙️ para aparecer no documento.
        </p>
      )}

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={handlePrint}
        submitLabel="Imprimir recibo"
        submitDisabled={!textoRecibo.trim() || !montarInput()}
      />
    </Modal>
  )
}
