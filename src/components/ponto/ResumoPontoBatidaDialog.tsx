import { useEffect, useMemo, useState } from 'react'
import { Loader2, PlusCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TimeInput } from '@/components/ui/TimeInput'
import { PONTO_TIPO_LABEL } from '@/lib/funcionario-constants'
import {
  ajustarMarcacao,
  fetchJornada,
  fetchMarcacoes,
  formatHoraPonto,
  horaPrevistaPorTipo,
  labelPontoTipo,
  marcacaoHoraEfetiva,
  PONTO_TIPOS_ORDEM,
  PONTO_TIMEZONE,
  registrarPontoManual,
} from '@/lib/funcionario-ponto'
import { showToast } from '@/lib/toast'
import type {
  FuncionarioJornada,
  PontoMarcacao,
  PontoMarcacaoTipo,
  PontoResumoFuncionarioPeriodo,
} from '@/types'

export interface ResumoPontoBatidaDialogProps {
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

function diaIsoDaMarcacao(registradoEm: string): string {
  return new Date(registradoEm).toLocaleDateString('en-CA', { timeZone: PONTO_TIMEZONE })
}

const INPUT_CLASS =
  'flex h-10 w-full rounded-md border border-[rgba(26,16,12,0.18)] bg-white px-3 py-2 ' +
  'text-sm text-[#1a100c] shadow-sm outline-none ' +
  'placeholder:text-[#9a8170] focus-visible:ring-2 focus-visible:ring-[rgba(107,63,18,0.35)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

export function ResumoPontoBatidaDialog({
  open,
  onOpenChange,
  row,
  data,
  canEdit,
  onSuccess,
}: ResumoPontoBatidaDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ajustandoId, setAjustandoId] = useState<string | null>(null)
  const [jornada, setJornada] = useState<FuncionarioJornada | null>(null)
  const [marcacoes, setMarcacoes] = useState<PontoMarcacao[]>([])
  const [manualTipo, setManualTipo] = useState<PontoMarcacaoTipo>('entrada')
  const [manualHora, setManualHora] = useState('08:00')
  const [manualMotivo, setManualMotivo] = useState('')
  const [ajusteHora, setAjusteHora] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')
  const [savingAjuste, setSavingAjuste] = useState(false)

  const marcacoesDoDia = useMemo(
    () =>
      marcacoes
        .filter((m) => diaIsoDaMarcacao(m.registrado_em) === data)
        .sort((a, b) => marcacaoHoraEfetiva(a).localeCompare(marcacaoHoraEfetiva(b))),
    [marcacoes, data],
  )

  const tiposJaBatidos = useMemo(() => {
    const set = new Set<PontoMarcacaoTipo>()
    for (const m of marcacoesDoDia) set.add(m.tipo)
    return set
  }, [marcacoesDoDia])

  const tiposDisponiveis = useMemo(
    () => PONTO_TIPOS_ORDEM.filter((t) => !tiposJaBatidos.has(t)),
    [tiposJaBatidos],
  )

  async function carregarDia() {
    setLoading(true)
    try {
      const [jornadaRow, marcacoesRows] = await Promise.all([
        fetchJornada(row.funcionario_id),
        fetchMarcacoes(row.funcionario_id, data, data),
      ])
      setJornada(jornadaRow)
      setMarcacoes(marcacoesRows)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar batidas do dia.', 'error')
      setJornada(null)
      setMarcacoes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setManualMotivo('')
    setAjustandoId(null)
    setAjusteHora('')
    setAjusteMotivo('')
    setSaving(false)
    setSavingAjuste(false)
    void carregarDia()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao abrir o dia
  }, [open, row.funcionario_id, data])

  useEffect(() => {
    if (tiposDisponiveis.length === 0) return
    if (!tiposDisponiveis.includes(manualTipo)) {
      setManualTipo(tiposDisponiveis[0])
    }
  }, [tiposDisponiveis, manualTipo])

  useEffect(() => {
    if (!open) return
    const previsto = horaPrevistaPorTipo(manualTipo, jornada, data)?.slice(0, 5)
    if (previsto) setManualHora(previsto)
  }, [open, manualTipo, jornada, data])

