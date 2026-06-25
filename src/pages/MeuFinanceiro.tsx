import { useEffect, useState } from 'react'
import { Banknote, Wallet, PiggyBank } from 'lucide-react'
import { usePrestadorFinanceiro } from '@/hooks/usePrestadorFinanceiro'
import { usePrestadorHistoricoMes } from '@/hooks/usePrestadorHistoricoMes'
import { usePrestadorObrasFinalizando } from '@/hooks/usePrestadorObrasFinalizando'
import { PrestadorComparativoChart } from '@/components/meu-financeiro/PrestadorComparativoChart'
import { PrestadorObrasHistorico } from '@/components/meu-financeiro/PrestadorObrasHistorico'
import { PrestadorObrasFinalizando } from '@/components/meu-financeiro/PrestadorObrasFinalizando'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { PRESTADOR_MONTHS_FULL } from '@/lib/prestador-financeiro'
import { fmtCur } from '@/lib/utils'

const MONTHS = [...PRESTADOR_MONTHS_FULL]

export function MeuFinanceiro() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [mesReceber, setMesReceber] = useState(now.getMonth() + 1)
  const [mesRecebidas, setMesRecebidas] = useState(now.getMonth() + 1)

  const { resumo, comparativo, loading, error, reload } = usePrestadorFinanceiro(mes, ano)
  const historicoReceber = usePrestadorHistoricoMes(mesReceber, ano)
  const historicoRecebidas = usePrestadorHistoricoMes(mesRecebidas, ano)
  const obrasFinalizando = usePrestadorObrasFinalizando(mes, ano)

  const anos = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const periodoLabel = `${MONTHS[mes - 1]} ${ano}`

  // Filtro do topo sincroniza os cards na primeira carga ou ao trocar período global
  useEffect(() => {
    setMesReceber(mes)
    setMesRecebidas(mes)
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
              void historicoReceber.reload()
              void historicoRecebidas.reload()
              void obrasFinalizando.reload()
            }}
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
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
                {fmtCur(resumo.totalMes)}
              </p>
              <p className="mt-2 text-sm text-[#edd9c4]">
                <span className="font-semibold text-[#f2d892]">Fixo + Comissão</span>
                {' · '}
                {fmtCur(resumo.totalFixoMes)} fixo + {fmtCur(resumo.totalComissaoMes)} comissão
              </p>
              <p className="mt-1 text-[0.62rem] leading-relaxed text-[#d4bc9f]">
                Todo o recebimento de {periodoLabel} — previsto, gerado e já pago
              </p>
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
              Histórico por mês · resumo geral em {periodoLabel}
            </p>
            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <PrestadorObrasHistorico
                variant="receber"
                titulo="Obras a receber"
                subtitulo="Comissões previstas ou pagamentos ainda não quitados"
                itens={historicoReceber.aReceber}
                loading={historicoReceber.loading}
                mes={mesReceber}
                ano={ano}
                onMesChange={setMesReceber}
                emptyMessage={`Nenhuma obra a receber em ${MONTHS[mesReceber - 1]} ${ano}.`}
              />
              <div className="flex flex-col gap-4">
                <PrestadorObrasHistorico
                  variant="recebidas"
                  titulo="Obras recebidas"
                  subtitulo="Comissões já pagas e confirmadas"
                  itens={historicoRecebidas.recebidas}
                  loading={historicoRecebidas.loading}
                  mes={mesRecebidas}
                  ano={ano}
                  onMesChange={setMesRecebidas}
                  emptyMessage={`Nenhuma obra recebida em ${MONTHS[mesRecebidas - 1]} ${ano}.`}
                />
                <PrestadorObrasFinalizando
                  obras={obrasFinalizando.obras}
                  loading={obrasFinalizando.loading}
                  mes={mes}
                  ano={ano}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
