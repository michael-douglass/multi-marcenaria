import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  EyeOff,
  FileDown,
  History,
  ImageDown,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MONTHS_PT } from '@/lib/date-br'
import {
  useSimuladorCaixaItens,
  useSimuladorCaixaMensal,
} from '@/hooks/useFinanceiroDashboard'
import { useSimuladorCaixaShared } from '@/hooks/useSimuladorCaixaShared'
import {
  exportarSimuladorCaixa,
  type SimuladorCaixaExportFormat,
} from '@/lib/simulador-caixa-export'
import {
  aplicarAjustesNosMeses,
  aplicarOcultosNaBase,
  idsContasOcultas,
  isAjusteOcultarConta,
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
  /** Nome da empresa no cabeçalho do PDF/JPG. */
  empresaNome?: string | null
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

interface MesJanela {
  /** Rótulo curto (Out, Jan…). */
  mes: string
  ano: number
  nome: string
}

/**
 * Sempre os próximos 6 meses a partir do mês atual (inclusive), cruzando o ano.
 * Ex.: Out/2026 → Out, Nov, Dez, Jan, Fev, Mar (2026→2027).
 */
function buildJanelaProximos6(): MesJanela[] {
  const agora = new Date()
  const out: MesJanela[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() + i, 1)
    out.push({
      mes: MESES_CURTOS[d.getMonth()],
      ano: d.getFullYear(),
      nome: MONTHS_PT[d.getMonth()],
    })
  }
  return out
}

