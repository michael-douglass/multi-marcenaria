import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { agruparRecibosPorMes, reciboPendenteAssinatura, type ReciboMesGrupo } from '@/lib/funcionario-recibos'
import type { FuncionarioRecibo } from '@/types'

interface Props {
  recibos: FuncionarioRecibo[]
  renderRecibo: (recibo: FuncionarioRecibo) => ReactNode
}

export function RecibosPorMesAccordion({ recibos, renderRecibo }: Props) {
  const grupos = useMemo(() => agruparRecibosPorMes(recibos), [recibos])

  const [abertos, setAbertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(grupos.map(g => [g.key, g.abertoPorPadrao])),
  )

  useEffect(() => {
    setAbertos(prev => {
      const next = { ...prev }
      for (const grupo of grupos) {
        if (!(grupo.key in next)) next[grupo.key] = grupo.abertoPorPadrao
      }
      return next
    })
  }, [grupos])

  const toggle = (grupo: ReciboMesGrupo) => {
    setAbertos(prev => ({ ...prev, [grupo.key]: !prev[grupo.key] }))
  }

  return (
    <div className="space-y-3">
      {grupos.map(grupo => {
        const aberto = abertos[grupo.key] ?? grupo.abertoPorPadrao
        const pendentes = grupo.recibos.filter(reciboPendenteAssinatura).length

        return (
          <div
            key={grupo.key}
            className={`overflow-hidden rounded-xl border ${
              grupo.isMesAtual
                ? 'border-[rgba(212,168,83,0.45)] bg-[rgba(212,168,83,0.06)]'
                : 'border-[rgba(212,168,83,0.18)] bg-[rgba(0,0,0,0.15)]'
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              onClick={() => toggle(grupo)}
            >
              <div>
                <p className="font-medium capitalize text-[#f2d892]">
                  {grupo.label}
                  {grupo.isMesAtual && (
                    <span className="ml-2 rounded-full border border-[rgba(212,168,83,0.35)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-[#edd9c4]">
                      Mês atual
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[#b8957f]">
                  {grupo.recibos.length} recibo{grupo.recibos.length !== 1 ? 's' : ''}
                  {pendentes > 0 && ` · ${pendentes} aguardando assinatura`}
                </p>
              </div>
              <ChevronDown
                size={18}
                className={`shrink-0 text-[#b8957f] transition-transform ${aberto ? 'rotate-180' : ''}`}
              />
            </button>

            {aberto && (
              <div className="space-y-2 border-t border-[rgba(212,168,83,0.12)] px-3 pb-3 pt-2">
                {grupo.recibos.length === 0 ? (
                  <p className="px-1 py-4 text-center text-sm text-[#b8957f]">
                    {grupo.isMesAtual
                      ? 'Nenhum recibo neste mês ainda.'
                      : grupo.isFuturo
                        ? 'Nenhum recibo previsto para este mês.'
                        : 'Nenhum recibo neste mês.'}
                  </p>
                ) : (
                  grupo.recibos.map(recibo => (
                    <div key={recibo.id}>{renderRecibo(recibo)}</div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
