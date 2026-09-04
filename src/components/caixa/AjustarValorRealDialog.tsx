import { useEffect, useMemo, useState } from 'react'
import { fmtCur, parseMoneyBr } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ContaPagarResumoCaixa } from '@/hooks/useCaixa'
import type { ReservaConsolidada } from '@/types'

interface AjustarValorRealDialogProps {
  open: boolean
  reserva: ReservaConsolidada | null
  contas: ContaPagarResumoCaixa[]
  loadingContas?: boolean
  onClose: () => void
  onConfirm: (novoTotal: number) => Promise<void>
}

function statusLabel(status: string): string {
  if (status === 'pago') return 'Pago'
  if (status === 'parcialmente_pago') return 'Parcial'
  return 'Pendente'
}

/**
 * Ajuste do "Valor real" do caixa com referência às contas a pagar do mês.
 */
export function AjustarValorRealDialog({
  open,
  reserva,
  contas,
  loadingContas = false,
  onClose,
  onConfirm,
}: AjustarValorRealDialogProps) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const totalCadastrado = useMemo(
    () => Math.round(contas.reduce((acc, c) => acc + (Number(c.valor_parcela) || 0), 0) * 100) / 100,
    [contas],
  )

  useEffect(() => {
    if (!open || !reserva) return
    const base = totalCadastrado > 0 ? totalCadastrado : reserva.valor_total_real
    setDraft(
      base.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
    setSaving(false)
  }, [open, reserva, totalCadastrado])

  if (!open || !reserva) return null

  const handleConfirm = async () => {
    const parsed = parseMoneyBr(draft)
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert('Informe um valor válido (zero ou positivo).')
      return
    }

    setSaving(true)
    try {
      await onConfirm(Math.round(parsed * 100) / 100)
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível salvar o valor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-[rgba(42,24,18,0.10)] backdrop-blur-sm"
        disabled={saving}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[rgba(42,24,18,0.14)] bg-[#1a1510] p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-cream">Ajustar valor real</h3>
        <p className="mt-1 text-sm text-[#edd9c4]">
          Destinatário: <span className="font-medium text-cream">{reserva.destinatario_nome}</span>
        </p>

        <div className="mt-4 rounded-xl border border-[rgba(42,24,18,0.14)] bg-white/[0.03] p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
            Cadastrado em Contas a Pagar
          </p>
          <p className="mt-1 text-lg font-semibold text-[#f2d892]">{fmtCur(totalCadastrado)}</p>

          {loadingContas ? (
            <p className="mt-2 text-xs text-[#edd9c4]">Carregando lançamentos…</p>
          ) : contas.length === 0 ? (
            <p className="mt-2 text-xs text-[#8a4f06]">
              Nenhum lançamento encontrado em Contas a Pagar neste mês.
            </p>
          ) : (
            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-[color:var(--color-text-primary)]">
              {contas.map(c => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 border-t border-[rgba(42,24,18,0.09)] pt-2 first:border-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[color:var(--color-text-primary)]">
                      {c.descricao?.trim() || 'Sem descrição'}
                    </p>
                    <p className="text-[0.7rem] text-[#edd9c4]">
                      {new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {' · '}
                      {statusLabel(c.status)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[color:var(--color-text-primary)]">{fmtCur(c.valor_parcela)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="mt-4 block text-xs font-medium text-[#edd9c4]">
          Novo valor real
          <input
            type="text"
            inputMode="decimal"
            disabled={saving || contas.length === 0}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleConfirm()
              }
            }}
            className="mt-1.5 w-full rounded-lg border border-[rgba(42,24,18,0.20)] bg-white/5 px-3 py-2 text-right text-sm font-semibold text-cream outline-none focus:border-[#f2d892]/60 focus:ring-1 focus:ring-[#f2d892]/30 disabled:opacity-60"
          />
        </label>
        <p className="mt-2 text-[0.7rem] leading-relaxed text-[#edd9c4]/90">
          Ao salvar, o total das contas a pagar deste destinatário no mês será ajustado para o novo valor.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || contas.length === 0}
            className="bg-[#f2d892] text-[#1a1510] hover:bg-[#f2d892]/90"
            onClick={() => void handleConfirm()}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
