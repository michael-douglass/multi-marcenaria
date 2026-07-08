import { useMemo, useState } from 'react'
import { Banknote, Wallet, PiggyBank, CalendarCheck, FileSignature } from 'lucide-react'
import { usePrestadorFinanceiro } from '@/hooks/usePrestadorFinanceiro'
import { usePrestadorObrasFinalizando } from '@/hooks/usePrestadorObrasFinalizando'
import { usePrestadorRecibos } from '@/hooks/usePrestadorRecibos'
import { PrestadorComparativoChart } from '@/components/meu-financeiro/PrestadorComparativoChart'
import { PrestadorObrasPrevisao } from '@/components/meu-financeiro/PrestadorObrasPrevisao'
import { PrestadorObrasFinalizando } from '@/components/meu-financeiro/PrestadorObrasFinalizando'
import { PrestadorRecibosTab } from '@/components/funcionarios/PrestadorRecibosTab'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { PRESTADOR_MONTHS_FULL, quintoDiaUtilProximoMes } from '@/lib/prestador-financeiro'
import { sumMontadorComissaoObras } from '@/lib/metricas-montador-comissao'
import { fmtCur, fmtDate } from '@/lib/utils'

const MONTHS = [...PRESTADOR_MONTHS_FULL]

type MeuFinTab = 'resumo' | 'recibos'

