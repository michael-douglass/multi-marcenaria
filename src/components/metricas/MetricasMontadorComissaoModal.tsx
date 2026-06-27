import { useCallback, useEffect, useState } from 'react'
import { Banknote, CircleDollarSign, Eye, EyeOff } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { toggleComissaoOcultaPrestador } from '@/lib/comissao-prestador'
import { fetchFixoMontadores } from '@/lib/fixo-montador'
import {
  fetchMontadorComissaoObras,
  sumMontadorComissaoObras,
  type MetricasComissaoPeriodo,
  type MontadorComissaoObra,
} from '@/lib/metricas-montador-comissao'
import { fmtCur } from '@/lib/utils'
import type { MetricaObraMontador, MontadorFixoMensal } from '@/types'

const FIXO_STATUS_LABEL: Record<MontadorFixoMensal['status_mes'], string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  sem_fixo: 'Sem fixo',
}

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
  canManageComissao?: boolean
  onClose: () => void
}

function ResumoLinha({
  label,
  valor,
  cor = '#edd9c4',
  destaque = false,
}: {
  label: string
  valor: number
  cor?: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className={destaque ? 'font-bold uppercase tracking-wider text-[#f2d892]' : 'text-[#d4bc9f]'}>
        {label}
      </span>
      <span
        className={`font-mono shrink-0 ${destaque ? 'text-base font-bold text-cream' : 'text-sm font-semibold'}`}
        style={{ color: destaque ? undefined : cor }}
      >
        {valor > 0 ? fmtCur(valor) : '—'}
      </span>
    </div>
  )
}

