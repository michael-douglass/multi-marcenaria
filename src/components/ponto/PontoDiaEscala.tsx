import { AlertTriangle, ExternalLink, MapPin, UserX } from 'lucide-react'
import type { CSSProperties } from 'react'
import { PontoLocalizacaoLabel } from '@/components/ponto/PontoLocalizacaoLabel'
import {
  formatAtrasoMinutos,
  formatHoraPonto,
  googleMapsUrl,
  horaPrevistaPorTipo,
  labelPontoTipo,
  PONTO_TIPOS_ORDEM,
} from '@/lib/funcionario-ponto'
import type { PontoControleJornadaResumo, PontoMarcacaoComUrls } from '@/types'

interface Props {
  marcacoes: PontoMarcacaoComUrls[]
  jornada?: PontoControleJornadaResumo | null
  compact?: boolean
}

export function PontoDiaEscala({ marcacoes, jornada, compact = false }: Props) {
  const porTipo = new Map(marcacoes.map(m => [m.tipo, m]))

  return (
    <ol className="ponto-escala space-y-0">
      {PONTO_TIPOS_ORDEM.map((tipo, index) => {
        const marcacao = porTipo.get(tipo)
        const previsto = horaPrevistaPorTipo(tipo, jornada)
        const realizado = formatHoraPonto(marcacao?.registrado_em)
        const hasGeo = marcacao?.latitude != null && marcacao?.longitude != null

        return (
          <li
            key={tipo}
            className={`ponto-escala__item ${marcacao ? 'ponto-escala__item--feito' : 'ponto-escala__item--pendente'}`}
            style={{ '--escala-index': index } as CSSProperties}
          >
            <div className="ponto-escala__head">
              <div className="min-w-0 flex-1">
                <p className="ponto-escala__tipo">{labelPontoTipo(tipo)}</p>
                <p className="ponto-escala__horas">
                  <span className="text-[#b8957f]">Previsto </span>
                  <span className="text-[#edd9c4]">{formatHoraPonto(previsto)}</span>
                  <span className="mx-2 text-[#6b5344]">·</span>
                  <span className="text-[#b8957f]">Real </span>
                  <span className={marcacao ? 'text-[#f2d892]' : 'text-[#6b5344]'}>
                    {marcacao ? realizado : '—'}
                  </span>
                </p>
                {marcacao?.status === 'atraso' && marcacao.atraso_minutos > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle size={12} />
                    Atraso de {formatAtrasoMinutos(marcacao.atraso_minutos)}
                  </p>
                )}
              </div>
              {marcacao?.nsr != null && (
                <span className="ponto-escala__nsr">NSR {marcacao.nsr}</span>
              )}
            </div>

            {marcacao && (
              <div className={`ponto-escala__body ${compact ? 'ponto-escala__body--compact' : ''}`}>
                {hasGeo && (
                  <a
                    href={googleMapsUrl(marcacao.latitude!, marcacao.longitude!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ponto-escala__map"
                  >
                    <MapPin size={14} />
                    <PontoLocalizacaoLabel
                      latitude={marcacao.latitude!}
                      longitude={marcacao.longitude!}
                      precisaoMetros={marcacao.precisao_metros}
                    />
                    <ExternalLink size={12} className="shrink-0 opacity-70" />
                  </a>
                )}

                <div className="ponto-escala__midia">
                  <div className="ponto-escala__thumb">
                    <p>Selfie</p>
                    {marcacao.fotoUrl ? (
                      <img src={marcacao.fotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#6b5344]">
                        <UserX size={compact ? 18 : 24} strokeWidth={1.2} />
                      </div>
                    )}
                  </div>
                  <div className="ponto-escala__thumb ponto-escala__thumb--assinatura">
                    <p>Assinatura</p>
                    {marcacao.assinaturaUrl ? (
                      <img
                        src={marcacao.assinaturaUrl}
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
            )}

            {!marcacao && (
              <p className="ponto-escala__aguardando">
                {index === 0 ? 'Aguardando batida' : 'Ainda não registrado'}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
