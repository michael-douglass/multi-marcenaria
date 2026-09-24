import { useEffect, useState } from 'react'
import { Clock, Loader2, Scale, Undo2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  calcularBalancoResumoPonto,
  resolverFaltasDetalhe,
} from '@/lib/resumo-ponto-pdf'
import {
  desconsiderarFalta,
  fetchJornada,
  formatMinutosComSinal,
  formatMinutosSaldo,
  minutosJornadaNoDia,
  salvarOcorrencia,
} from '@/lib/funcionario-ponto'
import { showToast } from '@/lib/toast'
import type { PontoFaltaDetalhe, PontoResumoFuncionarioPeriodo } from '@/types'

export interface ResumoPontoFaltaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: PontoResumoFuncionarioPeriodo
  data: string
  canEdit: boolean
  onSuccess: () => void
}

function formatDataLonga(iso: string): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function ResumoPontoFaltaDialog({
  open,
  onOpenChange,
  row,
  data,
  canEdit,
  onSuccess,
}: ResumoPontoFaltaDialogProps) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState<'desconsiderar' | 'abater' | 'reverter' | null>(null)
  const [minutosDia, setMinutosDia] = useState(0)
  const [loadingJornada, setLoadingJornada] = useState(false)

  const balanco = calcularBalancoResumoPonto(row)
  const faltaDetalhe: PontoFaltaDetalhe | undefined = resolverFaltasDetalhe(row).find(
    (f) => f.data === data,
  )
  const jaAbatida = Boolean(faltaDetalhe?.abater_banco_horas)
  const minutosAbater =
    jaAbatida && faltaDetalhe?.minutos_abatidos != null && faltaDetalhe.minutos_abatidos > 0
      ? faltaDetalhe.minutos_abatidos
      : minutosDia
  const saldoDepois = balanco.saldo_minutos - (jaAbatida ? 0 : minutosAbater)

  useEffect(() => {
    if (!open) return
    setMotivo(faltaDetalhe?.observacao?.trim() || '')
    setSaving(null)
    let ativo = true
    setLoadingJornada(true)
    void fetchJornada(row.funcionario_id)
      .then((jornada) => {
        if (!ativo) return
        setMinutosDia(minutosJornadaNoDia(jornada, data))
      })
      .catch(() => {
        if (ativo) setMinutosDia(0)
      })
      .finally(() => {
        if (ativo) setLoadingJornada(false)
      })
    return () => {
      ativo = false
    }
  }, [open, row.funcionario_id, data, faltaDetalhe?.observacao])

  async function handleDesconsiderar() {
    if (!canEdit || saving) return
    if (motivo.trim().length < 3) {
      showToast('Informe o motivo (mínimo 3 caracteres).', 'error')
      return
    }
    setSaving('desconsiderar')
    try {
      const result = await desconsiderarFalta({
        funcionarioId: row.funcionario_id,
        data,
        motivo: motivo.trim(),
      })
      showToast(
        result.nsr_ultimo
          ? `Falta desconsiderada. Ponto pontual lançado (NSR até ${result.nsr_ultimo}).`
          : 'Falta desconsiderada. Ponto pontual lançado nos horários da jornada.',
      )
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível desconsiderar a falta.', 'error')
    } finally {
      setSaving(null)
    }
  }

  async function handleAbater() {
    if (!canEdit || saving || jaAbatida) return
    if (motivo.trim().length < 3) {
      showToast('Informe o motivo (mínimo 3 caracteres).', 'error')
      return
    }
    setSaving('abater')
    try {
      await salvarOcorrencia(row.funcionario_id, data, 'falta', {
        observacao: motivo.trim(),
        abaterBancoHoras: true,
      })
      showToast(
        minutosAbater > 0
          ? `Falta abatida no banco (−${formatMinutosSaldo(minutosAbater)}).`
          : 'Falta justificada e abatida no banco de horas.',
      )
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível abater a falta.', 'error')
    } finally {
      setSaving(null)
    }
  }

  async function handleReverterAbatimento() {
    if (!canEdit || saving || !jaAbatida) return
    if (motivo.trim().length < 3) {
      showToast('Informe o motivo (mínimo 3 caracteres).', 'error')
      return
    }
    setSaving('reverter')
    try {
      await salvarOcorrencia(row.funcionario_id, data, 'falta', {
        observacao: motivo.trim(),
        abaterBancoHoras: false,
      })
      showToast(
        minutosAbater > 0
          ? `Abatimento revertido (+${formatMinutosSaldo(minutosAbater)} de volta ao banco).`
          : 'Abatimento revertido. A falta permanece registrada.',
      )
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Não foi possível reverter o abatimento.',
        'error',
      )
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          'max-w-md gap-0 overflow-hidden border-[rgba(26,16,12,0.14)] bg-[#fffdf9] p-0 ' +
          'text-[#1a100c] shadow-[0_20px_48px_rgba(42,24,18,0.14)] sm:rounded-2xl'
        }
      >
        <DialogHeader className="space-y-1 border-b border-[rgba(26,16,12,0.1)] px-5 py-4 text-left">
          <DialogTitle className="font-display text-xl tracking-wide text-[#1a100c]">
            Tratar falta
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6b5244]">
            <span className="font-semibold text-[#1a100c]">{row.nome}</span>
            {' · '}
            <span className="capitalize">{formatDataLonga(data)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {!canEdit && (
            <p className="rounded-lg border border-[#92400e]/25 bg-[#fff7ed] px-3 py-2 text-sm text-[#92400e]">
              Só administrador ou financeiro pode desconsiderar ou abater. Você pode ver o detalhe,
              mas não alterar.
            </p>
          )}

          {jaAbatida && (
            <p className="rounded-lg border border-[#146c38]/25 bg-[#edf8f1] px-3 py-2 text-sm text-[#146c38]">
              Esta falta já está abatida no banco
              {faltaDetalhe?.minutos_abatidos
                ? ` (−${formatMinutosSaldo(faltaDetalhe.minutos_abatidos)})`
                : ''}
              .
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[#146c38]/25 bg-[#edf8f1] px-2.5 py-2 text-center">
              <p className="text-[0.55rem] font-semibold uppercase tracking-wider text-[#146c38]/80">
                Saldo atual
              </p>
              <p className="mt-1 font-display text-sm tabular-nums text-[#146c38]">
                {formatMinutosComSinal(balanco.saldo_minutos)}
              </p>
            </div>
            <div className="rounded-lg border border-[#9f1239]/25 bg-[#fff1f2] px-2.5 py-2 text-center">
              <p className="text-[0.55rem] font-semibold uppercase tracking-wider text-[#9f1239]/80">
                Carga do dia
              </p>
              <p className="mt-1 font-display text-sm tabular-nums text-[#9f1239]">
                {loadingJornada
                  ? '…'
                  : minutosAbater > 0
                    ? `−${formatMinutosSaldo(minutosAbater)}`
                    : '0min'}
              </p>
            </div>
          </div>

          {!jaAbatida && minutosAbater > 0 && (
            <p className="text-center text-xs text-[#6b5244]">
              Se abater: saldo fica{' '}
              <span
                className={
                  'font-semibold tabular-nums ' +
                  (saldoDepois >= 0 ? 'text-[#146c38]' : 'text-[#9f1239]')
                }
              >
                {formatMinutosComSinal(saldoDepois)}
              </span>
              {saldoDepois < 0 ? ' (fica negativo se as horas extras não cobrirem o dia).' : '.'}
            </p>
          )}

          <div>
            <label
              htmlFor="resumo-ponto-falta-motivo"
              className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]"
            >
              Motivo
            </label>
            <textarea
              id="resumo-ponto-falta-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={!canEdit || saving != null}
              placeholder="Ex.: erro no sistema, atestado, ajuste de RH…"
              className={
                'mt-1.5 w-full resize-none rounded-xl border border-[rgba(26,16,12,0.16)] ' +
                'bg-white px-3 py-2.5 text-sm text-[#1a100c] placeholder:text-[#9a8170] ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(107,63,18,0.35)] ' +
                'disabled:cursor-not-allowed disabled:opacity-60'
              }
            />
            <p className="mt-1 text-[0.7rem] text-[#9a8170]">Mínimo 3 caracteres (registro oficial).</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[rgba(26,16,12,0.1)] bg-[#faf6f0] px-5 py-4 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            disabled={!canEdit || saving != null}
            onClick={() => void handleDesconsiderar()}
            className={
              'h-auto w-full justify-start gap-3 rounded-xl border border-[rgba(107,63,18,0.35)] ' +
              'bg-[#f4e4c4] px-4 py-3 text-left text-[#6b3f12] hover:bg-[#edd9a8] ' +
              'disabled:opacity-60'
            }
          >
            {saving === 'desconsiderar' ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Desconsiderar falta</span>
              <span className="mt-0.5 flex items-start gap-1 text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Lança chegada, almoço, volta e saída — tudo pontual na jornada.
              </span>
            </span>
          </Button>

          {jaAbatida ? (
            <Button
              type="button"
              disabled={!canEdit || saving != null}
              onClick={() => void handleReverterAbatimento()}
              className={
                'h-auto w-full justify-start gap-3 rounded-xl border border-[#92400e]/35 ' +
                'bg-[#fff7ed] px-4 py-3 text-left text-[#92400e] hover:bg-[#ffedd5] ' +
                'disabled:opacity-60'
              }
            >
              {saving === 'reverter' ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Undo2 className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Reverter abatimento</span>
                <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                  Devolve as horas ao banco. A falta continua listada (só tira o desconto).
                </span>
              </span>
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canEdit || saving != null}
              onClick={() => void handleAbater()}
              className={
                'h-auto w-full justify-start gap-3 rounded-xl border border-[#146c38]/35 ' +
                'bg-[#edf8f1] px-4 py-3 text-left text-[#146c38] hover:bg-[#dff3e8] ' +
                'disabled:opacity-60'
              }
            >
              {saving === 'abater' ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Scale className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Abater em horas</span>
                <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                  Mantém a falta e desconta a carga do dia do saldo positivo.
                </span>
              </span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            disabled={saving != null}
            onClick={() => onOpenChange(false)}
            className="w-full text-[#6b5244] hover:bg-white hover:text-[#1a100c]"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
