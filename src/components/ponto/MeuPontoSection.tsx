import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { PontoHistoricoDia } from '@/components/ponto/PontoHistoricoDia'
import { PontoStatusCard } from '@/components/ponto/PontoStatusCard'
import { formatJornadaResumo } from '@/lib/funcionario-ponto'
import { podeBaterPontoPorTipo } from '@/lib/funcionario-constants'
import { useBaterPonto } from '@/hooks/useBaterPonto'

interface Props {
  funcionarioTipo: string
}

export function MeuPontoSection({ funcionarioTipo }: Props) {
  const { status, loading, error } = useBaterPonto()

  if (!podeBaterPontoPorTipo(funcionarioTipo)) return null

  return (
    <div className="glass-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl text-[#f2d892]">
          <Clock size={20} />
          Meu Ponto
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/bater-ponto" className="btn btn-gold btn-sm">
            Bater ponto
          </Link>
          <Link to="/historico-ponto" className="btn btn-outline btn-sm">
            Ver histórico
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-[#b8957f]">Carregando…</p>}

      {!loading && error && (
        <p className="text-sm text-red-300">{error}</p>
      )}

      {!loading && !error && !status && (
        <p className="text-sm text-[#b8957f]">
          Não foi possível carregar seu ponto. Peça ao RH para verificar seu vínculo e jornada.
        </p>
      )}

      {!loading && status && (
        <div className="space-y-4">
          {status.jornada && (
            <p className="text-sm text-[#edd9c4]">
              Horário: <strong className="text-[#f2d892]">{formatJornadaResumo(status.jornada)}</strong>
            </p>
          )}
          <PontoStatusCard status={status} />
          {status.marcacoes.length > 0 && (
            <div>
              <h3 className="section-label mb-2">Batidas de hoje</h3>
              <PontoHistoricoDia marcacoes={status.marcacoes} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
