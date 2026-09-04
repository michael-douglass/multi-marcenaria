import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/Field'
import { useCaixaContext } from '@/context/CaixaContext'
import { todayISO, parseMoneyBr } from '@/lib/utils'
import type { TipoMovimentacaoCaixa } from '@/types'

interface RegistrarMovimentacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mesInicial: number
  anoInicial: number
}

export function RegistrarMovimentacaoDialog({ open, onOpenChange, mesInicial, anoInicial }: RegistrarMovimentacaoDialogProps) {
  const { destinatarios, registrarMovimentacao } = useCaixaContext()
  const [destinatarioId, setDestinatarioId] = useState('')
  const [tipo, setTipo] = useState<TipoMovimentacaoCaixa>('reserva')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(todayISO())
  const [mes, setMes] = useState(mesInicial)
  const [ano, setAno] = useState(anoInicial)
  const [descricao, setDescricao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSave = async () => {
    if (!destinatarioId || !valor) return
    setIsSubmitting(true)
    try {
      await registrarMovimentacao({
        destinatario_id: destinatarioId,
        tipo_movimentacao: tipo,
        valor: parseMoneyBr(valor),
        data_movimentacao: data,
        mes_referencia: mes,
        ano_referencia: ano,
        descricao: descricao.trim() || null,
        comprovante_url: null,
        data_vencimento: null
      })
      onOpenChange(false)
      // Reset
      setValor('')
      setDescricao('')
    } catch (err) {
      alert('Erro ao registrar movimentação')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Nova Movimentação"
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo">
            <div className="flex p-1 gap-1 rounded-lg bg-[rgba(42,24,18,0.05)] border border-[rgba(42,24,18,0.09)]">
              <button
                onClick={() => setTipo('reserva')}
                className={`flex-1 py-1.5 text-[0.7rem] font-bold rounded-md transition-all ${
                  tipo === 'reserva' ? 'bg-[#f2d892] text-[#2a1812]' : 'text-[#edd9c4] hover:text-cream'
                }`}
              >
                RESERVA
              </button>
              <button
                onClick={() => setTipo('pagamento')}
                className={`flex-1 py-1.5 text-[0.7rem] font-bold rounded-md transition-all ${
                  tipo === 'pagamento' ? 'bg-red-500 text-white' : 'text-[#edd9c4] hover:text-cream'
                }`}
              >
                PAGAMENTO
              </button>
            </div>
          </Field>

          <Field label="Destinatário">
            <select
              value={destinatarioId}
              onChange={e => setDestinatarioId(e.target.value)}
              className="w-full bg-[rgba(42,24,18,0.05)] border border-[rgba(42,24,18,0.14)] rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
            >
              <option value="">Selecione...</option>
              {destinatarios.map(d => (
                <option key={d.id} value={d.id}>{d.nome} ({d.tipo})</option>
              ))}
            </select>
          </Field>

          <Field label="Valor (R$)">
            <input
              type="text"
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="w-full bg-[rgba(42,24,18,0.05)] border border-[rgba(42,24,18,0.14)] rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
              placeholder="0,00"
            />
          </Field>

          <Field label="Data da Movimentação">
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full bg-[rgba(42,24,18,0.05)] border border-[rgba(42,24,18,0.14)] rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50 appearance-none"
            />
          </Field>

          <Field label="Mês de Referência">
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="w-full bg-[rgba(42,24,18,0.05)] border border-[rgba(42,24,18,0.14)] rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ano de Referência">
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="w-full bg-[rgba(42,24,18,0.05)] border border-[rgba(42,24,18,0.14)] rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
            >
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i
                return <option key={year} value={year}>{year}</option>
              })}
            </select>
          </Field>
        </div>

        <Field label="Descrição / Observação">
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            rows={2}
            className="w-full bg-[rgba(42,24,18,0.05)] border border-[rgba(42,24,18,0.14)] rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
            placeholder="Opcional..."
          />
        </Field>

        <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(42,24,18,0.09)]">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="bg-[#f2d892] text-[#2a1812] hover:bg-[#b88f44]"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
