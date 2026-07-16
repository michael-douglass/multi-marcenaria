import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  History,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MONTHS_PT } from '@/lib/date-br'
import {
  clearSimulacao,
  loadSimulacao,
  rotuloCampoAjuste,
  saveSimulacao,
  somarAjustes,
  type SimuladorAjuste,
  type SimuladorAjusteCampo,
  type SimuladorAjusteTipo,
  type SimuladorMes,
} from '@/lib/simulador-caixa-storage'
import { cn, createId, fmtCur, fmtDate } from '@/lib/utils'

export interface MesComparativoSimulador {
  mes: string
  receitas: number
  despesas: number
}

interface SimuladorCaixaCardProps {
  ano: number
  onAnoChange: (ano: number) => void
  anos: number[]
  dataOriginal: MesComparativoSimulador[]
  previsaoRecebimentoOriginal: number
  previsaoDespesasOriginal: number
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function infoProximoMes(): { nome: string; label: string; ano: number } {
  const agora = new Date()
  const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)
  const idx = proximo.getMonth()
  return {
    nome: MONTHS_PT[idx],
    label: MESES_CURTOS[idx],
    ano: proximo.getFullYear(),
  }
}

/** Lança a previsão do próximo mês no card correspondente (ex.: Ago). */
function comPrevisaoLancada(
  meses: SimuladorMes[],
  anoSim: number,
  recebimento: number,
  despesas: number,
): SimuladorMes[] {
  const prox = infoProximoMes()
  if (prox.ano !== anoSim) return meses
  return meses.map(m =>
    m.mes === prox.label
      ? {
          ...m,
          receitas: roundMoney(recebimento),
          despesas: roundMoney(despesas),
        }
      : m,
  )
}

function buildMesesBase(data: MesComparativoSimulador[]): SimuladorMes[] {
  return MESES_CURTOS.map(label => {
    const found = data.find(m => m.mes === label)
    return {
      mes: label,
      receitas: roundMoney(found?.receitas ?? 0),
      despesas: roundMoney(found?.despesas ?? 0),
    }
  })
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function parseMoneyInput(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/[^\d.,]/g, '')
  if (!cleaned) return 0
  // Aceita 101.202,33 ou 101202,33 ou 101202.33
  let normalized = cleaned
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.')
  }
  const n = Number(normalized)
  return roundMoney(n)
}