function ObraLista({
  titulo,
  cor,
  obras,
  vazio,
  canManageComissao,
  togglingObraId,
  onToggleOculto,
}: {
  titulo: string
  cor: string
  obras: MontadorComissaoObra[]
  vazio: string
  canManageComissao?: boolean
  togglingObraId: string | null
  onToggleOculto?: (obra: MontadorComissaoObra) => void
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
          {obras.map(obra => {
            const oculta = !!obra.oculto_prestador
            const isToggling = togglingObraId === obra.obra_id

            return (
              <li
                key={obra.obra_id}
                className={`metricas-comissao-modal__item ${oculta ? 'opacity-70' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold truncate ${oculta ? 'text-[#d4bc9f] line-through' : 'text-cream'}`}>
                      {obra.cliente_nome}
                    </p>
                    {oculta && (
                      <span className="rounded-full border border-[#d4bc9f]/30 bg-[#d4bc9f]/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[#d4bc9f]">
                        Oculta do montador
                      </span>
                    )}
                  </div>
                  <p className="text-[0.65rem] text-[#d4bc9f] mt-0.5 truncate">
                    {obra.tipo_obra_nome ?? 'Obra'}
                    {' · '}
                    {STATUS_LABEL[obra.status_kanban] ?? obra.status_kanban}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-mono text-sm" style={{ color: cor }}>
                    {fmtCur(obra.comissao_valor)}
                  </p>
                  {canManageComissao && onToggleOculto && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm !px-2 !py-1 flex items-center gap-1"
                      disabled={isToggling}
                      title={oculta ? 'Restaurar visibilidade para o montador' : 'Ocultar do montador'}
                      onClick={() => onToggleOculto(obra)}
                    >
                      {oculta ? <Eye size={13} /> : <EyeOff size={13} />}
                      {isToggling ? '…' : oculta ? 'Restaurar' : 'Ocultar'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
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
  canManageComissao = false,
  onClose,
}: Props) {
  const [obras, setObras] = useState<MontadorComissaoObra[]>([])
  const [fixo, setFixo] = useState<MontadorFixoMensal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingObraId, setTogglingObraId] = useState<string | null>(null)

  const loadObras = useCallback(async () => {
    if (!montador) return
    const rows = await fetchMontadorComissaoObras(periodo, montador.montador_id)
    setObras(rows)
  }, [montador, periodo.mes, periodo.ano])

  useEffect(() => {
    if (!open || !montador) {
      setObras([])
      setFixo(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void Promise.all([
      fetchMontadorComissaoObras(periodo, montador.montador_id),
      fetchFixoMontadores(periodo.mes, periodo.ano).catch(() => [] as MontadorFixoMensal[]),
    ])
      .then(([rows, fixos]) => {
        if (cancelled) return
        setObras(rows)
        setFixo(fixos.find(row => row.montador_id === montador.montador_id) ?? null)
      })
      .catch(err => {
        if (!cancelled) {
          setObras([])
          setFixo(null)
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
  const totalComissao = totalConcluida + totalEmAberto
  const valorFixo = fixo?.valor_fixo_mensal ?? 0
  const totalPrevisto = totalComissao + valorFixo
  const totalOculto = obras.filter(o => o.oculto_prestador).reduce((s, o) => s + o.comissao_valor, 0)
  const temConteudo = obras.length > 0 || valorFixo > 0

  const handleToggleOculto = async (obra: MontadorComissaoObra) => {
    if (!montador || !canManageComissao) return
    setTogglingObraId(obra.obra_id)
    setError(null)
    try {
      await toggleComissaoOcultaPrestador(
        obra.obra_id,
        montador.montador_id,
        !obra.oculto_prestador,
      )
      await loadObras()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar visibilidade da comissão.')
    } finally {
      setTogglingObraId(null)
    }
  }

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
          {valorFixo > 0 && (
            <span className="rounded-full border border-[#f2d892]/25 bg-[#f2d892]/10 px-2.5 py-1 text-[#f2d892]">
              Fixo: {fmtCur(valorFixo)}
            </span>
          )}
          <span className="rounded-full border border-cream/20 bg-cream/10 px-2.5 py-1 text-cream">
            Total previsto: {fmtCur(totalPrevisto)}
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
      ) : !temConteudo ? (
        <p className="text-sm text-[#edd9c4] text-center py-6">
          Nenhuma comissão ou fixo registrado para este montador em {periodoLabel}.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="metricas-comissao-modal__resumo">
            <div className="flex items-center gap-2 text-[#f2d892]">
              <CircleDollarSign size={16} />
              <span className="text-xs uppercase tracking-wider font-bold">Total previsto no mês</span>
            </div>
            <p className="font-display text-2xl text-cream mt-1">{fmtCur(totalPrevisto)}</p>

            <div className="mt-3 space-y-2 border-t border-[rgba(240,210,140,0.12)] pt-3">
              <ResumoLinha label="Comissão concluída (a pagar)" valor={totalConcluida} cor="#34d399" />
              <ResumoLinha label="Comissão em aberto" valor={totalEmAberto} cor="#fbbf24" />
              <ResumoLinha label="Subtotal comissões" valor={totalComissao} cor="#edd9c4" />
              <ResumoLinha label="Fixo mensal" valor={valorFixo} cor="#f2d892" />
              <div className="border-t border-[rgba(240,210,140,0.1)] pt-2">
                <ResumoLinha label="Total previsto no mês" valor={totalPrevisto} destaque />
              </div>
            </div>

            {valorFixo > 0 && fixo?.status_mes && fixo.status_mes !== 'sem_fixo' && (
              <p className="text-[0.65rem] text-[#d4bc9f] mt-2">
                Status do fixo em {periodoLabel}:{' '}
                <span className="text-[#f2d892] font-semibold">
                  {FIXO_STATUS_LABEL[fixo.status_mes]}
                </span>
              </p>
            )}

            <p className="text-[0.65rem] text-[#d4bc9f] mt-2">
              {obras.length > 0
                ? `${obras.length} obra(s) com comissão`
                : 'Sem obras com comissão neste período'}
              {valorFixo > 0 && obras.length > 0 && ' · '}
              {valorFixo > 0 && 'inclui fixo mensal'}
              {totalOculto > 0 && canManageComissao && (
                <>
                  {' · '}
                  <span className="text-[#d4bc9f]">
                    {fmtCur(totalOculto)} oculto(s) do montador
                  </span>
                </>
              )}
            </p>
          </div>

          <ObraLista
            titulo="Concluídas — comissão a pagar"
            cor="#34d399"
            obras={concluidas}
            vazio="Nenhuma obra concluída com comissão neste período."
            canManageComissao={canManageComissao}
            togglingObraId={togglingObraId}
            onToggleOculto={handleToggleOculto}
          />

          <ObraLista
            titulo="Em aberto — comissão prevista"
            cor="#fbbf24"
            obras={emAberto}
            vazio="Nenhuma obra em andamento com comissão prevista."
            canManageComissao={canManageComissao}
            togglingObraId={togglingObraId}
            onToggleOculto={handleToggleOculto}
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
