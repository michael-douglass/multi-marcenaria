import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/Field'
import { useCaixa } from '@/hooks/useCaixa'
import { todayISO, parseMoneyBr, fmtCur } from '@/lib/utils'
import type { ReservaConsolidada } from '@/types'

interface PagarReservaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reserva: ReservaConsolidada | null
}

export function PagarReservaDialog({ open, onOpenChange, reserva }: PagarReservaDialogProps) {
  const { registrarMovimentacao } = useCaixa(reserva?.mes_referencia || 1, reserva?.ano_referencia || 2024)
  const [valor, setValor] = useState('')
  const [data, setData] = useState(todayISO())
  const [descricao, setDescricao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (reserva) {
      const restante = Math.max(0, reserva.valor_total_real - reserva.total_pago)
      setValor(restante.toFixed(2).replace('.', ','))
      setDescricao(`Pagamento ref. ${reserva.mes_referencia}/${reserva.ano_referencia}`)
    }
  }, [reserva])

  const handleSave = async () => {
    if (!reserva || !valor) return
    setIsSubmitting(true)
    try {
      await registrarMovimentacao({
        destinatario_id: reserva.destinatario_id,
        tipo_movimentacao: 'pagamento',
        valor: parseMoneyBr(valor),
        data_movimentacao: data,
        mes_referencia: reserva.mes_referencia,
        ano_referencia: reserva.ano_referencia,
        descricao: descricao.trim() || null,
        comprovante_url: null,
        data_vencimento: null
      })
      onOpenChange(false)
    } catch (err) {
      alert('Erro ao registrar pagamento')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!reserva) return null

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Pagamento"
    >
      <div className="space-y-4">
        <div className="glass-card p-3 bg-white/5 border-white/5 space-y-1">
          <p className="text-[0.65rem] text-[#edd9c4] uppercase font-bold tracking-wider">Destinatário</p>
          <p className="text-sm font-semibold text-cream">{reserva.destinatario_nome}</p>
          <div className="flex justify-between pt-2">
            <div>
              <p className="text-[0.6rem] text-[#edd9c4] uppercase">Total Real</p>
              <p className="text-xs font-mono text-cream/70">{fmtCur(reserva.valor_total_real)}</p>
            </div>
            <div>
              <p className="text-[0.6rem] text-[#edd9c4] uppercase text-right">Falta Pagar</p>
              <p className="text-xs font-mono text-[#f2d892] text-right">
                {fmtCur(Math.max(0, reserva.valor_total_real - reserva.total_pago))}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Valor do Pagamento">
            <input
              type="text"
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
              placeholder="0,00"
            />
          </Field>
          <Field label="Data do Pagamento">
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
            />
          </Field>
        </div>

        <Field label="Descrição">
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="bg-[#f2d892] text-[#2a1812] hover:bg-[#b88f44]"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