/** Exibe no padrão BR: 101.202,33 (ponto nos milhares, vírgula nos centavos). */
function moneyInputValue(n: number): string {
  return roundMoney(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function SimuladorCaixaCard({
  ano,
  onAnoChange,
  anos,
  dataOriginal,
  previsaoRecebimentoOriginal,
  previsaoDespesasOriginal,
}: SimuladorCaixaCardProps) {
  const [meses, setMeses] = useState<SimuladorMes[]>(() => buildMesesBase(dataOriginal))
  const [previsaoRecebimento, setPrevisaoRecebimento] = useState(previsaoRecebimentoOriginal)
  const [previsaoDespesas, setPrevisaoDespesas] = useState(previsaoDespesasOriginal)
  const [ajustes, setAjustes] = useState<SimuladorAjuste[]>([])
  /** Quais cards de mês estão com o histórico expandido. */
  const [historicosAbertos, setHistoricosAbertos] = useState<Record<string, boolean>>({})
  /** Painel aberto em um card de mês: qual ação o usuário escolheu. */
  const [painelMes, setPainelMes] = useState<{
    mes: string
    campo: SimuladorAjusteCampo
    tipo: SimuladorAjusteTipo
  } | null>(null)
  const [ajusteTitulo, setAjusteTitulo] = useState('')
  const [ajusteValorDraft, setAjusteValorDraft] = useState('')
  /** true enquanto o usuário editou e ainda não gravamos (debounce). */
  const [isDirty, setIsDirty] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const saveFlashTimer = useRef<number | null>(null)

  const proximo = useMemo(() => infoProximoMes(), [])
  const previsaoNoAnoAtual = proximo.ano === ano

  const markDirty = () => {
    setIsDirty(true)
    setSaveFlash(false)
  }

  // Ao trocar o ano: carrega simulação salva ou dados reais (+ previsão lançada)
  useEffect(() => {
    const saved = loadSimulacao(ano)
    if (saved) {
      const base = buildMesesBase([])
      const carregados = base.map(b => {
        const found = saved.meses.find(m => m.mes === b.mes)
        return found ?? b
      })
      setMeses(
        comPrevisaoLancada(carregados, ano, saved.previsaoRecebimento, saved.previsaoDespesas),
      )
      setPrevisaoRecebimento(saved.previsaoRecebimento)
      setPrevisaoDespesas(saved.previsaoDespesas)
      setAjustes(saved.ajustes ?? [])
    } else {
      setMeses(
        comPrevisaoLancada(
          buildMesesBase(dataOriginal),
          ano,
          previsaoRecebimentoOriginal,
          previsaoDespesasOriginal,
        ),
      )
      setPrevisaoRecebimento(previsaoRecebimentoOriginal)
      setPrevisaoDespesas(previsaoDespesasOriginal)
      setAjustes([])
    }
    setAjusteTitulo('')
    setAjusteValorDraft('')
    setPainelMes(null)
    setHistoricosAbertos({})
    setIsDirty(false)
    setSaveFlash(false)
    // Intencional: só reage à troca de ano; originais sincronizam no efeito abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano])

  // Quando os dados reais do ano chegam (fetch) e não há edição/salvamento, sincroniza
  useEffect(() => {
    if (isDirty) return
    if (loadSimulacao(ano)) return
    setMeses(
      comPrevisaoLancada(
        buildMesesBase(dataOriginal),
        ano,
        previsaoRecebimentoOriginal,
        previsaoDespesasOriginal,
      ),
    )
    setPrevisaoRecebimento(previsaoRecebimentoOriginal)
    setPrevisaoDespesas(previsaoDespesasOriginal)
    setAjustes([])
  }, [ano, dataOriginal, previsaoRecebimentoOriginal, previsaoDespesasOriginal, isDirty])

  // Salva automaticamente no navegador após cada alteração (com pequeno atraso ao digitar)
  useEffect(() => {
    if (!isDirty) return

    const timer = window.setTimeout(() => {
      saveSimulacao({
        ano,
        meses,
        previsaoRecebimento,
        previsaoDespesas,
        ajustes,
      })
      setIsDirty(false)
      setSaveFlash(true)
      if (saveFlashTimer.current != null) window.clearTimeout(saveFlashTimer.current)
      saveFlashTimer.current = window.setTimeout(() => setSaveFlash(false), 1800)
    }, 450)

    return () => window.clearTimeout(timer)
  }, [isDirty, ano, meses, previsaoRecebimento, previsaoDespesas, ajustes])

  useEffect(() => {
    return () => {
      if (saveFlashTimer.current != null) window.clearTimeout(saveFlashTimer.current)
    }
  }, [])

  const linhas = useMemo(() => {
    return meses.map(m => {
      const saldo = m.receitas - m.despesas
      return { ...m, saldo }
    })
  }, [meses])

  const saldoMeses = linhas.reduce((s, m) => s + m.saldo, 0)
  const impactoAjustes = somarAjustes(ajustes)
  const saldoPrevisao = previsaoRecebimento - previsaoDespesas
  // Se o próximo mês (ex.: Ago) já está no ano, a previsão já entrou no card do mês.
  // Se for ano seguinte (ex.: Jan), soma a previsão à parte no caixa.
  const caixaFinal = roundMoney(
    saldoMeses + impactoAjustes + (previsaoNoAnoAtual ? 0 : saldoPrevisao),
  )
  const caixaPositivo = caixaFinal > 0
  const caixaNegativo = caixaFinal < 0

  const ehMesPrevisao = (mes: string) => previsaoNoAnoAtual && mes === proximo.label

  const updateMes = (mes: string, field: 'receitas' | 'despesas', valor: number) => {
    const v = roundMoney(valor)
    setMeses(prev => prev.map(m => (m.mes === mes ? { ...m, [field]: v } : m)))
    if (ehMesPrevisao(mes)) {
      if (field === 'receitas') setPrevisaoRecebimento(v)
      else setPrevisaoDespesas(v)
    }
    markDirty()
  }

  const updatePrevisao = (field: 'receitas' | 'despesas', valor: number) => {
    const v = roundMoney(valor)
    if (field === 'receitas') setPrevisaoRecebimento(v)
    else setPrevisaoDespesas(v)
    if (previsaoNoAnoAtual) {
      setMeses(prev =>
        prev.map(m =>
          m.mes === proximo.label
            ? {
                ...m,
                receitas: field === 'receitas' ? v : m.receitas,
                despesas: field === 'despesas' ? v : m.despesas,
              }
            : m,
        ),
      )
    }
    markDirty()
  }

  const aplicarDeltaNoMes = (
    mes: string,
    campo: SimuladorAjusteCampo,
    tipo: SimuladorAjusteTipo,
    valor: number,
    reverter = false,
  ) => {
    const sinalBase = tipo === 'adicionar' ? 1 : -1
    const sinal = reverter ? -sinalBase : sinalBase
    const atual = meses.find(m => m.mes === mes)
    const novoValorCampo = atual
      ? roundMoney(Math.max(0, atual[campo] + sinal * valor))
      : 0

    setMeses(prev =>
      prev.map(m => {
        if (m.mes !== mes) return m
        return { ...m, [campo]: novoValorCampo }
      }),
    )

    if (ehMesPrevisao(mes) && atual) {
      if (campo === 'receitas') setPrevisaoRecebimento(novoValorCampo)
      else setPrevisaoDespesas(novoValorCampo)
    }
  }

  const abrirPainelMes = (mes: string, campo: SimuladorAjusteCampo, tipo: SimuladorAjusteTipo) => {
    setPainelMes({ mes, campo, tipo })
    setAjusteTitulo('')
    setAjusteValorDraft('')
  }

  const fecharPainelMes = () => {
    setPainelMes(null)
    setAjusteTitulo('')
    setAjusteValorDraft('')
  }

  const confirmarAjusteMes = () => {
    if (!painelMes) return
    const titulo = ajusteTitulo.trim()
    const valor = parseMoneyInput(ajusteValorDraft)
    if (!titulo || valor <= 0) return

    const { mes, campo, tipo } = painelMes
    aplicarDeltaNoMes(mes, campo, tipo, valor)

    const novo: SimuladorAjuste = {
      id: createId(),
      titulo,
      tipo,
      valor,
      criadoEm: new Date().toISOString(),
      mes,
      campo,
    }
    setAjustes(prev => [novo, ...prev])
    fecharPainelMes()
    markDirty()
  }

  const apagarAjuste = (id: string) => {
    const alvo = ajustes.find(a => a.id === id)
    if (!alvo) return
    if (alvo.mes && alvo.campo) {
      aplicarDeltaNoMes(alvo.mes, alvo.campo, alvo.tipo, alvo.valor, true)
    }
    setAjustes(prev => prev.filter(a => a.id !== id))
    markDirty()
  }

  const handleReset = () => {
    clearSimulacao(ano)
    setMeses(
      comPrevisaoLancada(
        buildMesesBase(dataOriginal),
        ano,
        previsaoRecebimentoOriginal,
        previsaoDespesasOriginal,
      ),
    )
    setPrevisaoRecebimento(previsaoRecebimentoOriginal)
    setPrevisaoDespesas(previsaoDespesasOriginal)
    setAjustes([])
    setAjusteTitulo('')
    setAjusteValorDraft('')
    setPainelMes(null)
    setHistoricosAbertos({})
    setIsDirty(false)
    setSaveFlash(false)
  }

  return (
    <Card className="overflow-hidden border-[rgba(240,210,140,0.16)] bg-[rgba(12,7,5,0.65)] backdrop-blur-md">
      <CardHeader className="flex flex-col gap-4 space-y-0 border-b border-[rgba(240,210,140,0.08)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="font-display text-lg tracking-[0.12em] text-[#f2d892]">
            Simulador de Caixa
          </CardTitle>
          <CardDescription className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#edd9c4]/60">
            Edite faturamento e gastos · salva sozinho neste navegador
          </CardDescription>
          {isDirty && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">
              Salvando…
            </p>
          )}
          {saveFlash && !isDirty && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Salvo automaticamente
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2 sm:justify-end">
          <label className="flex flex-col items-start gap-1 sm:items-end">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#edd9c4]/45">Ano</span>
            <select
              value={ano}
              onChange={e => onAnoChange(Number(e.target.value))}
              className={cn(
                'rounded-md border border-[rgba(240,210,140,0.28)] bg-[rgba(0,0,0,0.35)]',
                'px-2.5 py-1.5 text-xs font-semibold tracking-wide text-[#f2d892] outline-none',
                'transition-colors hover:border-[rgba(240,210,140,0.45)] focus:border-[#f2d892]',
              )}
            >
              {anos.map(a => (
                <option key={a} value={a} className="bg-[#2a1812]">
                  {a}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleReset}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-[rgba(240,210,140,0.25)]',
              'bg-[rgba(0,0,0,0.3)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#edd9c4]',
              'transition-colors hover:border-[rgba(240,210,140,0.45)] hover:text-[#f2d892]',
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-5 py-5">
        <div className="relative overflow-hidden rounded-xl border border-[rgba(240,210,140,0.22)] bg-[rgba(242,216,146,0.06)] px-4 py-4 sm:px-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-50 blur-2xl"
            style={{
              background:
                saldoPrevisao < 0
                  ? 'radial-gradient(circle, rgba(248,113,113,0.35), transparent 70%)'
                  : 'radial-gradient(circle, rgba(242,216,146,0.35), transparent 70%)',
            }}
          />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.25)] bg-[rgba(0,0,0,0.28)]">
                <CalendarClock className="h-4 w-4 text-[#f2d892]" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#edd9c4]/70">
                  Previsão do próximo mês
                </p>
                <p className="font-display text-2xl tracking-[0.08em] text-[#f2d892]">
                  {proximo.nome.toUpperCase()} {proximo.ano}
                </p>
                <p className="mt-1 text-xs text-[#edd9c4]/70">
                  {previsaoNoAnoAtual
                    ? `Já lançada no card ${proximo.label} e no total do caixa.`
                    : 'Entra no total do caixa (mês fora deste ano).'}
                </p>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-xl">
              <MoneyField
                label="Recebimento"
                value={previsaoRecebimento}
                onChange={v => updatePrevisao('receitas', v)}
                tone="in"
              />
              <MoneyField
                label="Despesas"
                value={previsaoDespesas}
                onChange={v => updatePrevisao('despesas', v)}
                tone="out"
              />
              <SaldoBadge label="Saldo previsto" saldo={saldoPrevisao} />
            </div>
          </div>
        </div>

        <div>
          <p className="font-display text-base tracking-[0.14em] text-[#f2d892]">
            MESES · {ano}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[#edd9c4]/60">
            Edite ou use +/− · saldo ao vivo · salva sozinho
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {linhas.map((m, i) => {
            const isPos = m.saldo > 0
            const isNeg = m.saldo < 0
            const sinal = isPos ? 'Positivo' : isNeg ? 'Negativo' : 'Zerado'
            const SaldoIcon = isNeg ? ArrowDownRight : ArrowUpRight
            const isPrevisao = ehMesPrevisao(m.mes)
            const ajustesDoMes = ajustes.filter(a => a.mes === m.mes)
            const historicoAberto = Boolean(historicosAbertos[m.mes])

            return (
              <article
                key={m.mes}
                className={cn(
                  'dash-card-enter relative overflow-hidden rounded-lg border px-3.5 py-3',
                  isPrevisao
                    ? 'border-[rgba(242,216,146,0.35)] bg-[rgba(242,216,146,0.08)]'
                    : 'border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.28)]',
                )}
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <div
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[2px]"
                  style={{
                    background: isNeg
                      ? 'linear-gradient(180deg, #f87171, rgba(248,113,113,0.15))'
                      : 'linear-gradient(180deg, #34d399, rgba(52,211,153,0.15))',
                  }}
                />

                <header className="mb-2.5 flex items-center justify-between gap-2 pl-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h4 className="font-display text-lg tracking-[0.08em] text-[#f2d892]">{m.mes}</h4>
                    {isPrevisao && (
                      <span className="rounded border border-[rgba(242,216,146,0.35)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#f2d892]">
                        Previsão
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]',
                      isNeg
                        ? 'border-red-400/30 bg-red-500/10 text-red-300'
                        : isPos
                          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-[rgba(240,210,140,0.25)] bg-[rgba(240,210,140,0.06)] text-[#f2d892]',
                    )}
                  >
                    <SaldoIcon className="h-3 w-3" aria-hidden />
                    {sinal}
                  </span>
                </header>

                <div className="space-y-2 pl-1">
                  <MoneyField
                    label="Recebidos"
                    value={m.receitas}
                    onChange={v => updateMes(m.mes, 'receitas', v)}
                    tone="in"
                    compact
                  />
                  <MoneyField
                    label="Gastos"
                    value={m.despesas}
                    onChange={v => updateMes(m.mes, 'despesas', v)}
                    tone="out"
                    compact
                  />

                  {/* Ações rápidas: adicionar / remover no mês */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => abrirPainelMes(m.mes, 'receitas', 'adicionar')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-emerald-400/30',
                        'bg-emerald-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300',
                        'transition-colors hover:bg-emerald-500/20',
                        painelMes?.mes === m.mes &&
                          painelMes.campo === 'receitas' &&
                          painelMes.tipo === 'adicionar' &&
                          'ring-1 ring-emerald-400/50',
                      )}
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      Recebido
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirPainelMes(m.mes, 'receitas', 'remover')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-red-400/30',
                        'bg-red-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-red-300',
                        'transition-colors hover:bg-red-500/20',
                        painelMes?.mes === m.mes &&
                          painelMes.campo === 'receitas' &&
                          painelMes.tipo === 'remover' &&
                          'ring-1 ring-red-400/50',
                      )}
                    >
                      <Minus className="h-3 w-3" aria-hidden />
                      Recebido
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirPainelMes(m.mes, 'despesas', 'adicionar')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-amber-400/30',
                        'bg-amber-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-200',
                        'transition-colors hover:bg-amber-500/20',
                        painelMes?.mes === m.mes &&
                          painelMes.campo === 'despesas' &&
                          painelMes.tipo === 'adicionar' &&
                          'ring-1 ring-amber-400/50',
                      )}
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      Gasto
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirPainelMes(m.mes, 'despesas', 'remover')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-[rgba(240,210,140,0.28)]',
                        'bg-[rgba(240,210,140,0.06)] px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#f2d892]',
                        'transition-colors hover:bg-[rgba(240,210,140,0.12)]',
                        painelMes?.mes === m.mes &&
                          painelMes.campo === 'despesas' &&
                          painelMes.tipo === 'remover' &&
                          'ring-1 ring-[rgba(242,216,146,0.55)]',
                      )}
                    >
                      <Minus className="h-3 w-3" aria-hidden />
                      Gasto
                    </button>
                  </div>

                  {painelMes?.mes === m.mes && (
                    <div className="mt-1 space-y-2 rounded-md border border-[rgba(240,210,140,0.2)] bg-[rgba(242,216,146,0.05)] p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#f2d892]">
                        {painelMes.tipo === 'adicionar' ? 'Adicionar' : 'Remover'}{' '}
                        {rotuloCampoAjuste(painelMes.campo).toLowerCase()}
                      </p>
                      <label className="block">
                        <span className="text-[9px] uppercase tracking-[0.12em] text-[#edd9c4]/60">
                          Título
                        </span>
                        <input
                          type="text"
                          value={ajusteTitulo}
                          onChange={e => setAjusteTitulo(e.target.value)}
                          placeholder="Ex.: Extra, Correção…"
                          maxLength={80}
                          className={cn(
                            'mt-0.5 w-full rounded border border-[rgba(240,210,140,0.18)] bg-[rgba(0,0,0,0.35)]',
                            'px-2 py-1.5 text-xs text-[#fffaf4] outline-none placeholder:text-[#edd9c4]/35',
                            'focus:border-[rgba(242,216,146,0.55)]',
                          )}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[9px] uppercase tracking-[0.12em] text-[#edd9c4]/60">
                          Valor
                        </span>
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-[#f2d892]">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ajusteValorDraft}
                            onChange={e => setAjusteValorDraft(e.target.value)}
                            onBlur={() => {
                              const n = roundMoney(parseMoneyInput(ajusteValorDraft))
                              setAjusteValorDraft(n > 0 ? moneyInputValue(n) : '')
                            }}
                            placeholder="0,00"
                            className={cn(
                              'w-full min-w-0 rounded border border-[rgba(240,210,140,0.18)] bg-[rgba(0,0,0,0.35)]',
                              'px-2 py-1.5 text-xs font-semibold tabular-nums text-[#fffaf4] outline-none',
                              'focus:border-[rgba(242,216,146,0.55)]',
                            )}
                          />
                        </div>
                      </label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={fecharPainelMes}
                          className={cn(
                            'flex-1 rounded-md border border-[rgba(240,210,140,0.2)] px-2 py-1.5',
                            'text-[9px] font-bold uppercase tracking-[0.12em] text-[#edd9c4]/80',
                            'hover:text-[#f2d892]',
                          )}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={confirmarAjusteMes}
                          disabled={!ajusteTitulo.trim() || parseMoneyInput(ajusteValorDraft) <= 0}
                          className={cn(
                            'flex-1 rounded-md border border-[rgba(242,216,146,0.4)] bg-[rgba(242,216,146,0.12)]',
                            'px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#f2d892]',
                            'hover:bg-[rgba(242,216,146,0.2)] disabled:cursor-not-allowed disabled:opacity-40',
                          )}
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    className="my-1 h-px"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, rgba(240,210,140,0.3) 30%, rgba(240,210,140,0.3) 70%, transparent)',
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[#edd9c4]/80">
                      Saldo final
                    </span>
                    <span
                      className={cn(
                        'font-display text-base tracking-wide tabular-nums',
                        isNeg ? 'text-red-400' : 'text-emerald-400',
                      )}
                    >
                      {fmtCur(m.saldo)}
                    </span>
                  </div>

                  {ajustesDoMes.length > 0 && (
                    <div className="mt-1 overflow-hidden rounded-md border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.2)]">
                      <button
                        type="button"
                        onClick={() =>
                          setHistoricosAbertos(prev => ({
                            ...prev,
                            [m.mes]: !prev[m.mes],
                          }))
                        }
                        aria-expanded={historicoAberto}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left',
                          'transition-colors hover:bg-[rgba(242,216,146,0.06)]',
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <History className="h-3 w-3 text-[#f2d892]/80" aria-hidden />
                          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#edd9c4]/80">
                            Histórico
                          </span>
                          <span className="rounded border border-[rgba(240,210,140,0.25)] px-1 py-px text-[8px] font-semibold tabular-nums text-[#f2d892]">
                            {ajustesDoMes.length}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-[#f2d892]/70 transition-transform duration-200',
                            historicoAberto && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>

                      <div
                        className={cn(
                          'grid transition-[grid-template-rows] duration-300 ease-out',
                          historicoAberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                        )}
                      >
                        <div className="overflow-hidden">
                          <ul className="divide-y divide-[rgba(240,210,140,0.08)] border-t border-[rgba(240,210,140,0.1)]">
                            {ajustesDoMes.map(a => {
                              const isAdd = a.tipo === 'adicionar'
                              return (
                                <li
                                  key={a.id}
                                  className="flex items-center gap-2 px-2 py-2 animate-in fade-in slide-in-from-top-1 duration-200"
                                >
                                  <span
                                    className={cn(
                                      'flex h-6 w-6 shrink-0 items-center justify-center rounded border',
                                      isAdd
                                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                        : 'border-red-400/30 bg-red-500/10 text-red-300',
                                    )}
                                    aria-hidden
                                  >
                                    {isAdd ? (
                                      <Plus className="h-3 w-3" />
                                    ) : (
                                      <Minus className="h-3 w-3" />
                                    )}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-[#fffaf4]">
                                      {a.titulo}
                                    </p>
                                    <p className="text-[9px] text-[#edd9c4]/50">
                                      {rotuloCampoAjuste(a.campo)} ·{' '}
                                      {isAdd ? 'Adicionado' : 'Removido'} · {fmtDate(a.criadoEm)}
                                    </p>
                                  </div>
                                  <p
                                    className={cn(
                                      'shrink-0 text-xs font-semibold tabular-nums',
                                      isAdd ? 'text-emerald-400' : 'text-red-400',
                                    )}
                                  >
                                    {isAdd ? '+' : '−'}
                                    {fmtCur(a.valor)}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => apagarAjuste(a.id)}
                                    aria-label={`Apagar ajuste ${a.titulo}`}
                                    className={cn(
                                      'flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[rgba(240,210,140,0.2)]',
                                      'text-[#edd9c4]/70 transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300',
                                    )}
                                  >
                                    <Trash2 className="h-3 w-3" aria-hidden />
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <div
          className={cn(
            'relative overflow-hidden rounded-xl border px-4 py-4 sm:px-5',
            caixaNegativo
              ? 'border-red-400/25 bg-red-950/20'
              : caixaPositivo
                ? 'border-emerald-400/25 bg-emerald-950/15'
                : 'border-[rgba(240,210,140,0.2)] bg-[rgba(242,216,146,0.05)]',
          )}
          role="status"
          aria-label={`Caixa simulado em ${ano}`}
        >
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(0,0,0,0.25)]">
                <Wallet className="h-4 w-4 text-[#f2d892]" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#edd9c4]/75">
                  Como está o caixa · {ano}
                </p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[#edd9c4]/80">
                  Meses simulados
                  {previsaoNoAnoAtual
                    ? ` (inclui previsão de ${proximo.label})`
                    : ` + previsão ${proximo.nome} (${fmtCur(saldoPrevisao)})`}
                  {impactoAjustes !== 0
                    ? ` + ajustes gerais (${impactoAjustes > 0 ? '+' : ''}${fmtCur(impactoAjustes)})`
                    : ''}
                  .
                  {caixaPositivo && ' Cenário no azul.'}
                  {caixaNegativo && ' Cenário no vermelho.'}
                  {!caixaPositivo && !caixaNegativo && ' Cenário zerado.'}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                  caixaNegativo
                    ? 'border-red-400/30 bg-red-500/10 text-red-300'
                    : caixaPositivo
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-[rgba(240,210,140,0.25)] text-[#f2d892]',
                )}
              >
                {caixaNegativo ? (
                  <ArrowDownRight className="h-3 w-3" aria-hidden />
                ) : (
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                )}
                {caixaPositivo ? 'Positivo' : caixaNegativo ? 'Negativo' : 'Zerado'}
              </p>
              <p
                className={cn(
                  'mt-1.5 font-display text-2xl tracking-[0.04em] tabular-nums sm:text-3xl',
                  caixaNegativo ? 'text-red-400' : 'text-emerald-400',
                )}
              >
                {fmtCur(caixaFinal)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MoneyField({
  label,
  value,
  onChange,
  tone,
  compact,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  tone: 'in' | 'out'
  compact?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(moneyInputValue(value))

  useEffect(() => {
    if (!focused) setDraft(moneyInputValue(value))
  }, [value, focused])

  return (
    <label
      className={cn(
        'block',
        !compact && 'rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5',
      )}
    >
      <span className="text-[9px] uppercase tracking-[0.14em] text-[#edd9c4]/65">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <span
          className={cn(
            'shrink-0 text-xs font-semibold',
            tone === 'in' ? 'text-[#c8f0d8]' : 'text-[#f0c4b0]',
          )}
        >
          {tone === 'out' ? '−' : ''} R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={focused ? draft : moneyInputValue(value)}
          onFocus={() => {
            setFocused(true)
            setDraft(moneyInputValue(value))
          }}
          onChange={e => {
            setDraft(e.target.value)
            onChange(parseMoneyInput(e.target.value))
          }}
          onBlur={() => {
            const rounded = roundMoney(parseMoneyInput(draft))
            onChange(rounded)
            setDraft(moneyInputValue(rounded))
            setFocused(false)
          }}
          placeholder="0,00"
          className={cn(
            'w-full min-w-0 rounded border border-[rgba(240,210,140,0.18)] bg-[rgba(0,0,0,0.35)]',
            'px-2 py-1 text-sm font-semibold tabular-nums text-[#fffaf4] outline-none',
            'focus:border-[rgba(242,216,146,0.55)]',
            tone === 'in' ? 'caret-[#c8f0d8]' : 'caret-[#f0c4b0]',
          )}
        />
      </div>
    </label>
  )
}

function SaldoBadge({ label, saldo }: { label: string; saldo: number }) {
  const isPos = saldo > 0
  const isNeg = saldo < 0
  const sinal = isPos ? 'Positivo' : isNeg ? 'Negativo' : 'Zerado'
  const SaldoIcon = isNeg ? ArrowDownRight : ArrowUpRight

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        isNeg ? 'border-red-400/25 bg-red-950/25' : 'border-emerald-400/25 bg-emerald-950/20',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[#edd9c4]/65">{label}</p>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]',
            isNeg
              ? 'border-red-400/30 bg-red-500/10 text-red-300'
              : isPos
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : 'border-[rgba(240,210,140,0.25)] text-[#f2d892]',
          )}
        >
          <SaldoIcon className="h-2.5 w-2.5" aria-hidden />
          {sinal}
        </span>
      </div>
      <p
        className={cn(
          'mt-1 font-display text-lg tabular-nums tracking-wide',
          isNeg ? 'text-red-400' : 'text-emerald-400',
        )}
      >
        {fmtCur(saldo)}
      </p>
    </div>
  )
}
