import { useEffect, useMemo, useState } from 'react'
import { Calculator, Loader2, Scale, Wallet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  fetchSaldoAcumuladoPonto,
  formatMinutosComSinal,
  formatMinutosHoraExtra,
  formatMinutosSaldo,
  pagarHoraExtraPonto,
  pontoDataLocal,
} from '@/lib/funcionario-ponto'
import {
  formatDiasEquivalentes,
  minutosParaDiasEquivalentes,
  sugerirValorHora,
  valorPagamentoHoras,
} from '@/lib/ponto-valor-hora'
import { showToast } from '@/lib/toast'
import type { PontoSaldoAcumulado } from '@/types'

export interface ResumoPontoBancoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  funcionarioId: string
  funcionarioNome: string
  canEdit: boolean
  onSuccess: () => void
}

function formatMoney(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseMinutosInput(raw: string): number {
  const n = Math.floor(Number(String(raw).replace(',', '.')) || 0)
  return Math.max(0, n)
}

export function ResumoPontoBancoDialog({
  open,
  onOpenChange,
  funcionarioId,
  funcionarioNome,
  canEdit,
  onSuccess,
}: ResumoPontoBancoDialogProps) {
  const [saldo, setSaldo] = useState<PontoSaldoAcumulado | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passo, setPasso] = useState<'ver' | 'simular'>('ver')
  const [minutosPagar, setMinutosPagar] = useState('')
  const [valorHora, setValorHora] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPasso('ver')
    setError(null)
    setObservacao('')
    setSaving(false)
    const hoje = pontoDataLocal()
    setVencimento(hoje)
    let ativo = true
    setLoading(true)
    void fetchSaldoAcumuladoPonto(funcionarioId)
      .then((data) => {
        if (!ativo) return
        setSaldo(data)
        const sugerido = sugerirValorHora({
          valorFixoMensal: data.valor_fixo_mensal,
          minutosJornadaDia: data.minutos_jornada_ref,
          mesRef: hoje.slice(0, 7),
          diasUteisIso: data.dias_uteis,
        })
        setValorHora(sugerido > 0 ? String(sugerido) : '')
        const disponivel = Math.max(0, data.saldo_minutos)
        setMinutosPagar(disponivel > 0 ? String(disponivel) : '')
      })
      .catch((e) => {
        if (!ativo) return
        setSaldo(null)
        setError(e instanceof Error ? e.message : 'Não foi possível carregar o saldo.')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [open, funcionarioId])

  const minutosNum = parseMinutosInput(minutosPagar)
  const valorHoraNum = Math.max(0, Number(String(valorHora).replace(',', '.')) || 0)
  const valorEstimado = valorPagamentoHoras(minutosNum, valorHoraNum)
  const saldoDisponivel = Math.max(0, saldo?.saldo_minutos ?? 0)
  const saldoDepois = saldoDisponivel - minutosNum
  const sugeridoHint = useMemo(() => {
    if (!saldo) return null
    const s = sugerirValorHora({
      valorFixoMensal: saldo.valor_fixo_mensal,
      minutosJornadaDia: saldo.minutos_jornada_ref,
      mesRef: pontoDataLocal().slice(0, 7),
      diasUteisIso: saldo.dias_uteis,
    })
    return s > 0 ? s : null
  }, [saldo])

  const diasEquiv = saldo
    ? minutosParaDiasEquivalentes(saldo.saldo_minutos, saldo.minutos_jornada_ref)
    : 0

  function usarTodasHoras() {
    setMinutosPagar(String(saldoDisponivel))
  }

  async function handleConfirmarPagamento() {
    if (!canEdit || saving || !saldo) return
    if (minutosNum <= 0) {
      showToast('Informe quantos minutos de HE deseja pagar.', 'error')
      return
    }
    if (minutosNum > saldoDisponivel) {
      showToast(
        `Só há ${formatMinutosSaldo(saldoDisponivel)} disponíveis no banco.`,
        'error',
      )
      return
    }
    if (valorHoraNum <= 0) {
      showToast('Informe o valor por hora (R$).', 'error')
      return
    }
    if (!vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
      showToast('Informe a data de vencimento.', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await pagarHoraExtraPonto({
        funcionarioId,
        minutos: minutosNum,
        valorHora: valorHoraNum,
        dataVencimento: vencimento,
        observacao: observacao.trim() || null,
      })
      showToast(
        `Pagamento gerado: ${formatMoney(result.valor_total)}. Conta a pagar criada; ` +
          `saldo restante ${formatMinutosComSinal(result.saldo_restante_minutos)}.`,
      )
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Não foi possível gerar o pagamento.',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          'max-w-lg gap-0 overflow-hidden border-[rgba(26,16,12,0.14)] bg-[#fffdf9] p-0 ' +
          'text-[#1a100c] shadow-[0_20px_48px_rgba(42,24,18,0.14)] sm:rounded-2xl'
        }
      >
        <DialogHeader className="space-y-1 border-b border-[rgba(26,16,12,0.1)] px-5 py-4 text-left">
          <DialogTitle className="font-display text-xl tracking-wide text-[#1a100c]">
            {passo === 'ver' ? 'Saldo na casa' : 'Simular / pagar horas extras'}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6b5244]">
            <span className="font-semibold text-[#1a100c]">{funcionarioNome}</span>
            {saldo ? (
              <>
                {' · '}
                desde {saldo.inicio.slice(0, 7)} até hoje
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6b5244]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando saldo de todos os meses…
            </div>
          )}

          {!loading && error && (
            <p className="rounded-lg border border-[#9f1239]/25 bg-[#fff1f2] px-3 py-2 text-sm text-[#9f1239]">
              {error}
            </p>
          )}

          {!loading && saldo && passo === 'ver' && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <MiniCard
                  label="Excedentes"
                  value={formatMinutosHoraExtra(saldo.hora_extra_minutos)}
                  tone="pos"
                />
                <MiniCard
                  label="Atrasos"
                  value={
                    saldo.atrasos_minutos > 0
                      ? `−${formatMinutosSaldo(saldo.atrasos_minutos)}`
                      : '0min'
                  }
                  tone="neg"
                />
                <MiniCard
                  label="Faltas abatidas"
                  value={
                    saldo.faltas_banco_minutos > 0
                      ? `−${formatMinutosSaldo(saldo.faltas_banco_minutos)}`
                      : '0min'
                  }
                  tone="neg"
                />
                <MiniCard
                  label="HE já pagas"
                  value={
                    saldo.he_pagas_minutos > 0
                      ? `−${formatMinutosSaldo(saldo.he_pagas_minutos)}`
                      : '0min'
                  }
                  tone="neg"
                />
                <MiniCard
                  label="Saldo líquido"
                  value={formatMinutosComSinal(saldo.saldo_minutos)}
                  tone={saldo.saldo_minutos >= 0 ? 'pos' : 'neg'}
                />
                <MiniCard
                  label="Equivale a"
                  value={formatDiasEquivalentes(diasEquiv)}
                  tone="neutro"
                />
              </div>
              <p className="text-[0.7rem] leading-relaxed text-[#6b5244]">
                Saldo = excedentes − atrasos − faltas abatidas − horas já transformadas em
                pagamento. Um “dia” = {formatMinutosSaldo(saldo.minutos_jornada_ref)} da jornada.
                {saldo.valor_fixo_mensal > 0
                  ? ` Fixo mensal: ${formatMoney(saldo.valor_fixo_mensal)}.`
                  : ' Sem fixo mensal cadastrado — o valor/hora será digitado na hora de pagar.'}
              </p>
            </>
          )}

          {!loading && saldo && passo === 'simular' && (
            <>
              {!canEdit && (
                <p className="rounded-lg border border-[#92400e]/25 bg-[#fff7ed] px-3 py-2 text-sm text-[#92400e]">
                  Só administrador ou financeiro pode gerar o pagamento. Você pode simular os
                  números.
                </p>
              )}

              <div className="rounded-xl border border-[rgba(26,16,12,0.12)] bg-[#faf6f0] p-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]">
                  Disponível no banco
                </p>
                <p className="mt-1 font-display text-lg tabular-nums text-[#146c38]">
                  {formatMinutosComSinal(saldoDisponivel)}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="banco-minutos"
                    className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]"
                  >
                    Minutos a pagar
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      id="banco-minutos"
                      type="number"
                      min={0}
                      max={saldoDisponivel}
                      value={minutosPagar}
                      onChange={(e) => setMinutosPagar(e.target.value)}
                      disabled={saving}
                      className="bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || saldoDisponivel <= 0}
                      onClick={usarTodasHoras}
                      className="shrink-0 border-[rgba(107,63,18,0.3)] text-[#6b3f12]"
                    >
                      Todas
                    </Button>
                  </div>
                  <p className="mt-1 text-[0.7rem] text-[#9a8170]">
                    Ex.: 90 = 1h30. Ou clique em Todas para usar o saldo inteiro.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="banco-valor-hora"
                    className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]"
                  >
                    Valor por hora (R$)
                  </label>
                  <Input
                    id="banco-valor-hora"
                    type="number"
                    min={0}
                    step="0.01"
                    value={valorHora}
                    onChange={(e) => setValorHora(e.target.value)}
                    disabled={saving}
                    className="mt-1.5 bg-white"
                  />
                  {sugeridoHint != null && (
                    <p className="mt-1 text-[0.7rem] text-[#9a8170]">
                      Sugestão pelo fixo ÷ dias úteis do mês: {formatMoney(sugeridoHint)}/h
                      (você pode alterar).
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="banco-vencimento"
                    className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]"
                  >
                    Vencimento da conta
                  </label>
                  <Input
                    id="banco-vencimento"
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    disabled={saving}
                    className="mt-1.5 bg-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="banco-obs"
                    className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]"
                  >
                    Observação (opcional)
                  </label>
                  <textarea
                    id="banco-obs"
                    rows={2}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    disabled={saving}
                    placeholder="Ex.: acerto HE setembro…"
                    className={
                      'mt-1.5 w-full resize-none rounded-xl border border-[rgba(26,16,12,0.16)] ' +
                      'bg-white px-3 py-2.5 text-sm text-[#1a100c] placeholder:text-[#9a8170] ' +
                      'focus-visible:outline-none focus-visible:ring-2 ' +
                      'focus-visible:ring-[rgba(107,63,18,0.35)] disabled:opacity-60'
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MiniCard
                  label="Valor estimado"
                  value={formatMoney(valorEstimado)}
                  tone="neutro"
                />
                <MiniCard
                  label="Saldo depois"
                  value={formatMinutosComSinal(saldoDepois)}
                  tone={saldoDepois >= 0 ? 'pos' : 'neg'}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[rgba(26,16,12,0.1)] bg-[#faf6f0] px-5 py-4 sm:flex-col sm:space-x-0">
          {!loading && saldo && passo === 'ver' && (
            <Button
              type="button"
              disabled={saldoDisponivel <= 0 && !canEdit}
              onClick={() => setPasso('simular')}
              className={
                'h-auto w-full justify-start gap-3 rounded-xl border border-[#146c38]/35 ' +
                'bg-[#edf8f1] px-4 py-3 text-left text-[#146c38] hover:bg-[#dff3e8]'
              }
            >
              <Calculator className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Simular / pagar horas extras</span>
                <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                  Soma horas (todas ou parte) e gera Conta a Pagar — as horas saem do banco.
                </span>
              </span>
            </Button>
          )}

          {!loading && saldo && passo === 'simular' && (
            <>
              <Button
                type="button"
                disabled={!canEdit || saving || minutosNum <= 0 || valorHoraNum <= 0}
                onClick={() => void handleConfirmarPagamento()}
                className={
                  'h-auto w-full justify-start gap-3 rounded-xl border border-[#146c38]/35 ' +
                  'bg-[#edf8f1] px-4 py-3 text-left text-[#146c38] hover:bg-[#dff3e8] ' +
                  'disabled:opacity-60'
                }
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Wallet className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    Confirmar pagamento ({formatMoney(valorEstimado)})
                  </span>
                  <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                    Cria a Conta a Pagar e remove {formatMinutosSaldo(minutosNum)} do banco.
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setPasso('ver')}
                className="w-full border-[rgba(26,16,12,0.16)] text-[#6b5244]"
              >
                <Scale className="mr-2 h-4 w-4" aria-hidden />
                Voltar ao saldo
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="w-full text-[#6b5244] hover:bg-white hover:text-[#1a100c]"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MiniCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'pos' | 'neg' | 'neutro'
}) {
  const cls =
    tone === 'pos'
      ? 'border-[#146c38]/25 bg-[#edf8f1] text-[#146c38]'
      : tone === 'neg'
        ? 'border-[#9f1239]/25 bg-[#fff1f2] text-[#9f1239]'
        : 'border-[rgba(26,16,12,0.14)] bg-[#f7efe4] text-[#6b3f12]'
  return (
    <div className={`rounded-lg border px-2.5 py-2 text-center ${cls}`}>
      <p className="text-[0.55rem] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-display text-sm tabular-nums">{value}</p>
    </div>
  )
}
