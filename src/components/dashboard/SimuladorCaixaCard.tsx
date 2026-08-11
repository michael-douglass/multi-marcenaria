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
import { useSimuladorCaixaShared } from '@/hooks/useSimuladorCaixaShared'
import {
  aplicarAjustesNosMeses,
  rotuloCampoAjuste,
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
  /** Contas ainda em aberto neste mês (receber ou pagar). */
  temPrevisao?: boolean
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

function mesesComPrevisaoSet(data: MesComparativoSimulador[]): Set<string> {
  return new Set(data.filter(m => m.temPrevisao).map(m => m.mes))
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/** Arredonda centavos sem forçar valor negativo a zero (ex.: saldo do caixa). */
function roundMoneySigned(n: number): number {
  if (!Number.isFinite(n)) return 0
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
  const {
    simulacao: simulacaoSalva,
    loading: loadingSimulacao,
    saving,
    error: saveError,
    save,
    clear,
  } = useSimuladorCaixaShared(ano)

  /**
   * Só o histórico (+/−) fica salvo e não é sobrescrito pelos dados reais.
   * Os valores “a receber / a pagar” sempre vêm do sistema + esse histórico.
   */
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
  /** true enquanto o histórico mudou e ainda não gravamos (debounce). */
  const [isDirty, setIsDirty] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const saveFlashTimer = useRef<number | null>(null)
  /** Evita eco do próprio save sobrescrever o histórico local ainda dirty. */
  const historicoAnoRef = useRef<number | null>(null)

  const proximo = useMemo(() => infoProximoMes(), [])
  const previsaoNoAnoAtual = proximo.ano === ano
  const mesesPrevisaoOriginais = useMemo(() => mesesComPrevisaoSet(dataOriginal), [dataOriginal])

  const baseMeses = useMemo(() => buildMesesBase(dataOriginal), [dataOriginal])
  const meses = useMemo(
    () => aplicarAjustesNosMeses(baseMeses, ajustes),
    [baseMeses, ajustes],
  )

  const previsaoRecebimento = useMemo(() => {
    if (previsaoNoAnoAtual) {
      return meses.find(m => m.mes === proximo.label)?.receitas ?? roundMoney(previsaoRecebimentoOriginal)
    }
    return roundMoney(previsaoRecebimentoOriginal)
  }, [previsaoNoAnoAtual, meses, proximo.label, previsaoRecebimentoOriginal])

  const previsaoDespesas = useMemo(() => {
    if (previsaoNoAnoAtual) {
      return meses.find(m => m.mes === proximo.label)?.despesas ?? roundMoney(previsaoDespesasOriginal)
    }
    return roundMoney(previsaoDespesasOriginal)
  }, [previsaoNoAnoAtual, meses, proximo.label, previsaoDespesasOriginal])

  const markDirty = () => {
    setIsDirty(true)
    setSaveFlash(false)
  }

  // Troca de ano: limpa painéis e espera o histórico daquele ano
  useEffect(() => {
    historicoAnoRef.current = null
    setAjustes([])
    setAjusteTitulo('')
    setAjusteValorDraft('')
    setPainelMes(null)
    setHistoricosAbertos({})
    setIsDirty(false)
    setSaveFlash(false)
  }, [ano])

  // Carrega só o histórico salvo — números vêm sempre da base real do sistema
  useEffect(() => {
    if (loadingSimulacao) return
    if (isDirty) return

    setAjustes(simulacaoSalva?.ajustes ?? [])
    historicoAnoRef.current = ano
  }, [ano, loadingSimulacao, simulacaoSalva, isDirty])

  // Salva automaticamente o histórico (e um espelho dos meses derivados, só para compatibilidade)
  useEffect(() => {
    if (!isDirty || loadingSimulacao) return
    if (historicoAnoRef.current !== ano) return

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await save({
            meses,
            previsaoRecebimento,
            previsaoDespesas,
            ajustes,
          })
          setIsDirty(false)
          setSaveFlash(true)
          if (saveFlashTimer.current != null) window.clearTimeout(saveFlashTimer.current)
          saveFlashTimer.current = window.setTimeout(() => setSaveFlash(false), 1800)
        } catch {
          // erro já fica em saveError; mantém isDirty para tentar de novo
        }
      })()
    }, 550)

    return () => window.clearTimeout(timer)
  }, [
    isDirty,
    loadingSimulacao,
    ano,
    meses,
    previsaoRecebimento,
    previsaoDespesas,
    ajustes,
    save,
  ])

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

  /** Só meses com movimento, previsão (contas em aberto) ou ajustes — evita cards zerados. */
  const linhasVisiveis = useMemo(() => {
    return linhas.filter(m => {
      if (m.receitas > 0 || m.despesas > 0) return true
      if (mesesPrevisaoOriginais.has(m.mes)) return true
      if (previsaoNoAnoAtual && m.mes === proximo.label) return true
      if (ajustes.some(a => a.mes === m.mes)) return true
      return false
    })
  }, [linhas, mesesPrevisaoOriginais, previsaoNoAnoAtual, proximo.label, ajustes])

  const saldoMeses = linhas.reduce((s, m) => s + m.saldo, 0)
  const impactoAjustes = somarAjustes(ajustes)
  const saldoPrevisao = previsaoRecebimento - previsaoDespesas
  // Se o próximo mês (ex.: Ago) já está no ano, a previsão já entrou no card do mês.
  // Se for ano seguinte (ex.: Jan), soma a previsão à parte no caixa.
  const caixaFinal = roundMoneySigned(
    saldoMeses + impactoAjustes + (previsaoNoAnoAtual ? 0 : saldoPrevisao),
  )
  const caixaPositivo = caixaFinal > 0
  const caixaNegativo = caixaFinal < 0

  const ehMesProximo = (mes: string) => previsaoNoAnoAtual && mes === proximo.label
  const ehMesPrevisao = (mes: string) =>
    mesesPrevisaoOriginais.has(mes) || ehMesProximo(mes)

  /** Digitar o valor vira um item de histórico (diferença em relação ao que está na tela). */
  const commitValorCampo = (
    mes: string,
    campo: SimuladorAjusteCampo,
    valor: number,
    titulo = 'Ajuste manual',
  ) => {
    const v = roundMoney(valor)
    const atual = meses.find(m => m.mes === mes)?.[campo] ?? 0
    const delta = roundMoney(v - atual)
    if (delta === 0) return

    const novo: SimuladorAjuste = {
      id: createId(),
      titulo,
      tipo: delta > 0 ? 'adicionar' : 'remover',
      valor: Math.abs(delta),
      criadoEm: new Date().toISOString(),
      mes,
      campo,
    }
    setAjustes(prev => [novo, ...prev])
    markDirty()
  }

  const updateMes = (mes: string, field: 'receitas' | 'despesas', valor: number) => {
    commitValorCampo(mes, field, valor)
  }

  const updatePrevisao = (field: 'receitas' | 'despesas', valor: number) => {
    if (previsaoNoAnoAtual) {
      commitValorCampo(proximo.label, field, valor)
      return
    }
    // Próximo mês fora do ano selecionado: só acompanha o sistema (sem histórico local).
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
    setAjustes(prev => prev.filter(a => a.id !== id))
    markDirty()
  }

  const handleReset = () => {
    void (async () => {
      try {
        await clear()
        setAjustes([])
        setAjusteTitulo('')
        setAjusteValorDraft('')
        setPainelMes(null)
        setHistoricosAbertos({})
        setIsDirty(false)
        setSaveFlash(false)
        historicoAnoRef.current = ano
      } catch {
        // erro já fica em saveError
      }
    })()
  }

  return (
    <Card className="overflow-hidden border-[rgba(240,210,140,0.16)] bg-[rgba(12,7,5,0.65)] backdrop-blur-md">
      <CardHeader className="flex flex-col gap-4 space-y-0 border-b border-[rgba(240,210,140,0.08)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="font-display text-lg tracking-[0.12em] text-[#f2d892]">
            Simulador de Caixa
          </CardTitle>
          <CardDescription className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#edd9c4]/60">
            Igual ao sistema: parcelas em aberto por vencimento · histórico manual permanece
          </CardDescription>
          {loadingSimulacao && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#edd9c4]/55">
              Carregando simulação…
            </p>
          )}
          {(isDirty || saving) && !loadingSimulacao && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">
              Salvando…
            </p>
          )}
          {saveFlash && !isDirty && !saving && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Salvo para todos
            </p>
          )}
          {saveError && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300">
              Não foi possível salvar. Tente de novo.
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
                    ? `Mesma conta do card “A Receber Este Mês”: parcelas vencendo em ${proximo.nome}. Já no card ${proximo.label}.`
                    : 'Entra no total do caixa (mês fora deste ano). Meses deste ano com contas em aberto já estão nos cards.'}
                </p>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-xl">
              <MoneyField
                label="A receber"
                value={previsaoRecebimento}
                onChange={v => updatePrevisao('receitas', v)}
                tone="in"
                commitOnBlurOnly
                readOnly={!previsaoNoAnoAtual}
              />
              <MoneyField
                label="A pagar"
                value={previsaoDespesas}
                onChange={v => updatePrevisao('despesas', v)}
                tone="out"
                commitOnBlurOnly
                readOnly={!previsaoNoAnoAtual}
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
            Só meses com a receber ou a pagar · edite ou use +/− · salva para todos
          </p>
        </div>

        {linhasVisiveis.length === 0 ? (
          <div className="rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.22)] px-4 py-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#edd9c4]/65">
              Sem a receber ou a pagar em aberto em {ano}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {linhasVisiveis.map((m, i) => {
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
                    label="A receber"
                    value={m.receitas}
                    onChange={v => updateMes(m.mes, 'receitas', v)}
                    tone="in"
                    compact
                    commitOnBlurOnly
                  />
                  <MoneyField
                    label="A pagar"
                    value={m.despesas}
                    onChange={v => updateMes(m.mes, 'despesas', v)}
                    tone="out"
                    compact
                    commitOnBlurOnly
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
                      A receber
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
                      A receber
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
                      A pagar
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
                      A pagar
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
                  Meses com a receber ou a pagar
                  {mesesPrevisaoOriginais.size > 0
                    ? ` (previsão em ${mesesPrevisaoOriginais.size} mês${mesesPrevisaoOriginais.size === 1 ? '' : 'es'})`
                    : ''}
                  {!previsaoNoAnoAtual
                    ? ` + previsão ${proximo.nome} (${fmtCur(saldoPrevisao)})`
                    : ''}
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
  readOnly,
  commitOnBlurOnly,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  tone: 'in' | 'out'
  compact?: boolean
  readOnly?: boolean
  /** Só grava no blur — evita criar vários itens de histórico a cada tecla. */
  commitOnBlurOnly?: boolean
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
          readOnly={readOnly}
          value={focused ? draft : moneyInputValue(value)}
          onFocus={() => {
            if (readOnly) return
            setFocused(true)
            setDraft(moneyInputValue(value))
          }}
          onChange={e => {
            if (readOnly) return
            setDraft(e.target.value)
            if (!commitOnBlurOnly) onChange(parseMoneyInput(e.target.value))
          }}
          onBlur={() => {
            if (readOnly) return
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
            readOnly && 'cursor-default opacity-90',
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