export function MeuFinanceiro() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [tab, setTab] = useState<MeuFinTab>('resumo')

  const { resumo, comparativo, loading, error, reload } = usePrestadorFinanceiro(mes, ano)
  const obrasComissao = usePrestadorObrasFinalizando(mes, ano)
  const { pendentes: recibosPendentes } = usePrestadorRecibos()

  const anos = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const periodoLabel = `${MONTHS[mes - 1]} ${ano}`

  const totalPrevisaoComissao = useMemo(
    () => sumMontadorComissaoObras(obrasComissao.previsao),
    [obrasComissao.previsao],
  )
  const totalPrevisaoRecebimento = resumo.totalMes + totalPrevisaoComissao

  const dataDeposito = useMemo(() => {
    const d = quintoDiaUtilProximoMes(mes, ano)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      iso,
      mesLabel: PRESTADOR_MONTHS_FULL[d.getMonth()],
    }
  }, [mes, ano])

  return (
    <div className="fade-in obra-page-shell flex flex-col gap-6 p-1">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-2 text-[2rem] tracking-wide text-[#f2d892]">
            <Banknote size={28} />
            Meu Financeiro
          </h1>
          <p className="section-label mt-1">
            Seu recebimento fixo e comissões de obras — o que já entrou e o que ainda falta receber
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="glass-input !px-3 !py-2 text-sm"
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
          >
            {MONTHS.map((label, i) => (
              <option key={label} value={i + 1}>{label}</option>
            ))}
          </select>
          <select
            className="glass-input !px-3 !py-2 text-sm"
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
          >
            {anos.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline btn-md"
            onClick={() => {
              void reload()
              void obrasComissao.reload()
            }}
          >
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[rgba(212,168,83,0.15)] pb-1">
        <button
          type="button"
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'resumo'
              ? 'border border-b-0 border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.1)] text-[#f2d892]'
              : 'text-[#b8957f] hover:text-[#edd9c4]'
          }`}
          onClick={() => setTab('resumo')}
        >
          Resumo
        </button>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'recibos'
              ? 'border border-b-0 border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.1)] text-[#f2d892]'
              : 'text-[#b8957f] hover:text-[#edd9c4]'
          }`}
          onClick={() => setTab('recibos')}
        >
          <FileSignature size={14} />
          Recibos
          {recibosPendentes.length > 0 && (
            <span className="rounded-full bg-amber-500/25 px-1.5 text-[0.65rem] text-amber-200">
              {recibosPendentes.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'recibos' && <PrestadorRecibosTab />}

      {tab === 'resumo' && loading && <LoadingState />}
      {tab === 'resumo' && !loading && error && <ErrorState message={error} />}

      {tab === 'resumo' && !loading && !error && (
        <>
          {/* Total combinado: fixo + comissão */}
          <div className="glass-card relative overflow-hidden border border-[#f2d892]/25 p-5">
            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[radial-gradient(circle,#f2d892_0%,transparent_70%)] opacity-20" />
            <div className="relative">
              <div className="mb-2 flex items-center gap-2">
                <PiggyBank size={16} className="text-[#f2d892]" />
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
                  Previsão de recebimento
                </p>
              </div>
              <p className="font-display text-3xl text-[#f2d892]">
                {fmtCur(totalPrevisaoRecebimento)}
              </p>
              <p className="mt-2 text-sm text-[#edd9c4]">
                <span className="font-semibold text-[#f2d892]">Fixo + Comissão + Previsão</span>
                {' · '}
                {fmtCur(resumo.totalFixoMes)} fixo + {fmtCur(resumo.totalComissaoMes)} comissão
                {totalPrevisaoComissao > 0 && (
                  <>
                    {' + '}
                    <span className="text-[#fbbf24]">{fmtCur(totalPrevisaoComissao)} previsão</span>
                  </>
                )}
              </p>
              <p className="mt-1 text-[0.62rem] leading-relaxed text-[#d4bc9f]">
                Fixo mensal, comissões de obras concluídas e previsão de obras em andamento em {periodoLabel}
              </p>

              <div
                className="mt-4 flex items-start gap-3 rounded-xl border px-4 py-3.5"
                style={{
                  borderColor: 'rgba(242,216,146,0.35)',
                  background: 'linear-gradient(90deg, rgba(242,216,146,0.14) 0%, rgba(242,216,146,0.04) 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(242,216,146,0.12)',
                }}
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: 'rgba(242,216,146,0.18)',
                    border: '1px solid rgba(242,216,146,0.35)',
                  }}
                >
                  <CalendarCheck size={16} className="text-[#f2d892]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-[#f2d892]">
                    Esse valor será depositado no quinto dia útil do próximo mês.
                  </p>
                  <p className="mt-1 text-[0.72rem] font-medium text-[#edd9c4]">
                    Previsão de depósito: {fmtDate(dataDeposito.iso)} ({dataDeposito.mesLabel})
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo do período selecionado */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                label: 'Gerado — aguardando pagamento',
                value: resumo.totalPendente,
                color: '#f59e0b',
                icon: Wallet,
                hint: 'Já está em Contas a Pagar, mas não foi pago',
              },
              {
                label: 'Já recebido no período',
                value: resumo.totalPago,
                color: '#10b981',
                icon: Banknote,
                hint: 'Pagamentos confirmados',
              },
            ].map(({ label, value, color, icon: Icon, hint }) => (
              <div
                key={label}
                className="glass-card group relative overflow-hidden p-4 transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-20 transition-opacity group-hover:opacity-35"
                  style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
                />
                <div className="relative">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon size={14} style={{ color }} />
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">{label}</p>
                  </div>
                  <p className="font-display text-2xl" style={{ color }}>{fmtCur(value)}</p>
                  <p className="mt-1 text-[0.62rem] leading-relaxed text-[#d4bc9f]">{hint}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico: mês passado recebido × este mês a receber */}
          <PrestadorComparativoChart comparativo={comparativo} />

          {/* Históricos — altura fixa, rolagem e mês independente em cada card */}
          <div>
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#edd9c4]">
              Obras do período · {periodoLabel}
            </p>
            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <PrestadorObrasPrevisao
                obras={obrasComissao.previsao}
                loading={obrasComissao.loading}
                mes={mes}
                ano={ano}
              />
              <PrestadorObrasFinalizando
                obras={obrasComissao.obras}
                loading={obrasComissao.loading}
                mes={mes}
                ano={ano}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