  async function handleRegistrar() {
    if (!canEdit || saving) return
    if (tiposDisponiveis.length === 0) {
      showToast('Todas as batidas deste dia já estão registradas.', 'error')
      return
    }
    if (!manualHora || manualHora.length < 4) {
      showToast('Informe o horário da batida.', 'error')
      return
    }
    if (manualMotivo.trim().length < 3) {
      showToast('Informe o motivo (mínimo 3 caracteres).', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await registrarPontoManual({
        funcionarioId: row.funcionario_id,
        data,
        tipo: manualTipo,
        hora: manualHora,
        motivo: manualMotivo.trim(),
      })
      showToast(
        result?.nsr
          ? `Ponto oficial registrado (NSR ${result.nsr}). A falta automática do dia, se houver, foi removida.`
          : 'Ponto oficial registrado.',
      )
      setManualMotivo('')
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao registrar ponto.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function abrirAjuste(m: PontoMarcacao) {
    setAjustandoId(m.id)
    setAjusteHora(formatHoraPonto(marcacaoHoraEfetiva(m)))
    setAjusteMotivo(m.ajuste_motivo ?? '')
  }

  function cancelarAjuste() {
    setAjustandoId(null)
    setAjusteHora('')
    setAjusteMotivo('')
  }

  async function handleAjustar(marcacaoId: string) {
    if (!canEdit || savingAjuste) return
    if (!ajusteHora || ajusteHora.length < 4) {
      showToast('Informe o horário (hh:mm).', 'error')
      return
    }
    if (ajusteMotivo.trim().length < 3) {
      showToast('Informe o motivo (mínimo 3 caracteres).', 'error')
      return
    }
    setSavingAjuste(true)
    try {
      await ajustarMarcacao(marcacaoId, ajusteHora, ajusteMotivo.trim())
      showToast('Horário ajustado com sucesso.')
      cancelarAjuste()
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao ajustar horário.', 'error')
    } finally {
      setSavingAjuste(false)
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
            Batidas do dia
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6b5244]">
            <span className="font-semibold text-[#1a100c]">{row.nome}</span>
            {' · '}
            <span className="capitalize">{formatDataLonga(data)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,600px)] space-y-4 overflow-y-auto px-5 py-4">
          {!canEdit && (
            <p className="rounded-lg border border-[#92400e]/25 bg-[#fff7ed] px-3 py-2 text-sm text-[#92400e]">
              Só administrador ou financeiro pode lançar ou ajustar batidas. Você pode ver o
              detalhe, mas não alterar.
            </p>
          )}

          <section>
            <h4 className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b5244]">
              Já registradas
            </h4>
            {loading ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-[#6b5244]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando batidas…
              </p>
            ) : marcacoesDoDia.length === 0 ? (
              <p className="mt-2 text-sm text-[#6b5244]">Nenhuma batida neste dia ainda.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {marcacoesDoDia.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-[rgba(26,16,12,0.12)] bg-white px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#1a100c]">
                          {labelPontoTipo(m.tipo)}
                          <span className="ml-2 tabular-nums font-medium text-[#6b3f12]">
                            {formatHoraPonto(marcacaoHoraEfetiva(m))}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[0.7rem] text-[#6b5244]">
                          {m.nsr ? `NSR ${m.nsr}` : 'Sem NSR'}
                          {m.origem === 'rh_manual' ? ' · lançamento oficial' : ''}
                          {m.registrado_em_ajustado ? ' · horário ajustado' : ''}
                        </p>
                      </div>
                      {canEdit && ajustandoId !== m.id && (
                        <button
                          type="button"
                          onClick={() => abrirAjuste(m)}
                          className={
                            'rounded-lg border border-[rgba(107,63,18,0.3)] bg-[#f7efe4] px-2.5 py-1 ' +
                            'text-[0.7rem] font-semibold uppercase tracking-wider text-[#6b3f12] ' +
                            'hover:bg-[#f4e4c4] focus-visible:outline-none focus-visible:ring-2 ' +
                            'focus-visible:ring-[rgba(107,63,18,0.35)]'
                          }
                        >
                          Ajustar
                        </button>
                      )}
                    </div>
                    {ajustandoId === m.id && (
                      <div className="mt-3 space-y-2 border-t border-[rgba(26,16,12,0.08)] pt-3">
                        <label className="block space-y-1">
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b5244]">
                            Novo horário
                          </span>
                          <TimeInput
                            value={ajusteHora}
                            onChange={(v) => setAjusteHora(v ?? '')}
                            className={INPUT_CLASS}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b5244]">
                            Motivo do ajuste
                          </span>
                          <input
                            className={INPUT_CLASS}
                            value={ajusteMotivo}
                            onChange={(e) => setAjusteMotivo(e.target.value)}
                            placeholder="Ex.: correção de horário"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingAjuste}
                            onClick={() => void handleAjustar(m.id)}
                            className="bg-[#6b3f12] text-[#fffdf9] hover:bg-[#5a3410]"
                          >
                            {savingAjuste ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : null}
                            Salvar ajuste
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={savingAjuste}
                            onClick={cancelarAjuste}
                            className="border-[rgba(26,16,12,0.18)] bg-white text-[#1a100c]"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canEdit && (
            <section className="rounded-xl border border-[rgba(107,63,18,0.22)] bg-[#faf6f0] p-3.5">
              <h4 className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-widest text-[#6b3f12]">
                <PlusCircle className="h-3.5 w-3.5" aria-hidden />
                Registrar batida oficial
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-[#6b5244]">
                Mesmo lançamento da pasta do funcionário (Registros). Gera batida oficial com NSR e
                remove falta automática do dia, se existir.
              </p>

              {tiposDisponiveis.length === 0 ? (
                <p className="mt-3 rounded-lg border border-[#146c38]/25 bg-[#edf8f1] px-3 py-2 text-sm text-[#146c38]">
                  Dia completo — as 4 batidas já estão registradas.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b5244]">
                      Tipo de batida
                    </span>
                    <select
                      className={INPUT_CLASS}
                      value={manualTipo}
                      onChange={(e) => setManualTipo(e.target.value as PontoMarcacaoTipo)}
                    >
                      {tiposDisponiveis.map((t) => (
                        <option key={t} value={t}>
                          {PONTO_TIPO_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b5244]">
                      Horário
                    </span>
                    <TimeInput
                      value={manualHora}
                      onChange={(v) => setManualHora(v ?? '')}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b5244]">
                      Motivo
                    </span>
                    <input
                      className={INPUT_CLASS}
                      value={manualMotivo}
                      onChange={(e) => setManualMotivo(e.target.value)}
                      placeholder="Ex.: esqueceu de bater a entrada"
                    />
                  </label>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-[rgba(26,16,12,0.1)] bg-[#f7efe4]/60 px-5 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[rgba(26,16,12,0.18)] bg-white text-[#1a100c]"
          >
            Fechar
          </Button>
          {canEdit && tiposDisponiveis.length > 0 && (
            <Button
              type="button"
              disabled={saving || loading}
              onClick={() => void handleRegistrar()}
              className="bg-[#6b3f12] text-[#fffdf9] hover:bg-[#5a3410]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <PlusCircle className="h-4 w-4" aria-hidden />
              )}
              Registrar batida oficial
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
