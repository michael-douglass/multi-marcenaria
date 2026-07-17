import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ExternalLink, Loader2, MapPin, Pencil, UserX } from 'lucide-react'
import { PontoLocalizacaoLabel } from '@/components/ponto/PontoLocalizacaoLabel'
import { TimeInput } from '@/components/ui/TimeInput'
import {
  enrichMarcacaoUrls,
  formatAtrasoMinutos,
  formatHoraPonto,
  googleMapsUrl,
  horaPrevistaPorTipo,
  labelPontoTipo,
  marcacaoHoraEfetiva,
  PONTO_TIMEZONE,
} from '@/lib/funcionario-ponto'
import type {
  FuncionarioJornada,
  PontoControleJornadaResumo,
  PontoMarcacao,
  PontoMarcacaoComUrls,
} from '@/types'

interface Props {
  marcacoes: PontoMarcacao[]
  jornada?: FuncionarioJornada | PontoControleJornadaResumo | null
  /** Lista simples (hoje) ou detalhada expansível (RH). */
  variant?: 'compact' | 'detailed'
  /** Permite RH ajustar horário (só no variant detailed). */
  editable?: boolean
  onAjustarHorario?: (marcacaoId: string, hora: string, motivo: string) => Promise<void>
}

export function PontoHistoricoDia({
  marcacoes,
  jornada,
  variant = 'compact',
  editable = false,
  onAjustarHorario,
}: Props) {
  const [enriched, setEnriched] = useState<PontoMarcacaoComUrls[]>(marcacoes)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [horaEdit, setHoraEdit] = useState('')
  const [motivoEdit, setMotivoEdit] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroEdit, setErroEdit] = useState<string | null>(null)

  useEffect(() => {
    if (variant !== 'detailed') {
      setEnriched(marcacoes)
      return
    }
    let cancelled = false
    void Promise.all(marcacoes.map(m => enrichMarcacaoUrls(m))).then(rows => {
      if (!cancelled) setEnriched(rows)
    })
    return () => { cancelled = true }
  }, [marcacoes, variant])

  const abrirAjuste = (m: PontoMarcacao) => {
    setEditandoId(m.id)
    setHoraEdit(formatHoraPonto(marcacaoHoraEfetiva(m)))
    setMotivoEdit(m.ajuste_motivo ?? '')
    setErroEdit(null)
  }

  const cancelarAjuste = () => {
    setEditandoId(null)
    setHoraEdit('')
    setMotivoEdit('')
    setErroEdit(null)
  }

  const salvarAjuste = async (marcacaoId: string) => {
    if (!onAjustarHorario) return
    if (!horaEdit || horaEdit.length < 4) {
      setErroEdit('Informe o horário (hh:mm).')
      return
    }
    if (motivoEdit.trim().length < 3) {
      setErroEdit('Informe o motivo (mínimo 3 caracteres).')
      return
    }
    setSalvando(true)
    setErroEdit(null)
    try {
      await onAjustarHorario(marcacaoId, horaEdit, motivoEdit.trim())
      cancelarAjuste()
    } catch (e) {
      setErroEdit(e instanceof Error ? e.message : 'Não foi possível ajustar.')
    } finally {
      setSalvando(false)
    }
  }

  if (!marcacoes.length) {
    return (
      <p className="text-sm text-[#b8957f]">Nenhuma batida registrada.</p>
    )
  }

  if (variant === 'compact') {
    return (
      <ul className="space-y-2">
        {marcacoes.map(m => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-lg border border-[rgba(212,168,83,0.15)] px-3 py-2 text-sm"
          >
            <div>
              <span className="text-[#f2d892]">{labelPontoTipo(m.tipo)}</span>
              {m.nsr && (
                <span className="ml-2 text-[0.65rem] text-[#b8957f]">NSR {m.nsr}</span>
              )}
            </div>
            <div className="text-right text-[#edd9c4]">
              <div>
              {new Date(marcacaoHoraEfetiva(m)).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: PONTO_TIMEZONE,
              })}
              </div>
              {m.registrado_em_ajustado && (
                <div className="text-[0.65rem] text-amber-300/90">Ajustado</div>
              )}
              {m.status === 'atraso' && (
                <div className="text-xs text-amber-400">Atraso {formatAtrasoMinutos(m.atraso_minutos)}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="space-y-2">
      {enriched.map(m => {
        const previsto = horaPrevistaPorTipo(m.tipo, jornada)
        const efetivoIso = marcacaoHoraEfetiva(m)
        const realizado = formatHoraPonto(efetivoIso)
        const original = formatHoraPonto(m.registrado_em)
        const temAjuste = Boolean(m.registrado_em_ajustado)
        const hasGeo = m.latitude != null && m.longitude != null
        const editando = editandoId === m.id

        return (
          <li key={m.id} className="ponto-registro">
            <details className="ponto-registro__details" open={editando || undefined}>
              <summary className="ponto-registro__summary">
                <div className="min-w-0 flex-1">
                  <span className="text-[#f2d892]">{labelPontoTipo(m.tipo)}</span>
                  {m.nsr != null && (
                    <span className="ml-2 text-[0.65rem] text-[#b8957f]">NSR {m.nsr}</span>
                  )}
                  <p className="mt-0.5 text-xs text-[#b8957f]">
                    Batido às <span className="text-[#edd9c4]">{realizado}</span>
                    {temAjuste && (
                      <span className="ml-1 text-amber-300/90">(ajustado · original {original})</span>
                    )}
                    {previsto && (
                      <>
                        {' · '}
                        Previsto <span className="text-[#edd9c4]">{formatHoraPonto(previsto)}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.status === 'atraso' && m.atraso_minutos > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle size={12} />
                      +{formatAtrasoMinutos(m.atraso_minutos)}
                    </span>
                  )}
                  <ChevronDown size={16} className="ponto-registro__chevron text-[#b8957f]" />
                </div>
              </summary>

              <div className="ponto-registro__body">
                <dl className="ponto-registro__horarios">
                  <div>
                    <dt>Horário previsto</dt>
                    <dd>{formatHoraPonto(previsto)}</dd>
                  </div>
                  <div>
                    <dt>Horário batido</dt>
                    <dd className="text-[#f2d892]">{realizado}</dd>
                  </div>
                  {temAjuste && (
                    <div>
                      <dt>Horário original</dt>
                      <dd>{original}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Data e hora completa</dt>
                    <dd>
                      {new Date(efetivoIso).toLocaleString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: PONTO_TIMEZONE,
                      })}
                    </dd>
                  </div>
                </dl>

                {temAjuste && m.ajuste_motivo && (
                  <p className="mt-2 text-xs text-[#b8957f]">
                    Motivo do ajuste: <span className="text-[#edd9c4]">{m.ajuste_motivo}</span>
                  </p>
                )}

                {editable && onAjustarHorario && (
                  <div className="mt-3 border-t border-[rgba(212,168,83,0.12)] pt-3">
                    {!editando ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={e => {
                          e.preventDefault()
                          abrirAjuste(m)
                        }}
                      >
                        <Pencil size={14} />
                        Ajustar horário
                      </button>
                    ) : (
                      <div className="space-y-3" onClick={e => e.preventDefault()}>
                        <p className="text-xs text-[#b8957f]">
                          O horário original da batida é preservado. Só a exibição e o atraso são atualizados.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs text-[#b8957f]">
                            Novo horário
                            <TimeInput
                              className="glass-input mt-1"
                              value={horaEdit}
                              onChange={v => setHoraEdit(v ?? '')}
                            />
                          </label>
                          <label className="block text-xs text-[#b8957f]">
                            Motivo
                            <input
                              className="glass-input mt-1"
                              value={motivoEdit}
                              onChange={e => setMotivoEdit(e.target.value)}
                              placeholder="Ex.: correção de saída antecipada"
                            />
                          </label>
                        </div>
                        {erroEdit && (
                          <p className="text-sm text-red-300">{erroEdit}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-gold btn-sm"
                            disabled={salvando}
                            onClick={() => void salvarAjuste(m.id)}
                          >
                            {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
                            Salvar ajuste
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={salvando}
                            onClick={cancelarAjuste}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {hasGeo ? (
                  <a
                    href={googleMapsUrl(m.latitude!, m.longitude!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ponto-escala__map"
                  >
                    <MapPin size={14} />
                    <PontoLocalizacaoLabel
                      latitude={m.latitude!}
                      longitude={m.longitude!}
                      precisaoMetros={m.precisao_metros}
                    />
                    <ExternalLink size={12} className="shrink-0 opacity-70" />
                  </a>
                ) : (
                  <p className="text-xs text-[#b8957f]">Localização não registrada.</p>
                )}

                <div className="ponto-escala__midia">
                  <div className="ponto-escala__thumb">
                    <p>Selfie</p>
                    {m.fotoUrl ? (
                      <img src={m.fotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#6b5344]">
                        <UserX size={24} strokeWidth={1.2} />
                      </div>
                    )}
                  </div>
                  <div className="ponto-escala__thumb ponto-escala__thumb--assinatura">
                    <p>Assinatura</p>
                    {m.assinaturaUrl ? (
                      <img
                        src={m.assinaturaUrl}
                        alt=""
                        className="h-full w-full object-contain bg-[#faf8f5] p-1"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#faf8f5] text-[10px] text-[#c4b8a8]">
                        Sem assinatura
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