function mesKey(ano: number, mes: string): string {
  return `${ano}:${mes}`
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
  empresaNome,
}: SimuladorCaixaCardProps) {
  /** Janela fixa: sempre os próximos 6 meses (ex.: Out→Mar), cruzando o ano. */
  const janela = useMemo(() => buildJanelaProximos6(), [])
  const anoJanelaInicio = janela[0]?.ano ?? ano
  const anoJanelaFim = janela[janela.length - 1]?.ano ?? ano
  const temDoisAnos = anoJanelaFim !== anoJanelaInicio

  /** Histórico do 1º ano da janela (ex.: 2026). */
  const {
    simulacao: simulacaoSalva,
    loading: loadingSimulacao,
    saving,
    error: saveError,
    save,
    clear,
  } = useSimuladorCaixaShared(anoJanelaInicio)

  /** Histórico do 2º ano da janela (ex.: 2027), se cruzar o calendário. */
  const {
    simulacao: simulacaoSalvaB,
    loading: loadingSimulacaoB,
    saving: savingB,
    error: saveErrorB,
    save: saveB,
    clear: clearB,
  } = useSimuladorCaixaShared(anoJanelaFim)

  const { data: itensAno = [], isSuccess: itensCarregados } = useSimuladorCaixaItens(anoJanelaInicio)
  const { data: itensAnoB = [], isSuccess: itensCarregadosB } = useSimuladorCaixaItens(anoJanelaFim)
  const { data: mensalAnoInicio } = useSimuladorCaixaMensal(anoJanelaInicio)
  const { data: mensalAnoB } = useSimuladorCaixaMensal(anoJanelaFim)

  /** Totais oficiais do 1º ano da janela (ex.: 2026), independentes do select. */
  const dataJanelaInicio = useMemo((): MesComparativoSimulador[] => {
    if (ano === anoJanelaInicio) return dataOriginal
    return (mensalAnoInicio ?? []).map(m => ({
      mes: m.mes,
      receitas: m.receitas,
      despesas: m.despesas,
      temPrevisao: m.temPrevisao,
    }))
  }, [ano, anoJanelaInicio, dataOriginal, mensalAnoInicio])

  /**
   * Só o histórico (+/− / ocultar) fica salvo e não é sobrescrito pelos dados reais.
   * Os valores “a receber / a pagar” sempre vêm do sistema + esse histórico.
   */
  const [ajustes, setAjustes] = useState<SimuladorAjuste[]>([])
  const [ajustesB, setAjustesB] = useState<SimuladorAjuste[]>([])
  /** Quais cards de mês estão com o histórico expandido (chave ano:mes). */
  const [historicosAbertos, setHistoricosAbertos] = useState<Record<string, boolean>>({})
  /** Painel aberto em um card de mês: qual ação o usuário escolheu. */
  const [painelMes, setPainelMes] = useState<{
    mes: string
    ano: number
    campo: SimuladorAjusteCampo
    tipo: SimuladorAjusteTipo
  } | null>(null)
  const [ajusteTitulo, setAjusteTitulo] = useState('')
  const [ajusteValorDraft, setAjusteValorDraft] = useState('')
  /** Busca na lista de contas reais do painel − (ocultar). */
  const [buscaPainel, setBuscaPainel] = useState('')
  /** true enquanto o histórico mudou e ainda não gravamos (debounce). */
  const [isDirty, setIsDirty] = useState(false)
  const [isDirtyB, setIsDirtyB] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<SimuladorCaixaExportFormat | null>(null)
  const saveFlashTimer = useRef<number | null>(null)
  /** Evita eco do próprio save sobrescrever o histórico local ainda dirty. */
  const historicoAnoRef = useRef<number | null>(null)
  const historicoAnoBRef = useRef<number | null>(null)

  const proximo = useMemo(() => infoProximoMes(), [])

  const ocultosIds = useMemo(() => idsContasOcultas(ajustes), [ajustes])
  const ocultosIdsB = useMemo(() => idsContasOcultas(ajustesB), [ajustesB])

  /**
   * Base = mesmos totais das Anotações (a receber / a pagar em aberto).
   * Contas ocultadas só na simulação são descontadas em cima dessa base.
   */
  const baseMeses = useMemo(() => {
    const doSistema = buildMesesBase(dataJanelaInicio)
    if (!itensCarregados || ocultosIds.size === 0) return doSistema
    return aplicarOcultosNaBase(doSistema, itensAno, ocultosIds)
  }, [itensCarregados, itensAno, ocultosIds, dataJanelaInicio])

  const dataOriginalB = useMemo((): MesComparativoSimulador[] => {
    return (mensalAnoB ?? []).map(m => ({
      mes: m.mes,
      receitas: m.receitas,
      despesas: m.despesas,
      temPrevisao: m.temPrevisao,
    }))
  }, [mensalAnoB])

  const baseMesesB = useMemo(() => {
    const doSistema = buildMesesBase(dataOriginalB)
    if (!itensCarregadosB || ocultosIdsB.size === 0) return doSistema
    return aplicarOcultosNaBase(doSistema, itensAnoB, ocultosIdsB)
  }, [itensCarregadosB, itensAnoB, ocultosIdsB, dataOriginalB])

  const meses = useMemo(
    () => aplicarAjustesNosMeses(baseMeses, ajustes),
    [baseMeses, ajustes],
  )

  const mesesB = useMemo(
    () => aplicarAjustesNosMeses(baseMesesB, ajustesB),
    [baseMesesB, ajustesB],
  )

  const pickMesesDoAno = (anoMes: number) =>
    temDoisAnos && anoMes === anoJanelaFim ? mesesB : meses

  const itensDoAnoPainel =
    painelMes && temDoisAnos && painelMes.ano === anoJanelaFim ? itensAnoB : itensAno
  const ocultosDoPainel =
    painelMes && temDoisAnos && painelMes.ano === anoJanelaFim ? ocultosIdsB : ocultosIds

  /** Parcelas do painel − (ainda visíveis / não ocultadas). */
  const itensPainelRemover = useMemo(() => {
    if (!painelMes || painelMes.tipo !== 'remover') return []
    return itensDoAnoPainel.filter(
      i =>
        i.mes === painelMes.mes &&
        i.campo === painelMes.campo &&
        !ocultosDoPainel.has(i.id),
    )
  }, [painelMes, itensDoAnoPainel, ocultosDoPainel])

  /** Lista filtrada pelo campo de busca (nome / título). */
  const itensPainelFiltrados = useMemo(() => {
    const termo = buscaPainel.trim().toLowerCase()
    if (!termo) return itensPainelRemover
    return itensPainelRemover.filter(i => {
      const titulo = i.titulo.toLowerCase()
      const valor = String(i.valor)
      const venc = i.vencimento
      return titulo.includes(termo) || valor.includes(termo) || venc.includes(termo)
    })
  }, [itensPainelRemover, buscaPainel])

  const previsaoRecebimento = useMemo(() => {
    const naJanela = janela.some(j => j.mes === proximo.label && j.ano === proximo.ano)
    if (!naJanela) return roundMoney(previsaoRecebimentoOriginal)
    const row = pickMesesDoAno(proximo.ano).find(m => m.mes === proximo.label)
    return row ? row.receitas : roundMoney(previsaoRecebimentoOriginal)
  }, [
    janela,
    proximo,
    previsaoRecebimentoOriginal,
    meses,
    mesesB,
    temDoisAnos,
    anoJanelaFim,
  ])

  const previsaoDespesas = useMemo(() => {
    const naJanela = janela.some(j => j.mes === proximo.label && j.ano === proximo.ano)
    if (!naJanela) return roundMoney(previsaoDespesasOriginal)
    const row = pickMesesDoAno(proximo.ano).find(m => m.mes === proximo.label)
    return row ? row.despesas : roundMoney(previsaoDespesasOriginal)
  }, [
    janela,
    proximo,
    previsaoDespesasOriginal,
    meses,
    mesesB,
    temDoisAnos,
    anoJanelaFim,
  ])

  const markDirty = (anoAlvo: number = anoJanelaInicio) => {
    if (temDoisAnos && anoAlvo === anoJanelaFim) setIsDirtyB(true)
    else setIsDirty(true)
    setSaveFlash(false)
  }

  // Troca de janela (virada de ano): limpa painéis
  useEffect(() => {
    historicoAnoRef.current = null
    historicoAnoBRef.current = null
    setAjustes([])
    setAjustesB([])
    setAjusteTitulo('')
    setAjusteValorDraft('')
    setBuscaPainel('')
    setPainelMes(null)
    setHistoricosAbertos({})
    setIsDirty(false)
    setIsDirtyB(false)
    setSaveFlash(false)
  }, [anoJanelaInicio, anoJanelaFim])

  // Carrega só o histórico salvo — números vêm sempre da base real do sistema
  useEffect(() => {
    if (loadingSimulacao) return
    if (isDirty) return

    setAjustes(simulacaoSalva?.ajustes ?? [])
    historicoAnoRef.current = anoJanelaInicio
  }, [anoJanelaInicio, loadingSimulacao, simulacaoSalva, isDirty])

  useEffect(() => {
    if (!temDoisAnos) return
    if (loadingSimulacaoB) return
    if (isDirtyB) return

    setAjustesB(simulacaoSalvaB?.ajustes ?? [])
    historicoAnoBRef.current = anoJanelaFim
  }, [temDoisAnos, anoJanelaFim, loadingSimulacaoB, simulacaoSalvaB, isDirtyB])

  // Salva automaticamente o histórico (e um espelho dos meses derivados, só para compatibilidade)
  useEffect(() => {
    if (!isDirty || loadingSimulacao) return
    if (historicoAnoRef.current !== anoJanelaInicio) return

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
    anoJanelaInicio,
    meses,
    previsaoRecebimento,
    previsaoDespesas,
    ajustes,
    save,
  ])

  useEffect(() => {
    if (!temDoisAnos || !isDirtyB || loadingSimulacaoB) return
    if (historicoAnoBRef.current !== anoJanelaFim) return

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveB({
            meses: mesesB,
            previsaoRecebimento: 0,
            previsaoDespesas: 0,
            ajustes: ajustesB,
          })
          setIsDirtyB(false)
          setSaveFlash(true)
          if (saveFlashTimer.current != null) window.clearTimeout(saveFlashTimer.current)
          saveFlashTimer.current = window.setTimeout(() => setSaveFlash(false), 1800)
        } catch {
          // mantém isDirtyB
        }
      })()
    }, 550)

    return () => window.clearTimeout(timer)
  }, [
    temDoisAnos,
    isDirtyB,
    loadingSimulacaoB,
    anoJanelaFim,
    mesesB,
    ajustesB,
    saveB,
  ])

  useEffect(() => {
    return () => {
      if (saveFlashTimer.current != null) window.clearTimeout(saveFlashTimer.current)
    }
  }, [])

  const valorMesAno = (anoMes: number, mes: string, campo: SimuladorAjusteCampo): number => {
    return pickMesesDoAno(anoMes).find(m => m.mes === mes)?.[campo] ?? 0
  }

  /**
   * Sempre os 6 meses da janela (Out→Mar), na ordem civil, com ano no card.
   */
  const linhasVisiveis = useMemo(() => {
    return janela.map(j => {
      const row = pickMesesDoAno(j.ano).find(m => m.mes === j.mes)
      const receitas = row?.receitas ?? 0
      const despesas = row?.despesas ?? 0
      return {
        mes: j.mes,
        ano: j.ano,
        nome: j.nome,
        receitas,
        despesas,
        saldo: receitas - despesas,
        key: mesKey(j.ano, j.mes),
      }
    })
  }, [janela, meses, mesesB, temDoisAnos, anoJanelaFim])

  const saldoMesesJanela = linhasVisiveis.reduce((s, m) => s + m.saldo, 0)
  const impactoAjustes =
    somarAjustes(ajustes) + (temDoisAnos ? somarAjustes(ajustesB) : 0)
  const saldoPrevisao = previsaoRecebimento - previsaoDespesas
  // Caixa da janela (6 meses à frente) + ajustes gerais sem mês.
  const caixaFinal = roundMoneySigned(saldoMesesJanela + impactoAjustes)
  const caixaPositivo = caixaFinal > 0
  const caixaNegativo = caixaFinal < 0

  const ehMesProximo = (mes: string, anoMes: number) =>
    mes === proximo.label && anoMes === proximo.ano
  const ehMesPrevisao = (mes: string, anoMes: number) => {
    if (ehMesProximo(mes, anoMes)) return true
    if (anoMes === anoJanelaInicio && dataJanelaInicio.some(d => d.mes === mes && d.temPrevisao)) {
      return true
    }
    if (anoMes === anoJanelaFim && dataOriginalB.some(d => d.mes === mes && d.temPrevisao)) {
      return true
    }
    return false
  }

  const ajustesDoAno = (anoMes: number) =>
    temDoisAnos && anoMes === anoJanelaFim ? ajustesB : ajustes

  const ehAnoFim = (anoMes: number) => temDoisAnos && anoMes === anoJanelaFim

  /** Digitar o valor vira um item de histórico (diferença em relação ao que está na tela). */
  const commitValorCampo = (
    mes: string,
    anoMes: number,
    campo: SimuladorAjusteCampo,
    valor: number,
    titulo = 'Ajuste manual',
  ) => {
    const v = roundMoney(valor)
    const atual = valorMesAno(anoMes, mes, campo)
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
    if (ehAnoFim(anoMes)) setAjustesB(prev => [novo, ...prev])
    else setAjustes(prev => [novo, ...prev])
    markDirty(anoMes)
  }

  const updateMes = (
    mes: string,
    anoMes: number,
    field: 'receitas' | 'despesas',
    valor: number,
  ) => {
    commitValorCampo(mes, anoMes, field, valor)
  }

  const updatePrevisao = (field: 'receitas' | 'despesas', valor: number) => {
    commitValorCampo(proximo.label, proximo.ano, field, valor)
  }

  const abrirPainelMes = (
    mes: string,
    anoMes: number,
    campo: SimuladorAjusteCampo,
    tipo: SimuladorAjusteTipo,
  ) => {
    setPainelMes({ mes, ano: anoMes, campo, tipo })
    setAjusteTitulo('')
    setAjusteValorDraft('')
    setBuscaPainel('')
  }

  const fecharPainelMes = () => {
    setPainelMes(null)
    setAjusteTitulo('')
    setAjusteValorDraft('')
    setBuscaPainel('')
  }

  const confirmarAjusteMes = () => {
    if (!painelMes) return
    const titulo = ajusteTitulo.trim()
    const valor = parseMoneyInput(ajusteValorDraft)
    if (!titulo || valor <= 0) return

    const { mes, ano: anoMes, campo, tipo } = painelMes
    const novo: SimuladorAjuste = {
      id: createId(),
      titulo,
      tipo,
      valor,
      criadoEm: new Date().toISOString(),
      mes,
      campo,
      contaId: null,
      origem: null,
    }
    if (ehAnoFim(anoMes)) setAjustesB(prev => [novo, ...prev])
    else setAjustes(prev => [novo, ...prev])
    fecharPainelMes()
    markDirty(anoMes)
  }

  /** Oculta uma parcela real só na simulação (entra no histórico e é salva). */
  const ocultarConta = (item: {
    id: string
    titulo: string
    valor: number
    mes: string
    campo: SimuladorAjusteCampo
    origem: 'receber' | 'pagar'
  }) => {
    const anoMes = painelMes?.ano ?? anoJanelaInicio
    const ocultos = ehAnoFim(anoMes) ? ocultosIdsB : ocultosIds
    if (ocultos.has(item.id)) return
    const novo: SimuladorAjuste = {
      id: createId(),
      titulo: item.titulo,
      tipo: 'remover',
      valor: roundMoney(item.valor),
      criadoEm: new Date().toISOString(),
      mes: item.mes,
      campo: item.campo,
      contaId: item.id,
      origem: item.origem,
    }
    if (ehAnoFim(anoMes)) setAjustesB(prev => [novo, ...prev])
    else setAjustes(prev => [novo, ...prev])
    markDirty(anoMes)
  }

  const apagarAjuste = (id: string, anoMes: number) => {
    if (ehAnoFim(anoMes)) setAjustesB(prev => prev.filter(a => a.id !== id))
    else setAjustes(prev => prev.filter(a => a.id !== id))
    markDirty(anoMes)
  }

  const handleReset = () => {
    void (async () => {
      try {
        await clear()
        if (temDoisAnos) await clearB()
        setAjustes([])
        setAjustesB([])
        setAjusteTitulo('')
        setAjusteValorDraft('')
        setPainelMes(null)
        setHistoricosAbertos({})
        setIsDirty(false)
        setIsDirtyB(false)
        setSaveFlash(false)
        historicoAnoRef.current = anoJanelaInicio
        historicoAnoBRef.current = anoJanelaFim
      } catch {
        // erro já fica em saveError
      }
    })()
  }

  const handleExport = (format: SimuladorCaixaExportFormat) => {
    if (exportingFormat) return
    setExportingFormat(format)
    void (async () => {
      try {
        const todosAjustes = temDoisAnos ? [...ajustes, ...ajustesB] : ajustes
        const ocultadosCount = todosAjustes.filter(isAjusteOcultarConta).length
        const ajustesManuaisCount = todosAjustes.filter(a => !isAjusteOcultarConta(a)).length
        const janelaLabel = `${janela[0]?.mes}/${janela[0]?.ano} → ${janela[5]?.mes}/${janela[5]?.ano}`

        await exportarSimuladorCaixa(
          {
            empresaNome,
            ano: anoJanelaInicio,
            janelaLabel,
            previsao: {
              label: `${proximo.nome} ${proximo.ano}`,
              receber: previsaoRecebimento,
              pagar: previsaoDespesas,
              saldo: saldoPrevisao,
            },
            meses: linhasVisiveis.map(m => {
              const histMes = ajustesDoAno(m.ano).filter(a => a.mes === m.mes)
              return {
                mes: m.mes,
                mesNome: m.nome,
                ano: m.ano,
                receitas: m.receitas,
                despesas: m.despesas,
                saldo: m.saldo,
                historico: histMes.map(a => {
                  const isOculto = isAjusteOcultarConta(a)
                  const campo = rotuloCampoAjuste(a.campo)
                  const quando = new Date(a.criadoEm).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const acao = isOculto
                    ? ('ocultar' as const)
                    : a.tipo === 'adicionar'
                      ? ('adicionar' as const)
                      : ('remover' as const)
                  const acaoTxt = isOculto
                    ? 'Ocultado'
                    : a.tipo === 'adicionar'
                      ? 'Adicionado'
                      : 'Removido'
                  return {
                    titulo: a.titulo,
                    detalhe: `${campo} · ${acaoTxt} · ${quando}`,
                    acao,
                    valor: a.valor,
                    campoLabel: campo,
                  }
                }),
              }
            }),
            caixaFinal,
            ocultadosCount,
            ajustesManuaisCount,
          },
          format,
        )
      } catch (err) {
        alert(
          err instanceof Error
            ? err.message
            : `Não foi possível exportar o ${format.toUpperCase()}.`,
        )
      } finally {
        setExportingFormat(null)
      }
    })()
  }

  return (
    <Card className="overflow-hidden border-[rgba(42,24,18,0.10)] bg-[#fffcf8]">
      <CardHeader className="flex flex-col gap-4 space-y-0 border-b border-[rgba(240,210,140,0.08)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="font-display text-lg tracking-[0.12em] text-[#f2d892]">
            Simulador de Caixa
          </CardTitle>
          <CardDescription className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#edd9c4]/60">
            Sempre {janela[0]?.mes}/{janela[0]?.ano} → {janela[5]?.mes}/{janela[5]?.ano} · ocultar
            dívidas: − A receber / − A pagar
          </CardDescription>
          {(loadingSimulacao || (temDoisAnos && loadingSimulacaoB)) && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#edd9c4]/55">
              Carregando simulação…
            </p>
          )}
          {(isDirty || isDirtyB || saving || savingB) &&
            !loadingSimulacao &&
            !(temDoisAnos && loadingSimulacaoB) && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">
              Salvando…
            </p>
          )}
          {saveFlash && !isDirty && !isDirtyB && !saving && !savingB && (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Salvo para todos
            </p>
          )}
          {(saveError || saveErrorB) && (
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
                'rounded-md border border-[rgba(42,24,18,0.16)] bg-[#fffcf8]',
                'px-2.5 py-1.5 text-xs font-semibold tracking-wide text-[#2a1812] outline-none',
                'transition-colors hover:border-[rgba(42,24,18,0.28)] focus:border-[#8d5e22]',
              )}
            >
              {anos.map(a => (
                <option key={a} value={a} className="bg-[#fffcf8]">
                  {a}
                </option>
              ))}
            </select>
          </label>

          <div
            className={cn(
              'inline-flex overflow-hidden rounded-md border border-[rgba(42,24,18,0.16)]',
              'bg-[#fffcf8] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
            )}
            role="group"
            aria-label="Exportar simulador"
          >
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={Boolean(exportingFormat)}
              title="Exportar folha A4 em PDF"
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]',
                'text-[#2a1812] transition-colors hover:bg-[rgba(141,94,34,0.08)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {exportingFormat === 'pdf' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <FileDown className="h-3.5 w-3.5 text-[#8d5e22]" aria-hidden />
              )}
              PDF
            </button>
            <span
              aria-hidden
              className="w-px self-stretch bg-[rgba(42,24,18,0.12)]"
            />
            <button
              type="button"
              onClick={() => handleExport('jpg')}
              disabled={Boolean(exportingFormat)}
              title="Exportar folha A4 em JPG"
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]',
                'text-[#2a1812] transition-colors hover:bg-[rgba(141,94,34,0.08)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {exportingFormat === 'jpg' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <ImageDown className="h-3.5 w-3.5 text-[#8d5e22]" aria-hidden />
              )}
              JPG
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-[rgba(240,210,140,0.25)]',
              'bg-[rgba(42,24,18,0.04)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b5244]',
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.25)] bg-[rgba(42,24,18,0.04)]">
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
                  Parcelas vencendo em {proximo.nome} · já no card {proximo.label}/{proximo.ano} da
                  janela de 6 meses.
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
              />
              <MoneyField
                label="A pagar"
                value={previsaoDespesas}
                onChange={v => updatePrevisao('despesas', v)}
                tone="out"
                commitOnBlurOnly
              />
              <SaldoBadge label="Saldo previsto" saldo={saldoPrevisao} />
            </div>
          </div>
        </div>

        <div>
          <p className="font-display text-base tracking-[0.14em] text-[#f2d892]">
            PRÓXIMOS 6 MESES · {janela[0]?.mes} {janela[0]?.ano} → {janela[5]?.mes}{' '}
            {janela[5]?.ano}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[#edd9c4]/60">
            A receber − a pagar · edite ou use +/− · salva para todos
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {linhasVisiveis.map((m, i) => {
            const isPos = m.saldo > 0
            const isNeg = m.saldo < 0
            const sinal = isPos ? 'Positivo' : isNeg ? 'Negativo' : 'Zerado'
            const SaldoIcon = isNeg ? ArrowDownRight : ArrowUpRight
            const isPrevisao = ehMesPrevisao(m.mes, m.ano)
            const ajustesDoMes = ajustesDoAno(m.ano).filter(a => a.mes === m.mes)
            const historicoAberto = Boolean(historicosAbertos[m.key])

            return (
              <article
                key={m.key}
                className={cn(
                  'dash-card-enter relative overflow-hidden rounded-lg border px-3.5 py-3',
                  isPrevisao
                    ? 'border-[rgba(242,216,146,0.35)] bg-[rgba(242,216,146,0.08)]'
                    : 'border-[rgba(240,210,140,0.12)] bg-[rgba(42,24,18,0.04)]',
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
                    <h4 className="font-display text-lg tracking-[0.08em] text-[#f2d892]">
                      {m.mes}
                      <span className="ml-1.5 text-[10px] font-sans font-semibold tracking-[0.12em] text-[#edd9c4]/55">
                        {m.ano}
                      </span>
                    </h4>
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
                    onChange={v => updateMes(m.mes, m.ano, 'receitas', v)}
                    tone="in"
                    compact
                    commitOnBlurOnly
                  />
                  <MoneyField
                    label="A pagar"
                    value={m.despesas}
                    onChange={v => updateMes(m.mes, m.ano, 'despesas', v)}
                    tone="out"
                    compact
                    commitOnBlurOnly
                  />

                  {/* Ações rápidas: adicionar / remover no mês */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => abrirPainelMes(m.mes, m.ano, 'receitas', 'adicionar')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-emerald-400/30',
                        'bg-emerald-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300',
                        'transition-colors hover:bg-emerald-500/20',
                        painelMes?.mes === m.mes &&
                          painelMes.ano === m.ano &&
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
                      onClick={() => abrirPainelMes(m.mes, m.ano, 'receitas', 'remover')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-red-400/30',
                        'bg-red-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-red-300',
                        'transition-colors hover:bg-red-500/20',
                        painelMes?.mes === m.mes &&
                          painelMes.ano === m.ano &&
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
                      onClick={() => abrirPainelMes(m.mes, m.ano, 'despesas', 'adicionar')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-amber-400/30',
                        'bg-amber-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-200',
                        'transition-colors hover:bg-amber-500/20',
                        painelMes?.mes === m.mes &&
                          painelMes.ano === m.ano &&
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
                      onClick={() => abrirPainelMes(m.mes, m.ano, 'despesas', 'remover')}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border border-[rgba(240,210,140,0.28)]',
                        'bg-[rgba(240,210,140,0.06)] px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#f2d892]',
                        'transition-colors hover:bg-[rgba(240,210,140,0.12)]',
                        painelMes?.mes === m.mes &&
                          painelMes.ano === m.ano &&
                          painelMes.campo === 'despesas' &&
                          painelMes.tipo === 'remover' &&
                          'ring-1 ring-[rgba(242,216,146,0.55)]',
                      )}
                    >
                      <Minus className="h-3 w-3" aria-hidden />
                      A pagar
                    </button>
                  </div>

                  {painelMes?.mes === m.mes && painelMes.ano === m.ano && (
                    <div className="mt-1 space-y-2 rounded-md border border-[rgba(240,210,140,0.2)] bg-[rgba(242,216,146,0.05)] p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#f2d892]">
                        {painelMes.tipo === 'adicionar' ? 'Adicionar' : 'Ocultar dívidas ·'}{' '}
                        {rotuloCampoAjuste(painelMes.campo).toLowerCase()}
                      </p>

                      {painelMes.tipo === 'remover' && (
                        <div className="space-y-1.5">
                          <p className="text-[9px] uppercase tracking-[0.1em] text-[#edd9c4]/55">
                            Contas reais deste mês (só na simulação)
                          </p>
                          {itensPainelRemover.length > 0 && (
                            <label className="relative block">
                              <span className="sr-only">Buscar conta</span>
                              <Search
                                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#edd9c4]/45"
                                aria-hidden
                              />
                              <input
                                type="search"
                                value={buscaPainel}
                                onChange={e => setBuscaPainel(e.target.value)}
                                placeholder="Buscar por nome, valor ou data…"
                                autoComplete="off"
                                className={cn(
                                  'w-full rounded border border-[rgba(240,210,140,0.18)] bg-[rgba(42,24,18,0.05)]',
                                  'py-1.5 pl-7 pr-2 text-xs text-[#fffaf4] outline-none',
                                  'placeholder:text-[#edd9c4]/35 focus:border-[rgba(242,216,146,0.55)]',
                                )}
                              />
                            </label>
                          )}
                          {itensPainelRemover.length === 0 ? (
                            <p className="rounded border border-[rgba(240,210,140,0.12)] px-2 py-2 text-[10px] text-[#edd9c4]/50">
                              Nenhuma parcela em aberto neste mês — ou todas já foram ocultadas.
                            </p>
                          ) : itensPainelFiltrados.length === 0 ? (
                            <p className="rounded border border-[rgba(240,210,140,0.12)] px-2 py-2 text-[10px] text-[#edd9c4]/50">
                              Nenhuma conta encontrada para “{buscaPainel.trim()}”.
                            </p>
                          ) : (
                            <ul className="max-h-40 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                              {itensPainelFiltrados.map(item => (
                                <li
                                  key={item.id}
                                  className="flex items-center gap-2 rounded border border-[rgba(240,210,140,0.14)] bg-[rgba(42,24,18,0.04)] px-2 py-1.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-medium text-[#fffaf4]">
                                      {item.titulo}
                                    </p>
                                    <p className="text-[9px] text-[#edd9c4]/45">
                                      Vence {fmtDate(item.vencimento)} · {fmtCur(item.valor)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => ocultarConta(item)}
                                    className={cn(
                                      'inline-flex shrink-0 items-center gap-1 rounded border border-red-400/35',
                                      'bg-red-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-red-300',
                                      'transition-colors hover:bg-red-500/20',
                                    )}
                                  >
                                    <EyeOff className="h-3 w-3" aria-hidden />
                                    Ocultar
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div
                            className="my-1 h-px"
                            style={{
                              background:
                                'linear-gradient(90deg, transparent, rgba(240,210,140,0.25) 30%, rgba(240,210,140,0.25) 70%, transparent)',
                            }}
                          />
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#edd9c4]/50">
                            Outro valor (manual)
                          </p>
                        </div>
                      )}

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
                            'mt-0.5 w-full rounded border border-[rgba(240,210,140,0.18)] bg-[rgba(42,24,18,0.05)]',
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
                              'w-full min-w-0 rounded border border-[rgba(240,210,140,0.18)] bg-[rgba(42,24,18,0.05)]',
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
                          Fechar
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
                    <div className="mt-1 overflow-hidden rounded-md border border-[rgba(240,210,140,0.12)] bg-[rgba(42,24,18,0.04)]">
                      <button
                        type="button"
                        onClick={() =>
                          setHistoricosAbertos(prev => ({
                            ...prev,
                            [m.key]: !prev[m.key],
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
                              const isOculto = isAjusteOcultarConta(a)
                              const acaoLabel = isAdd
                                ? 'Adicionado'
                                : isOculto
                                  ? 'Ocultado'
                                  : 'Removido'
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
                                    ) : isOculto ? (
                                      <EyeOff className="h-3 w-3" />
                                    ) : (
                                      <Minus className="h-3 w-3" />
                                    )}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-[#fffaf4]">
                                      {a.titulo}
                                    </p>
                                    <p className="text-[9px] text-[#edd9c4]/50">
                                      {rotuloCampoAjuste(a.campo)} · {acaoLabel} ·{' '}
                                      {fmtDate(a.criadoEm)}
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
                                    onClick={() => apagarAjuste(a.id, m.ano)}
                                    aria-label={
                                      isOculto
                                        ? `Restaurar conta ${a.titulo} na simulação`
                                        : `Apagar ajuste ${a.titulo}`
                                    }
                                    title={isOculto ? 'Restaurar na simulação' : 'Apagar'}
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
          aria-label={`Caixa simulado · próximos 6 meses`}
        >
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(42,24,18,0.04)]">
                <Wallet className="h-4 w-4 text-[#f2d892]" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#edd9c4]/75">
                  Como está o caixa · {janela[0]?.mes}/{janela[0]?.ano} → {janela[5]?.mes}/
                  {janela[5]?.ano}
                </p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[#edd9c4]/80">
                  Soma dos 6 meses à frente (a receber − a pagar)
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
        !compact && 'rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(42,24,18,0.04)] px-3 py-2.5',
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
            'w-full min-w-0 rounded border border-[rgba(240,210,140,0.18)] bg-[rgba(42,24,18,0.05)]',
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
