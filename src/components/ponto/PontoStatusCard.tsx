import { Clock, MapPin } from 'lucide-react'
import { labelPontoTipo, formatAtrasoMinutos, formatJornadaResumo } from '@/lib/funcionario-ponto'
import { PONTO_STATUS_DIA_LABEL } from '@/lib/funcionario-constants'
import type { PontoStatusDiaPayload } from '@/types'

interface Props {
  status: PontoStatusDiaPayload | null
}

export function PontoStatusCard({ status }: Props) {
  if (!status) return null

  const jornadaTxt = formatJornadaResumo(status.jornada)
  const statusLabel = PONTO_STATUS_DIA_LABEL[status.status_dia] ?? status.status_dia

  return (
    <div className="glass-card overflow-hidden border border-[rgba(212,168,83,0.25)] p-0">
      <div className="border-b border-[rgba(212,168,83,0.15)] bg-gradient-to-r from-[rgba(201,160,69,0.12)] to-transparent px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-[#f2d892]">Seu ponto hoje</h2>
          <span className="rounded-full border border-[rgba(212,168,83,0.35)] px-3 py-0.5 text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
            {statusLabel}
          </span>
        </div>
        {jornadaTxt && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#b8957f]">
            <Clock size={14} className="text-[#f2d892]" />
            Jornada: {jornadaTxt}
          </p>
        )}
      </div>
      <div className="space-y-3 p-5">
        {status.proximo_tipo ? (
          <p className="text-[#edd9c4]">
            Próxima batida:{' '}
            <strong className="text-[#f2d892]">{labelPontoTipo(status.proximo_tipo)}</strong>
          </p>
        ) : (
          <p className="text-emerald-300">Todas as batidas de hoje foram registradas.</p>
        )}
        {status.marcacoes.length > 0 && (
          <ul className="space-y-2">
            {status.marcacoes.map(m => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-[rgba(212,168,83,0.15)] bg-[rgba(36,16,8,0.4)] px-3 py-2 text-sm"
              >
                <span className="text-[#edd9c4]">{labelPontoTipo(m.tipo)}</span>
                <span className="text-[#b8957f]">
                  {new Date(m.registrado_em).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {m.status === 'atraso' && (
                    <span className="ml-2 text-amber-400">+{formatAtrasoMinutos(m.atraso_minutos)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {status.ocorrencia && (
          <p className="flex items-center gap-1.5 text-sm text-amber-300">
            <MapPin size={14} />
            Ocorrência registrada: {status.ocorrencia}
          </p>
        )}
      </div>
    </div>
  )
}
