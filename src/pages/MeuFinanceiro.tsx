import { useState } from 'react'
import { Banknote, Wallet, CircleDollarSign } from 'lucide-react'
import { usePrestadorFinanceiro } from '@/hooks/usePrestadorFinanceiro'
import { PrestadorComparativoChart } from '@/components/meu-financeiro/PrestadorComparativoChart'
import { PrestadorObrasHistorico } from '@/components/meu-financeiro/PrestadorObrasHistorico'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { fmtCur } from '@/lib/utils'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function MeuFinanceiro() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const { resumo, comparativo, loading, error, reload } = usePrestadorFinanceiro(mes, ano)

  const anos = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const periodoLabel = `${MONTHS[mes - 1]} ${ano}`

  return (
    <div className="fade-in obra-page-shell flex flex-col gap-6 p-1">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-2 text-[2rem] tracking-wide text-[#d4a853]">
            <Banknote size={28} />
            Meu Financeiro
          </h1>
          <p className="section-label mt-1">
            Suas comissões de obras — o que já entrou e o que ainda falta receber
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
          <button type="button" className="btn btn-outline btn-md" onClick={() => reload()}>
            Atualizar
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <>
          {/* Resumo do período selecionado */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Previsto no período',
                value: resumo.totalPrevisto,
                color: '#d4a853',
                icon: CircleDollarSign,
                hint: 'Comissão configurada, pagamento ainda não gerado',
              },
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
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#8a6a55]">{label}</p>
                  </div>
                  <p className="font-display text-2xl" style={{ color }}>{fmtCur(value)}</p>
                  <p className="mt-1 text-[0.62rem] leading-relaxed text-[#6b5544]">{hint}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico: mês passado recebido × este mês a receber */}
          <PrestadorComparativoChart comparativo={comparativo} />

          {/* Históricos do período filtrado */}
          <div>
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a6a55]">
              Histórico — {periodoLabel}
            </p>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <PrestadorObrasHistorico
                variant="receber"
                titulo="Obras a receber"
                subtitulo="Comissões previstas ou pagamentos ainda não quitados"
                itens={resumo.aReceber}
                emptyMessage={`Nenhuma obra a receber em ${periodoLabel}.`}
              />
              <PrestadorObrasHistorico
                variant="recebidas"
                titulo="Obras recebidas"
                subtitulo="Comissões já pagas e confirmadas"
                itens={resumo.recebidas}
                emptyMessage={`Nenhuma obra recebida em ${periodoLabel}.`}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
