import { useEffect, useRef, useState } from 'react'
import {
  CalendarOff,
  Clock,
  FilePlus2,
  Loader2,
  Paperclip,
  Scale,
  Undo2,
  Upload,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import {
  OBS_FALTA_AUTOMATICA,
  faltaDebitaCaixa,
  faltaTemJustificativa,
} from '@/lib/ponto-falta-status'
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
import {
  buildPendingPontoAtestado,
  deletePontoAtestado,
  getPontoAtestadoPreviewUrls,
  listPontoAtestadosDia,
  revokePendingPontoAtestadoUrls,
  uploadPontoAtestado,
} from '@/lib/ponto-atestados'
import { showToast } from '@/lib/toast'
import type { PontoAtestado, PontoFaltaDetalhe, PontoResumoFuncionarioPeriodo } from '@/types'

export interface ResumoPontoFaltaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: PontoResumoFuncionarioPeriodo
  data: string
  canEdit: boolean
  onSuccess: () => void
}

interface AtestadoView extends PontoAtestado {
  previewUrl: string
  previewUrls: string[]
}

type SavingAction =
  | 'desconsiderar'
  | 'justificar'
  | 'folga'
  | 'abono'
  | 'debitar'
  | null

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState<SavingAction>(null)
  const [minutosDia, setMinutosDia] = useState(0)
  const [loadingJornada, setLoadingJornada] = useState(false)
  const [atestados, setAtestados] = useState<AtestadoView[]>([])
  const [loadingAtestados, setLoadingAtestados] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<AtestadoView | null>(null)

  const balanco = calcularBalancoResumoPonto(row)
  const faltaDetalhe: PontoFaltaDetalhe | undefined = resolverFaltasDetalhe(row).find(
    (f) => f.data === data,
  )
  const debitaCaixa = faltaDetalhe ? faltaDebitaCaixa(faltaDetalhe) : true
  const minutosDebito =
    debitaCaixa && faltaDetalhe?.minutos_abatidos != null && faltaDetalhe.minutos_abatidos > 0
      ? faltaDetalhe.minutos_abatidos
      : minutosDia
  /** Ao justificar: devolve os minutos debitados ao saldo. */
  const saldoDepoisJustificar = debitaCaixa
    ? balanco.saldo_minutos + minutosDebito
    : balanco.saldo_minutos
  /** Ao voltar a debitar: tira a carga do dia do saldo. */
  const saldoDepoisDebitar = !debitaCaixa
    ? balanco.saldo_minutos - minutosDia
    : balanco.saldo_minutos

  async function carregarAtestados() {
    setLoadingAtestados(true)
    try {
      const rows = await listPontoAtestadosDia(row.funcionario_id, data)
      const views: AtestadoView[] = await Promise.all(
        rows.map(async (rowA) => {
          const previewUrls = await getPontoAtestadoPreviewUrls(rowA)
          return { ...rowA, previewUrl: previewUrls[0] ?? '', previewUrls }
        }),
      )
      setAtestados(views)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar atestados.', 'error')
      setAtestados([])
    } finally {
      setLoadingAtestados(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const obs = faltaDetalhe?.observacao?.trim() || ''
    setMotivo(obs === OBS_FALTA_AUTOMATICA ? '' : obs)
    setSaving(null)
    setLightbox(null)
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
    void carregarAtestados()
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao abrir o dia
  }, [open, row.funcionario_id, data, faltaDetalhe?.observacao])

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !canEdit || uploading) return
    setUploading(true)
    const pending: Awaited<ReturnType<typeof buildPendingPontoAtestado>>[] = []
    try {
      for (const file of Array.from(files)) {
        pending.push(await buildPendingPontoAtestado(file))
      }
      for (const anexo of pending) {
        await uploadPontoAtestado(row.funcionario_id, data, anexo)
      }
      showToast(
        pending.length === 1 ? 'Atestado anexado.' : `${pending.length} atestados anexados.`,
        'success',
      )
      await carregarAtestados()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível anexar o atestado.', 'error')
    } finally {
      revokePendingPontoAtestadoUrls(pending)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDeleteAtestado(atestado: AtestadoView) {
    if (!canEdit) return
    if (!confirm(`Excluir o atestado "${atestado.nome_arquivo}"?`)) return
    try {
      await deletePontoAtestado(atestado)
      setAtestados((prev) => prev.filter((a) => a.id !== atestado.id))
      if (lightbox?.id === atestado.id) setLightbox(null)
      showToast('Atestado excluído.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir atestado.', 'error')
    }
  }

  async function handleSalvarJustificativa() {
    if (!canEdit || saving) return
    if (!faltaTemJustificativa(motivo) || motivo.trim().length < 3) {
      showToast('Informe o motivo (mínimo 3 caracteres).', 'error')
      return
    }
    setSaving('justificar')
    try {
      await salvarOcorrencia(row.funcionario_id, data, 'falta', {
        observacao: motivo.trim(),
        abaterBancoHoras: false,
      })
      showToast(
        debitaCaixa && minutosDebito > 0
          ? `Justificativa salva. Débito de ${formatMinutosSaldo(minutosDebito)} removido do caixa.`
          : atestados.length > 0
            ? 'Justificativa salva com atestado(s) anexado(s).'
            : 'Justificativa salva. Sem débito no caixa.',
        'success',
      )
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível salvar a justificativa.', 'error')
    } finally {
      setSaving(null)
    }
  }

  async function handleMarcarTipo(tipo: 'folga' | 'abono') {
    if (!canEdit || saving) return
    const obs =
      motivo.trim().length >= 3
        ? motivo.trim()
        : tipo === 'folga'
          ? 'Folga'
          : 'Feriado / abono'
    setSaving(tipo)
    try {
      await salvarOcorrencia(row.funcionario_id, data, tipo, {
        observacao: obs,
        abaterBancoHoras: false,
      })
      showToast(
        tipo === 'folga'
          ? 'Dia marcado como folga. Falta e débito removidos.'
          : 'Dia marcado como abono/feriado. Falta e débito removidos.',
        'success',
      )
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(
        e instanceof Error
          ? e.message
          : tipo === 'folga'
            ? 'Não foi possível marcar como folga.'
            : 'Não foi possível marcar como abono.',
        'error',
      )
    } finally {
      setSaving(null)
    }
  }

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

  async function handleVoltarDebitar() {
    if (!canEdit || saving || debitaCaixa) return
    setSaving('debitar')
    try {
      await salvarOcorrencia(row.funcionario_id, data, 'falta', {
        observacao: OBS_FALTA_AUTOMATICA,
        abaterBancoHoras: true,
      })
      showToast(
        minutosDia > 0
          ? `Débito reativado no caixa (−${formatMinutosSaldo(minutosDia)}).`
          : 'Débito reativado no caixa. A falta volta como injustificada.',
      )
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível reativar o débito.', 'error')
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

        <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-5 py-4">
          {!canEdit && (
            <p className="rounded-lg border border-[#92400e]/25 bg-[#fff7ed] px-3 py-2 text-sm text-[#92400e]">
              Só administrador ou financeiro pode justificar ou desconsiderar. Você pode ver o
              detalhe, mas não alterar.
            </p>
          )}

          {debitaCaixa ? (
            <p className="rounded-lg border border-[#9f1239]/25 bg-[#fff1f2] px-3 py-2 text-sm text-[#9f1239]">
              Esta falta está debitando o caixa
              {minutosDebito > 0 ? ` (−${formatMinutosSaldo(minutosDebito)})` : ''}. Justifique ou
              marque folga/abono para tirar esse negativo.
            </p>
          ) : (
            <p className="rounded-lg border border-[#146c38]/25 bg-[#edf8f1] px-3 py-2 text-sm text-[#146c38]">
              Falta justificada — sem débito no caixa.
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
                  : minutosDebito > 0 || minutosDia > 0
                    ? `−${formatMinutosSaldo(debitaCaixa ? minutosDebito : minutosDia)}`
                    : '0min'}
              </p>
            </div>
          </div>

          {debitaCaixa && minutosDebito > 0 && (
            <p className="text-center text-xs text-[#6b5244]">
              Se justificar: saldo fica{' '}
              <span
                className={
                  'font-semibold tabular-nums ' +
                  (saldoDepoisJustificar >= 0 ? 'text-[#146c38]' : 'text-[#9f1239]')
                }
              >
                {formatMinutosComSinal(saldoDepoisJustificar)}
              </span>
              .
            </p>
          )}

          <div>
            <label
              htmlFor="resumo-ponto-falta-motivo"
              className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]"
            >
              Motivo / justificativa
            </label>
            <textarea
              id="resumo-ponto-falta-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={!canEdit || saving != null}
              placeholder="Ex.: atestado médico, feriado, folga, consulta, ajuste de RH…"
              className={
                'mt-1.5 w-full resize-none rounded-xl border border-[rgba(26,16,12,0.16)] ' +
                'bg-white px-3 py-2.5 text-sm text-[#1a100c] placeholder:text-[#9a8170] ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(107,63,18,0.35)] ' +
                'disabled:cursor-not-allowed disabled:opacity-60'
              }
            />
            <p className="mt-1 text-[0.7rem] text-[#9a8170]">
              Mínimo 3 caracteres. Qualquer texto válido tira o débito do caixa.
            </p>
          </div>

          <div className="rounded-xl border border-[rgba(26,16,12,0.12)] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                  Atestado / comprovante
                </p>
                <p className="mt-0.5 text-[0.7rem] text-[#9a8170]">
                  PDF ou imagem. Sai no final do PDF do resumo, com a data desta falta.
                </p>
              </div>
              {canEdit && (
                <>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => void handleFiles(e.target.files)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={uploading || saving != null}
                    onClick={() => inputRef.current?.click()}
                    className="h-8 gap-1.5 bg-[#f4e4c4] text-[#6b3f12] hover:bg-[#edd9a8]"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {uploading ? 'Enviando…' : 'Anexar'}
                  </Button>
                </>
              )}
            </div>

            {loadingAtestados && (
              <p className="mt-3 text-xs text-[#9a8170]">Carregando anexos…</p>
            )}
            {!loadingAtestados && atestados.length === 0 && (
              <p className="mt-3 text-xs text-[#9a8170]">Nenhum atestado anexado ainda.</p>
            )}
            {!loadingAtestados && atestados.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {atestados.map((a) => (
                  <AnexoThumb
                    key={a.id}
                    previewUrl={a.previewUrl}
                    nome={a.nome_arquivo}
                    kind={a.kind}
                    onOpenFullscreen={() => setLightbox(a)}
                    onDelete={canEdit ? () => void handleDeleteAtestado(a) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[rgba(26,16,12,0.1)] bg-[#faf6f0] px-5 py-4 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            disabled={!canEdit || saving != null}
            onClick={() => void handleSalvarJustificativa()}
            className={
              'h-auto w-full justify-start gap-3 rounded-xl border border-[#146c38]/35 ' +
              'bg-[#edf8f1] px-4 py-3 text-left text-[#146c38] hover:bg-[#dff3e8] disabled:opacity-60'
            }
          >
            {saving === 'justificar' ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Salvar justificativa</span>
              <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                Grava o motivo, mantém a falta na lista e remove o débito do caixa
                {debitaCaixa && minutosDebito > 0
                  ? ` (+${formatMinutosSaldo(minutosDebito)} de volta).`
                  : '.'}
              </span>
            </span>
          </Button>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              disabled={!canEdit || saving != null}
              onClick={() => void handleMarcarTipo('folga')}
              className={
                'h-auto w-full justify-start gap-3 rounded-xl border border-[rgba(26,16,12,0.16)] ' +
                'bg-white px-4 py-3 text-left text-[#1a100c] hover:bg-[#fffaf4] disabled:opacity-60'
              }
            >
              {saving === 'folga' ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <CalendarOff className="h-4 w-4 shrink-0 text-[#6b3f12]" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Marcar como folga</span>
                <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                  Some da lista de faltas e zera o débito.
                </span>
              </span>
            </Button>

            <Button
              type="button"
              disabled={!canEdit || saving != null}
              onClick={() => void handleMarcarTipo('abono')}
              className={
                'h-auto w-full justify-start gap-3 rounded-xl border border-[rgba(26,16,12,0.16)] ' +
                'bg-white px-4 py-3 text-left text-[#1a100c] hover:bg-[#fffaf4] disabled:opacity-60'
              }
            >
              {saving === 'abono' ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <CalendarOff className="h-4 w-4 shrink-0 text-[#6b3f12]" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Abono / feriado</span>
                <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                  Some da lista de faltas e zera o débito.
                </span>
              </span>
            </Button>
          </div>

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

          {!debitaCaixa && (
            <Button
              type="button"
              disabled={!canEdit || saving != null}
              onClick={() => void handleVoltarDebitar()}
              className={
                'h-auto w-full justify-start gap-3 rounded-xl border border-[#92400e]/35 ' +
                'bg-[#fff7ed] px-4 py-3 text-left text-[#92400e] hover:bg-[#ffedd5] ' +
                'disabled:opacity-60'
              }
            >
              {saving === 'debitar' ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Scale className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Voltar a debitar no caixa</span>
                <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-[#6b5244]">
                  Remove a justificativa e debita a carga do dia de novo
                  {minutosDia > 0
                    ? ` (saldo ficaria ${formatMinutosComSinal(saldoDepoisDebitar)}).`
                    : '.'}
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

        <AnexoLightbox
          open={!!lightbox}
          imageUrl={lightbox?.previewUrl ?? ''}
          pages={lightbox?.previewUrls}
          title={lightbox?.nome_arquivo ?? ''}
          kind={lightbox?.kind}
          description={lightbox ? `Referente ao dia ${formatDataLonga(lightbox.data)}` : null}
          onClose={() => setLightbox(null)}
          onDelete={
            lightbox && canEdit ? () => void handleDeleteAtestado(lightbox) : undefined
          }
        />
      </DialogContent>
    </Dialog>
  )
}
