import { useEffect, useState } from 'react'
import { Banknote, CircleDollarSign } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  fetchMontadorComissaoObras,
  sumMontadorComissaoObras,
  type MetricasComissaoPeriodo,
  type MontadorComissaoObra,
} from '@/lib/metricas-montador-comissao'
import { fmtCur } from '@/lib/utils'
import type { MetricaObraMontador } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

interface Props {
  open: boolean
  montador: MetricaObraMontador | null
  periodo: MetricasComissaoPeriodo
  periodoLabel: string
  onClose: () => void
}

function ObraLista({
  titulo,
  cor,
  obras,
  vazio,
}: {
  titulo: string
  cor: string
  obras: MontadorComissaoObra[]
  vazio: string
}) {
  const total = sumMontadorComissaoObras(obras)

  return (
    <section className="metricas-comissao-modal__secao">
      <header className="metricas-comissao-modal__secao-head">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: cor }}>
          {titulo}
        </h3>
        <span className="font-mono text-sm font-semibold" style={{ color: cor }}>
          {total > 0 ? fmtCur(total) : '—'}
        </span>
      </header>

      {obras.length === 0 ? (
        <p className="text-xs text-[#d4bc9f] py-3 px-1">{vazio}</p>
      ) : (
        <ul className="metricas-comissao-modal__lista">
          {obras.map(obra => (
            <li key={obra.obra_id} className="metricas-comissao-modal__item">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-cream truncate">{obra.cliente_nome}</p>
                <p className="text-[0.65rem] text-[#d4bc9f] mt-0.5 truncate">
                  {obra.tipo_obra_nome ?? 'Obra'}
                  {' · '}
                  {STATUS_LABEL[obra.status_kanban] ?? obra.status_kanban}
                </p>
              </div>
              <p className="font-mono text-sm shrink-0" style={{ color: cor }}>
                {fmtCur(obra.comissao_valor)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function MetricasMontadorComissaoModal({
  open,
  montador,
  periodo,
  periodoLabel,
  onClose,
}: Props) {
  const [obras, setObras] = useState<MontadorComissaoObra[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !montador) {
      setObras([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetchMontadorComissaoObras(periodo, montador.montador_id)
      .then(rows => {
        if (!cancelled) setObras(rows)
      })
      .catch(err => {
        if (!cancelled) {
          setObras([])
          setError(err instanceof Error ? err.message : 'Erro ao carregar obras do montador.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, montador, periodo.mes, periodo.ano])

  if (!montador) return null

  const concluidas = obras.filter(o => o.situacao === 'concluida')
  const emAberto = obras.filter(o => o.situacao === 'em_aberto')
  const totalConcluida = sumMontadorComissaoObras(concluidas)
  const totalEmAberto = sumMontadorComissaoObras(emAberto)
  const totalPrevisto = totalConcluida + totalEmAberto

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Comissões — ${montador.montador_nome}`}
      wide
      headerExtra={
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[rgba(240,210,140,0.2)] bg-black/20 px-2.5 py-1 text-[#edd9c4]">
            Período: {periodoLabel}
          </span>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
            A pagar: {fmtCur(totalConcluida)}
          </span>
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-400">
            Em aberto: {fmtCur(totalEmAberto)}
          </span>
          {montador.comissao_gerada > 0 && (
            <span className="rounded-full border border-[#f2d892]/25 bg-[#f2d892]/10 px-2.5 py-1 text-[#f2d892]">
              Gerada no caixa: {fmtCur(montador.comissao_gerada)}
            </span>
          )}
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-[#edd9c4] text-center py-6">Carregando obras de {periodoLabel}…</p>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-6">{error}</p>
      ) : obras.length === 0 ? (
        <p className="text-sm text-[#edd9c4] text-center py-6">
          Nenhuma obra com comissão registrada para este montador em {periodoLabel}.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="metricas-comissao-modal__resumo">
            <div className="flex items-center gap-2 text-[#f2d892]">
              <CircleDollarSign size={16} />
              <span className="text-xs uppercase tracking-wider font-bold">Total previsto no mês</span>
            </div>
            <p className="font-display text-2xl text-cream mt-1">{fmtCur(totalPrevisto)}</p>
            <p className="text-[0.65rem] text-[#d4bc9f] mt-1">
              {obras.length} obra(s) com comissão · clique fora ou ESC para fechar
            </p>
          </div>

          <ObraLista
            titulo="Concluídas — comissão a pagar"
            cor="#34d399"
            obras={concluidas}
            vazio="Nenhuma obra concluída com comissão neste período."
          />

          <ObraLista
            titulo="Em aberto — comissão prevista"
            cor="#fbbf24"
            obras={emAberto}
            vazio="Nenhuma obra em andamento com comissão prevista."
          />

          {montador.comissao_gerada > 0 && (
            <div className="rounded-lg border border-[rgba(240,210,140,0.15)] bg-[rgba(240,210,140,0.05)] px-3 py-2.5 flex items-start gap-2">
              <Banknote size={15} className="text-[#f2d892] shrink-0 mt-0.5" />
              <p className="text-xs text-[#edd9c4]">
                <strong className="text-[#f2d892]">{fmtCur(montador.comissao_gerada)}</strong>
                {' '}já lançados em Contas a Pagar neste mês (podem incluir obras de meses anteriores).
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
