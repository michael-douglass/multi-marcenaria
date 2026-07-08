import { labelPontoTipo } from '@/lib/funcionario-ponto'
import type { PontoMarcacao } from '@/types'

interface Props {
  marcacoes: PontoMarcacao[]
}

export function PontoHistoricoDia({ marcacoes }: Props) {
  if (!marcacoes.length) {
    return (
      <p className="text-sm text-[#b8957f]">Nenhuma batida registrada hoje.</p>
    )
  }

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
              })}
            </div>
            {m.status === 'atraso' && (
              <div className="text-xs text-amber-400">Atraso {m.atraso_minutos} min</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
