import { useMemo, useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/Field'
import { useCaixaContext } from '@/context/CaixaContext'
import { todayISO, parseMoneyBr, fmtCur, cn } from '@/lib/utils'
import { calcValorAPagarDaReserva } from '@/lib/caixa-valor-a-pagar'
import type { ReservaConsolidada } from '@/types'

export { calcValorAPagarDaReserva } from '@/lib/caixa-valor-a-pagar'

interface PagarReservaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reserva: ReservaConsolidada | null
}

function formatValorInput(valor: number) {
  return valor.toFixed(2).replace('.', ',')
}

export function PagarReservaDialog({ open, onOpenChange, reserva }: PagarReservaDialogProps) {
  const { registrarMovimentacao } = useCaixaContext()
  const [valor, setValor] = useState('')
  const [data, setData] = useState(todayISO())
  const [descricao, setDescricao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const aPagar = useMemo(() => {
    if (!reserva) return 0
    return calcValorAPagarDaReserva(reserva.valor_em_reserva, reserva.total_pago)
  }, [reserva])

  useEffect(() => {
    if (!open || !reserva) return
    setValor(formatValorInput(aPagar))
    setData(todayISO())
    setDescricao(`Pagamento ref. ${reserva.mes_referencia}/${reserva.ano_referencia}`)
  }, [open, reserva, aPagar])

  const handleSave = async () => {
    if (!reserva || !valor) return
    const valorNum = parseMoneyBr(valor)
    if (valorNum <= 0) {
      alert('Informe um valor maior que zero.')
      return
    }
    if (valorNum > aPagar + 0.009) {
      alert(`Valor maior que o disponível na reserva (${fmtCur(aPagar)}).`)
      return
    }
    setIsSubmitting(true)
    try {
      await registrarMovimentacao({
        destinatario_id: reserva.destinatario_id,
        tipo_movimentacao: 'pagamento',
        valor: valorNum,
        data_movimentacao: data,
        mes_referencia: reserva.mes_referencia,
        ano_referencia: reserva.ano_referencia,
        descricao: descricao.trim() || null,
        comprovante_url: null,
        data_vencimento: null,
      })
      onOpenChange(false)
    } catch {
      alert('Erro ao registrar pagamento')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!reserva) return null

  const inputClass =
    'w-full min-h-11 bg-black/20 border border-white/10 rounded-md px-3 py-2.5 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50'

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Registrar Pagamento"
    >
      <div className="space-y-5">
        {/* Resumo da conta */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 space-y-3">
          <div>
            <p className="text-[0.65rem] text-[#edd9c4] uppercase font-bold tracking-wider">
              Destinatário
            </p>
            <p className="text-base font-semibold text-cream mt-0.5 leading-snug">
              {reserva.destinatario_nome}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ResumoChip label="Valor real" valor={reserva.valor_total_real} />
            <ResumoChip label="Reservado" valor={reserva.valor_em_reserva} />
            <ResumoChip label="Já pago" valor={reserva.total_pago} tom="muted" />
            <ResumoChip label="A pagar" valor={aPagar} tom="destaque" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={
              <span className="inline-flex w-full flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span>Valor do pagamento</span>
                <span className="font-mono text-[0.7rem] font-bold normal-case tracking-normal text-[#f2d892]">
                  A pagar: {fmtCur(aPagar)}
                </span>
              </span>
            }
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#edd9c4]">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className={cn(inputClass, 'pl-9 font-mono text-base tabular-nums')}
                placeholder="0,00"
                aria-describedby="pagar-hint"
              />
            </div>
            <p id="pagar-hint" className="mt-1.5 text-[0.7rem] leading-relaxed text-[#edd9c4]/90">
              Preenchido com <strong className="text-cream/90">reservado − já pago</strong>
              {aPagar > 0 ? ` → ${fmtCur(aPagar)}` : ''}.
            </p>
          </Field>

          <Field label="Data do pagamento">
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Descrição">
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-white/5 pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="min-h-11 w-full bg-[#f2d892] text-[#2a1812] hover:bg-[#b88f44] sm:w-auto sm:min-w-[11rem]"
            onClick={() => void handleSave()}
            disabled={isSubmitting || aPagar <= 0}
          >
            {isSubmitting ? 'Salvando…' : `Pagar ${fmtCur(parseMoneyBr(valor) || aPagar)}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ResumoChip({
  label,
  valor,
  tom = 'default',
}: {
  label: string
  valor: number
  tom?: 'default' | 'muted' | 'destaque'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        tom === 'destaque' && 'border-[#f2d892]/35 bg-[#f2d892]/10',
        tom === 'muted' && 'border-white/5 bg-black/20',
        tom === 'default' && 'border-white/8 bg-black/15',
      )}
    >
      <p className="text-[0.58rem] font-bold uppercase tracking-wider text-[#edd9c4]">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-mono text-[0.8rem] font-semibold tabular-nums leading-tight sm:text-[0.85rem]',
          tom === 'destaque' ? 'text-[#f2d892]' : 'text-cream/90',
        )}
      >
        {fmtCur(valor)}
      </p>
    </div>
  )
}
