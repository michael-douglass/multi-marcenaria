import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ExternalLink, MapPin, UserX } from 'lucide-react'
import { PontoLocalizacaoLabel } from '@/components/ponto/PontoLocalizacaoLabel'
import {
  enrichMarcacaoUrls,
  formatAtrasoMinutos,
  formatHoraPonto,
  googleMapsUrl,
  horaPrevistaPorTipo,
  labelPontoTipo,
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
}

export function PontoHistoricoDia({ marcacoes, jornada, variant = 'compact' }: Props) {
  const [enriched, setEnriched] = useState<PontoMarcacaoComUrls[]>(marcacoes)

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
              {new Date(m.registrado_em).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: PONTO_TIMEZONE,
              })}
              </div>
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
        const realizado = formatHoraPonto(m.registrado_em)
        const hasGeo = m.latitude != null && m.longitude != null

        return (
          <li key={m.id} className="ponto-registro">
            <details className="ponto-registro__details">
              <summary className="ponto-registro__summary">
                <div className="min-w-0 flex-1">
                  <span className="text-[#f2d892]">{labelPontoTipo(m.tipo)}</span>
                  {m.nsr != null && (
                    <span className="ml-2 text-[0.65rem] text-[#b8957f]">NSR {m.nsr}</span>
                  )}
                  <p className="mt-0.5 text-xs text-[#b8957f]">
                    Batido às <span className="text-[#edd9c4]">{realizado}</span>
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
                  <div>
                    <dt>Data e hora completa</dt>
                    <dd>
                      {new Date(m.registrado_em).toLocaleString('pt-BR', {
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
